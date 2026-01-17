import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CasparCG } from 'casparcg-connection';
import { v4 as uuidv4 } from 'uuid';
import casparCommands from '../services/casparCommands';
import { processOscMessage } from '../services/oscHandler';
import { executeMacro as runMacro } from '../services/macroExecutor';

const AppContext = createContext();

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

const initialState = {
  channels: [],
  media: {
    rootPath: null,
    tree: [],
    selectedFile: null
  },
  macros: [],
  ui: {
    currentView: 'multi',
    expandedChannel: null,
    sidebarTab: 'files',
    previewSize: 400
  }
};

export function AppProvider({ children }) {
  const [state, setState] = useState(initialState);
  const [connection, setConnection] = useState({
    isConnected: false,
    host: '127.0.0.1',
    port: 5250,
    oscPort: 6250,
    previewUrl: '',
    casparCG: null,
    serverInfo: null
  });
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [oscConnected, setOscConnected] = useState(false);
  const oscListenerRef = useRef(null);

  // Load saved configuration
  useEffect(() => {
    loadConfig();
    loadMacros();
  }, []);

  // OSC message handling
  useEffect(() => {
    const { ipcRenderer } = window.require('electron');

    const handleOscMessage = (event, message) => {
      processOscMessage(message, handleOscUpdate);
    };

    ipcRenderer.on('osc:message', handleOscMessage);
    oscListenerRef.current = handleOscMessage;

    return () => {
      ipcRenderer.removeListener('osc:message', handleOscMessage);
    };
  }, []);

  const handleOscUpdate = useCallback((update) => {
    const { type, channel, layer } = update;

    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id !== channel) return ch;

        return {
          ...ch,
          layers: ch.layers.map(l => {
            if (l.id !== layer) return l;

            switch (type) {
              case 'time':
                return {
                  ...l,
                  currentTime: update.currentTime,
                  totalTime: update.totalTime
                };

              case 'frame':
                return {
                  ...l,
                  currentFrame: update.currentFrame,
                  totalFrames: update.totalFrames
                };

              case 'paused':
                return {
                  ...l,
                  isPlaying: !update.isPaused
                };

              default:
                return l;
            }
          })
        };
      })
    }));
  }, []);

  // Auto-save state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveState();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [state]);

  const loadConfig = async () => {
    const { ipcRenderer } = window.require('electron');
    const config = await ipcRenderer.invoke('config:load');
    
    if (config) {
      if (config.connection) {
        setConnection(prev => ({ ...prev, ...config.connection }));
      }
      if (config.state) {
        setState(prev => ({ ...prev, ...config.state }));
      }
    }
  };

  const saveState = async () => {
    const { ipcRenderer } = window.require('electron');
    await ipcRenderer.invoke('config:save', {
      connection: {
        host: connection.host,
        port: connection.port,
        oscPort: connection.oscPort,
        previewUrl: connection.previewUrl
      },
      state: {
        channels: state.channels,
        ui: state.ui
      }
    });
  };

  const loadMacros = async () => {
    const { ipcRenderer } = window.require('electron');
    const macros = await ipcRenderer.invoke('macro:list');
    setState(prev => ({ ...prev, macros }));
  };

  // CasparCG Connection
  const connectToCaspar = useCallback(async (host, port, oscPort, previewUrl = '') => {
    const { ipcRenderer } = window.require('electron');

    try {
      const ccg = new CasparCG({
        host: host,
        port: parseInt(port),
        autoConnect: false
      });

      await ccg.connect();

      // Get server info
      const info = await ccg.info();

      setConnection(prev => ({
        ...prev,
        isConnected: true,
        host,
        port: parseInt(port),
        oscPort: parseInt(oscPort),
        previewUrl: previewUrl || '',
        casparCG: ccg,
        serverInfo: info
      }));

      // Start OSC server
      const oscResult = await ipcRenderer.invoke('osc:start', parseInt(oscPort));
      if (oscResult.success) {
        setOscConnected(true);
        console.log('OSC Server started on port', oscPort);
      } else {
        console.warn('Failed to start OSC server:', oscResult.error);
      }

      console.log('Connected to CasparCG:', info);
      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      setConnection(prev => ({
        ...prev,
        isConnected: false,
        casparCG: null
      }));
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    const { ipcRenderer } = window.require('electron');

    if (connection.casparCG) {
      connection.casparCG.disconnect();
    }

    // Stop OSC server
    await ipcRenderer.invoke('osc:stop');
    setOscConnected(false);

    setConnection(prev => ({
      ...prev,
      isConnected: false,
      casparCG: null,
      serverInfo: null
    }));
  }, [connection.casparCG]);

  // Channel Management
  const addChannel = useCallback(() => {
    const newChannel = {
      id: state.channels.length + 1,
      name: `Channel ${state.channels.length + 1}`,
      layers: [createNewLayer(1)],
      expanded: false
    };

    setState(prev => ({
      ...prev,
      channels: [...prev.channels, newChannel]
    }));
  }, [state.channels]);

  const deleteChannel = useCallback((channelId) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.filter(ch => ch.id !== channelId)
    }));
  }, []);

  const addLayer = useCallback((channelId) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          const newLayer = createNewLayer(ch.layers.length + 1);
          return {
            ...ch,
            layers: [...ch.layers, newLayer]
          };
        }
        return ch;
      })
    }));
  }, []);

  const createNewLayer = (layerId) => ({
    id: layerId,
    playlist: [],
    currentIndex: -1,
    playlistMode: false,
    loopMode: false,
    loopItem: false,
    currentTime: 0,
    totalTime: 0,
    isPlaying: false
  });

  // Playlist Management
  const addMediaToPlaylist = useCallback((channelId, layerId, mediaFile) => {
    const playlistItem = {
      id: uuidv4(),
      type: 'media',
      name: mediaFile.name,
      path: mediaFile.path,
      duration: mediaFile.metadata?.duration || 0,
      resolution: mediaFile.metadata?.resolution || '',
      inPoint: null,
      outPoint: null,
      selected: false,
      playing: false
    };

    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId) {
                return {
                  ...layer,
                  playlist: [...layer.playlist, playlistItem]
                };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Delete layer
  const deleteLayer = useCallback((channelId, layerId) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.filter(layer => layer.id !== layerId)
          };
        }
        return ch;
      })
    }));
  }, []);

  // Select playlist item
  const selectPlaylistItem = useCallback((channelId, layerId, itemId) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId) {
                const itemIndex = layer.playlist.findIndex(item => item.id === itemId);
                return {
                  ...layer,
                  currentIndex: itemIndex,
                  playlist: layer.playlist.map((item, idx) => ({
                    ...item,
                    selected: idx === itemIndex
                  }))
                };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Remove playlist item
  const removePlaylistItem = useCallback((channelId, layerId, itemId) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId) {
                const newPlaylist = layer.playlist.filter(item => item.id !== itemId);
                const newIndex = layer.currentIndex >= newPlaylist.length
                  ? newPlaylist.length - 1
                  : layer.currentIndex;
                return {
                  ...layer,
                  playlist: newPlaylist,
                  currentIndex: newIndex
                };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Reorder playlist items
  const reorderPlaylistItems = useCallback((channelId, layerId, fromIndex, toIndex) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId) {
                const newPlaylist = [...layer.playlist];
                const [removed] = newPlaylist.splice(fromIndex, 1);
                newPlaylist.splice(toIndex, 0, removed);
                return {
                  ...layer,
                  playlist: newPlaylist
                };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Toggle playlist mode
  const togglePlaylistMode = useCallback((channelId, layerId) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId) {
                return { ...layer, playlistMode: !layer.playlistMode };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Toggle loop mode
  const toggleLoopMode = useCallback((channelId, layerId) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId) {
                return { ...layer, loopMode: !layer.loopMode };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Toggle loop item
  const toggleLoopItem = useCallback((channelId, layerId) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId) {
                return { ...layer, loopItem: !layer.loopItem };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Set in point for current item
  const setInPoint = useCallback((channelId, layerId, time) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId && layer.currentIndex >= 0) {
                return {
                  ...layer,
                  playlist: layer.playlist.map((item, idx) => {
                    if (idx === layer.currentIndex) {
                      return { ...item, inPoint: time };
                    }
                    return item;
                  })
                };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Set out point for current item
  const setOutPoint = useCallback((channelId, layerId, time) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId && layer.currentIndex >= 0) {
                return {
                  ...layer,
                  playlist: layer.playlist.map((item, idx) => {
                    if (idx === layer.currentIndex) {
                      return { ...item, outPoint: time };
                    }
                    return item;
                  })
                };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Clear in/out points for current item
  const clearInOutPoints = useCallback((channelId, layerId) => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId && layer.currentIndex >= 0) {
                return {
                  ...layer,
                  playlist: layer.playlist.map((item, idx) => {
                    if (idx === layer.currentIndex) {
                      return { ...item, inPoint: null, outPoint: null };
                    }
                    return item;
                  })
                };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Play item on CasparCG
  const playItem = useCallback(async (channelId, layerId, itemIndex = null) => {
    if (!connection.casparCG || !connection.isConnected) {
      console.warn('Not connected to CasparCG');
      return false;
    }

    const channel = state.channels.find(ch => ch.id === channelId);
    if (!channel) return false;

    const layer = channel.layers.find(l => l.id === layerId);
    if (!layer) return false;

    const index = itemIndex !== null ? itemIndex : layer.currentIndex;
    if (index < 0 || index >= layer.playlist.length) return false;

    const item = layer.playlist[index];

    try {
      await casparCommands.play(connection.casparCG, channelId, layerId, item.path, {
        loop: layer.loopItem,
        inPoint: item.inPoint,
        outPoint: item.outPoint
      });

      // Update state to reflect playing
      setState(prev => ({
        ...prev,
        channels: prev.channels.map(ch => {
          if (ch.id === channelId) {
            return {
              ...ch,
              layers: ch.layers.map(l => {
                if (l.id === layerId) {
                  return {
                    ...l,
                    isPlaying: true,
                    currentIndex: index,
                    playlist: l.playlist.map((pl, idx) => ({
                      ...pl,
                      playing: idx === index,
                      selected: idx === index
                    }))
                  };
                }
                return l;
              })
            };
          }
          return ch;
        })
      }));

      // Load next item in background if playlist mode
      if (layer.playlistMode && index < layer.playlist.length - 1) {
        const nextItem = layer.playlist[index + 1];
        await casparCommands.loadBg(connection.casparCG, channelId, layerId, nextItem.path, {
          auto: true,
          loop: layer.loopItem,
          inPoint: nextItem.inPoint,
          outPoint: nextItem.outPoint
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to play item:', error);
      return false;
    }
  }, [connection.casparCG, connection.isConnected, state.channels]);

  // Pause playback
  const pausePlayback = useCallback(async (channelId, layerId) => {
    if (!connection.casparCG || !connection.isConnected) return false;

    try {
      await casparCommands.pause(connection.casparCG, channelId, layerId);

      setState(prev => ({
        ...prev,
        channels: prev.channels.map(ch => {
          if (ch.id === channelId) {
            return {
              ...ch,
              layers: ch.layers.map(l => {
                if (l.id === layerId) {
                  return { ...l, isPlaying: false };
                }
                return l;
              })
            };
          }
          return ch;
        })
      }));

      return true;
    } catch (error) {
      console.error('Failed to pause:', error);
      return false;
    }
  }, [connection.casparCG, connection.isConnected]);

  // Resume playback
  const resumePlayback = useCallback(async (channelId, layerId) => {
    if (!connection.casparCG || !connection.isConnected) return false;

    try {
      await casparCommands.resume(connection.casparCG, channelId, layerId);

      setState(prev => ({
        ...prev,
        channels: prev.channels.map(ch => {
          if (ch.id === channelId) {
            return {
              ...ch,
              layers: ch.layers.map(l => {
                if (l.id === layerId) {
                  return { ...l, isPlaying: true };
                }
                return l;
              })
            };
          }
          return ch;
        })
      }));

      return true;
    } catch (error) {
      console.error('Failed to resume:', error);
      return false;
    }
  }, [connection.casparCG, connection.isConnected]);

  // Stop playback
  const stopPlayback = useCallback(async (channelId, layerId) => {
    if (!connection.casparCG || !connection.isConnected) return false;

    try {
      await casparCommands.stop(connection.casparCG, channelId, layerId);

      setState(prev => ({
        ...prev,
        channels: prev.channels.map(ch => {
          if (ch.id === channelId) {
            return {
              ...ch,
              layers: ch.layers.map(l => {
                if (l.id === layerId) {
                  return {
                    ...l,
                    isPlaying: false,
                    currentTime: 0,
                    playlist: l.playlist.map(item => ({ ...item, playing: false }))
                  };
                }
                return l;
              })
            };
          }
          return ch;
        })
      }));

      return true;
    } catch (error) {
      console.error('Failed to stop:', error);
      return false;
    }
  }, [connection.casparCG, connection.isConnected]);

  // Go to next item
  const nextItem = useCallback(async (channelId, layerId) => {
    const channel = state.channels.find(ch => ch.id === channelId);
    if (!channel) return;

    const layer = channel.layers.find(l => l.id === layerId);
    if (!layer || layer.playlist.length === 0) return;

    let nextIndex = layer.currentIndex + 1;
    if (nextIndex >= layer.playlist.length) {
      if (layer.loopMode) {
        nextIndex = 0;
      } else {
        return; // End of playlist
      }
    }

    await playItem(channelId, layerId, nextIndex);
  }, [state.channels, playItem]);

  // Go to previous item
  const prevItem = useCallback(async (channelId, layerId) => {
    const channel = state.channels.find(ch => ch.id === channelId);
    if (!channel) return;

    const layer = channel.layers.find(l => l.id === layerId);
    if (!layer || layer.playlist.length === 0) return;

    let prevIndex = layer.currentIndex - 1;
    if (prevIndex < 0) {
      if (layer.loopMode) {
        prevIndex = layer.playlist.length - 1;
      } else {
        prevIndex = 0;
      }
    }

    await playItem(channelId, layerId, prevIndex);
  }, [state.channels, playItem]);

  // Expand/collapse channel
  const toggleExpandChannel = useCallback((channelId) => {
    const channel = state.channels.find(ch => ch.id === channelId);
    if (channel) {
      setState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          currentView: prev.ui.currentView === 'multi' ? 'expanded' : 'multi',
          expandedChannel: prev.ui.currentView === 'multi' ? channelId : null
        }
      }));
    }
  }, [state.channels]);

  // Media browser
  const setMediaRoot = useCallback((path, tree) => {
    setState(prev => ({
      ...prev,
      media: {
        ...prev.media,
        rootPath: path,
        tree: tree
      }
    }));
  }, []);

  const selectMediaFile = useCallback((file) => {
    setState(prev => ({
      ...prev,
      media: {
        ...prev.media,
        selectedFile: file
      }
    }));
  }, []);

  // Toggle folder expand/collapse in media tree
  const toggleFolderExpand = useCallback((folderId) => {
    const updateTreeItem = (items) => {
      return items.map(item => {
        if (item.id === folderId && item.type === 'folder') {
          return { ...item, expanded: !item.expanded };
        }
        if (item.children) {
          return { ...item, children: updateTreeItem(item.children) };
        }
        return item;
      });
    };

    setState(prev => ({
      ...prev,
      media: {
        ...prev.media,
        tree: updateTreeItem(prev.media.tree)
      }
    }));
  }, []);

  // UI state
  const setSidebarTab = useCallback((tab) => {
    setState(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        sidebarTab: tab
      }
    }));
  }, []);

  // Macro management
  const createMacro = useCallback(async (macro) => {
    const { ipcRenderer } = window.require('electron');

    const newMacro = {
      ...macro,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await ipcRenderer.invoke('macro:save', newMacro.id, newMacro);

    setState(prev => ({
      ...prev,
      macros: [...prev.macros, newMacro]
    }));

    return newMacro;
  }, []);

  const updateMacro = useCallback(async (macro) => {
    const { ipcRenderer } = window.require('electron');

    const updatedMacro = {
      ...macro,
      updatedAt: new Date().toISOString()
    };

    await ipcRenderer.invoke('macro:save', macro.id, updatedMacro);

    setState(prev => ({
      ...prev,
      macros: prev.macros.map(m => m.id === macro.id ? updatedMacro : m)
    }));

    return updatedMacro;
  }, []);

  const deleteMacro = useCallback(async (macroId) => {
    const { ipcRenderer } = window.require('electron');

    await ipcRenderer.invoke('macro:delete', macroId);

    setState(prev => ({
      ...prev,
      macros: prev.macros.filter(m => m.id !== macroId)
    }));
  }, []);

  const executeMacro = useCallback(async (macro) => {
    if (!connection.casparCG || !connection.isConnected) {
      console.warn('Cannot execute macro: Not connected to CasparCG');
      return { success: false, error: 'Not connected' };
    }

    try {
      const result = await runMacro(macro, connection.casparCG);
      console.log('Macro executed:', result);
      return result;
    } catch (error) {
      console.error('Macro execution failed:', error);
      return { success: false, error: error.message };
    }
  }, [connection.casparCG, connection.isConnected]);

  const value = {
    state,
    setState,
    connection,
    setConnection,
    showConnectionDialog,
    setShowConnectionDialog,
    connectToCaspar,
    disconnect,
    addChannel,
    deleteChannel,
    addLayer,
    deleteLayer,
    addMediaToPlaylist,
    selectPlaylistItem,
    removePlaylistItem,
    reorderPlaylistItems,
    togglePlaylistMode,
    toggleLoopMode,
    toggleLoopItem,
    setInPoint,
    setOutPoint,
    clearInOutPoints,
    playItem,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    nextItem,
    prevItem,
    toggleExpandChannel,
    setMediaRoot,
    selectMediaFile,
    toggleFolderExpand,
    setSidebarTab,
    saveState,
    loadMacros,
    createMacro,
    updateMacro,
    deleteMacro,
    executeMacro
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
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
  const [showSettings, setShowSettings] = useState(false);
  const [oscConnected, setOscConnected] = useState(false);
  const [settings, setSettings] = useState({
    host: '127.0.0.1',
    port: 5250,
    oscPort: 6250,
    defaultImageDuration: 5,
    previewQuality: 50,
    networkCache: 500,
    previewPort: 9250,
    mediaFolderPath: ''
  });
  const [rundowns, setRundowns] = useState([]);
  const oscListenerRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const imageTimersRef = useRef({}); // Track image auto-advance timers by channel-layer key
  const lastTimeRef = useRef({}); // Track last time updates for completion detection

  // Load saved configuration
  useEffect(() => {
    loadConfig();
    loadMacros();
    loadRundownList();
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

  // Auto-advance to next item in playlist
  const autoAdvanceNext = useCallback((channelId, layerId) => {
    setState(prev => {
      const channel = prev.channels.find(ch => ch.id === channelId);
      if (!channel) return prev;

      const layer = channel.layers.find(l => l.id === layerId);
      if (!layer || !layer.playlistMode || layer.playlist.length === 0) return prev;

      let nextIndex = layer.currentIndex + 1;

      // Check if we're at the end
      if (nextIndex >= layer.playlist.length) {
        if (layer.loopMode) {
          nextIndex = 0; // Loop back to start
        } else {
          // End of playlist, stop
          return {
            ...prev,
            channels: prev.channels.map(ch => {
              if (ch.id !== channelId) return ch;
              return {
                ...ch,
                layers: ch.layers.map(l => {
                  if (l.id !== layerId) return l;
                  return {
                    ...l,
                    isPlaying: false,
                    playlist: l.playlist.map(item => ({ ...item, playing: false }))
                  };
                })
              };
            })
          };
        }
      }

      // Schedule the next item to play
      // We return updated state and trigger playback externally
      return {
        ...prev,
        channels: prev.channels.map(ch => {
          if (ch.id !== channelId) return ch;
          return {
            ...ch,
            layers: ch.layers.map(l => {
              if (l.id !== layerId) return l;
              return {
                ...l,
                pendingAutoAdvance: nextIndex
              };
            })
          };
        })
      };
    });
  }, []);

  const handleOscUpdate = useCallback((update) => {
    const { type, channel, layer } = update;
    const layerKey = `${channel}-${layer}`;

    // Track time updates for completion detection
    if (type === 'time') {
      const lastTime = lastTimeRef.current[layerKey];
      const timeRemaining = update.totalTime - update.currentTime;

      // Detect completion: total time > 0 and remaining time is very small
      if (update.totalTime > 0 && timeRemaining <= 0.1 && timeRemaining >= 0) {
        // Only trigger once per completion
        if (!lastTime || lastTime.completed !== true) {
          lastTimeRef.current[layerKey] = { ...update, completed: true };
          // Trigger auto-advance
          autoAdvanceNext(channel, layer);
        }
      } else {
        lastTimeRef.current[layerKey] = { ...update, completed: false };
      }
    }

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

              case 'producer_type':
                // Track if current item is an image for duration timeout
                return {
                  ...l,
                  currentProducerType: update.producerType,
                  isImage: update.isImage
                };

              default:
                return l;
            }
          })
        };
      })
    }));
  }, [autoAdvanceNext]);

  // Auto-save state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveState();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [state]);

  // Heartbeat to detect connection loss
  useEffect(() => {
    // Clear any existing heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    // Only start heartbeat if connected
    if (connection.isConnected && connection.casparCG) {
      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          await connection.casparCG.info();
        } catch (error) {
          console.error('Heartbeat failed, connection lost:', error);
          // Connection lost - update state
          setConnection(prev => ({
            ...prev,
            isConnected: false,
            casparCG: null,
            serverInfo: null
          }));
          // Clear heartbeat interval
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        }
      }, 5000); // Check every 5 seconds
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [connection.isConnected, connection.casparCG]);

  // Process pending auto-advance
  useEffect(() => {
    if (!connection.casparCG || !connection.isConnected) return;

    state.channels.forEach(channel => {
      channel.layers.forEach(async layer => {
        if (layer.pendingAutoAdvance !== undefined && layer.pendingAutoAdvance !== null) {
          const nextIndex = layer.pendingAutoAdvance;
          const nextItem = layer.playlist[nextIndex];

          if (nextItem) {
            try {
              // Import casparCommands dynamically to avoid circular dependencies
              await casparCommands.play(connection.casparCG, channel.id, layer.id, nextItem.path, {
                loop: layer.loopItem,
                inPoint: nextItem.inPoint,
                outPoint: nextItem.outPoint
              });

              // Update state to reflect playing
              setState(prev => ({
                ...prev,
                channels: prev.channels.map(ch => {
                  if (ch.id !== channel.id) return ch;
                  return {
                    ...ch,
                    layers: ch.layers.map(l => {
                      if (l.id !== layer.id) return l;
                      return {
                        ...l,
                        pendingAutoAdvance: null,
                        isPlaying: true,
                        currentIndex: nextIndex,
                        playlist: l.playlist.map((pl, idx) => ({
                          ...pl,
                          playing: idx === nextIndex,
                          selected: idx === nextIndex
                        }))
                      };
                    })
                  };
                })
              }));

              // Load next item in background if playlist mode
              if (layer.playlistMode && nextIndex < layer.playlist.length - 1) {
                const bgItem = layer.playlist[nextIndex + 1];
                await casparCommands.loadBg(connection.casparCG, channel.id, layer.id, bgItem.path, {
                  auto: true,
                  loop: layer.loopItem,
                  inPoint: bgItem.inPoint,
                  outPoint: bgItem.outPoint
                });
              }
            } catch (error) {
              console.error('Auto-advance playback failed:', error);
              // Clear pending flag on error
              setState(prev => ({
                ...prev,
                channels: prev.channels.map(ch => {
                  if (ch.id !== channel.id) return ch;
                  return {
                    ...ch,
                    layers: ch.layers.map(l => {
                      if (l.id !== layer.id) return l;
                      return { ...l, pendingAutoAdvance: null };
                    })
                  };
                })
              }));
            }
          }
        }
      });
    });
  }, [state.channels, connection.casparCG, connection.isConnected]);

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
      if (config.settings) {
        setSettings(prev => ({ ...prev, ...config.settings }));
        // Also load media folder path into media state
        if (config.settings.mediaFolderPath) {
          setState(prev => ({
            ...prev,
            media: {
              ...prev.media,
              rootPath: config.settings.mediaFolderPath
            }
          }));
        }
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
      },
      settings
    });
  };

  const updateSettings = useCallback(async (newSettings) => {
    const { ipcRenderer } = window.require('electron');
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    // Save settings immediately
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
      },
      settings: updatedSettings
    });

    return updatedSettings;
  }, [settings, connection, state.channels, state.ui]);

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

      // Listen for disconnect events
      ccg.on('disconnect', () => {
        console.log('CasparCG disconnected');
        setConnection(prev => ({
          ...prev,
          isConnected: false,
          casparCG: null,
          serverInfo: null
        }));
      });

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
    isPlaying: false,
    selectedItems: [],      // Array of selected item IDs for multi-select
    deletedItems: []        // Undo stack for deleted items
  });

  // Compute relative path from media root
  const computeRelativePath = useCallback((fullPath, mediaRoot) => {
    if (!mediaRoot || !fullPath) return null;
    // Normalize path separators
    const normalizedFull = fullPath.replace(/\\/g, '/');
    const normalizedRoot = mediaRoot.replace(/\\/g, '/');
    if (normalizedFull.startsWith(normalizedRoot)) {
      let relativePath = normalizedFull.substring(normalizedRoot.length);
      // Remove leading slash
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
      }
      // Remove file extension for CasparCG compatibility
      const lastDot = relativePath.lastIndexOf('.');
      if (lastDot > 0) {
        relativePath = relativePath.substring(0, lastDot);
      }
      return relativePath;
    }
    return null;
  }, []);

  // Playlist Management
  const addMediaToPlaylist = useCallback((channelId, layerId, mediaFile) => {
    // Compute relative path from media root
    const relativePath = computeRelativePath(mediaFile.path, state.media.rootPath);

    // Determine media type from file extension or metadata
    const fileType = mediaFile.type || getFileType(mediaFile.name);

    const playlistItem = {
      id: uuidv4(),
      type: fileType,
      name: mediaFile.name,
      path: mediaFile.path,
      relativePath: relativePath,
      duration: mediaFile.metadata?.duration || (fileType === 'image' ? settings.defaultImageDuration : 0),
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
  }, [state.media.rootPath, settings.defaultImageDuration, computeRelativePath]);

  // Helper to determine file type from filename
  const getFileType = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tga', 'tiff'];
    const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac'];
    if (videoExts.includes(ext)) return 'video';
    if (imageExts.includes(ext)) return 'image';
    if (audioExts.includes(ext)) return 'audio';
    return 'media';
  };

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

  // Update item duration (for images)
  const updateItemDuration = useCallback((channelId, layerId, itemId, duration) => {
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
                  playlist: layer.playlist.map(item => {
                    if (item.id === itemId) {
                      return { ...item, duration: parseFloat(duration) || 0 };
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

  // Select playlist items (for multi-select)
  const selectPlaylistItems = useCallback((channelId, layerId, itemIds, mode = 'replace') => {
    setState(prev => ({
      ...prev,
      channels: prev.channels.map(ch => {
        if (ch.id === channelId) {
          return {
            ...ch,
            layers: ch.layers.map(layer => {
              if (layer.id === layerId) {
                let newSelectedItems;
                if (mode === 'replace') {
                  newSelectedItems = itemIds;
                } else if (mode === 'toggle') {
                  // Toggle selection of specified items
                  newSelectedItems = [...layer.selectedItems];
                  itemIds.forEach(id => {
                    const index = newSelectedItems.indexOf(id);
                    if (index >= 0) {
                      newSelectedItems.splice(index, 1);
                    } else {
                      newSelectedItems.push(id);
                    }
                  });
                } else if (mode === 'add') {
                  newSelectedItems = [...new Set([...layer.selectedItems, ...itemIds])];
                }
                return { ...layer, selectedItems: newSelectedItems };
              }
              return layer;
            })
          };
        }
        return ch;
      })
    }));
  }, []);

  // Delete selected items with undo support
  const deleteSelectedItems = useCallback((channelId, layerId) => {
    setState(prev => {
      const channel = prev.channels.find(ch => ch.id === channelId);
      if (!channel) return prev;

      const layer = channel.layers.find(l => l.id === layerId);
      if (!layer || layer.selectedItems.length === 0) return prev;

      // Find items to delete
      const itemsToDelete = layer.playlist.filter(item => layer.selectedItems.includes(item.id));
      if (itemsToDelete.length === 0) return prev;

      // Save deleted items for undo (with their indices)
      const deletedBatch = {
        items: itemsToDelete.map(item => ({
          item,
          index: layer.playlist.findIndex(p => p.id === item.id)
        })),
        timestamp: Date.now()
      };

      return {
        ...prev,
        channels: prev.channels.map(ch => {
          if (ch.id === channelId) {
            return {
              ...ch,
              layers: ch.layers.map(l => {
                if (l.id === layerId) {
                  return {
                    ...l,
                    playlist: l.playlist.filter(item => !layer.selectedItems.includes(item.id)),
                    selectedItems: [],
                    deletedItems: [...l.deletedItems, deletedBatch].slice(-10) // Keep last 10 undo states
                  };
                }
                return l;
              })
            };
          }
          return ch;
        })
      };
    });
  }, []);

  // Undo last delete operation
  const undoDelete = useCallback((channelId, layerId) => {
    setState(prev => {
      const channel = prev.channels.find(ch => ch.id === channelId);
      if (!channel) return prev;

      const layer = channel.layers.find(l => l.id === layerId);
      if (!layer || layer.deletedItems.length === 0) return prev;

      // Pop last deleted batch
      const lastBatch = layer.deletedItems[layer.deletedItems.length - 1];

      // Restore items at their original positions
      const newPlaylist = [...layer.playlist];
      lastBatch.items
        .sort((a, b) => a.index - b.index) // Insert in order
        .forEach(({ item, index }) => {
          newPlaylist.splice(Math.min(index, newPlaylist.length), 0, item);
        });

      return {
        ...prev,
        channels: prev.channels.map(ch => {
          if (ch.id === channelId) {
            return {
              ...ch,
              layers: ch.layers.map(l => {
                if (l.id === layerId) {
                  return {
                    ...l,
                    playlist: newPlaylist,
                    deletedItems: l.deletedItems.slice(0, -1)
                  };
                }
                return l;
              })
            };
          }
          return ch;
        })
      };
    });
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

      // Handle image auto-advance with duration timeout
      const layerKey = `${channelId}-${layerId}`;
      if (imageTimersRef.current[layerKey]) {
        clearTimeout(imageTimersRef.current[layerKey]);
        delete imageTimersRef.current[layerKey];
      }

      // If it's an image and playlist mode is enabled, set auto-advance timeout
      if (item.type === 'image' && layer.playlistMode && item.duration > 0 && !layer.loopItem) {
        imageTimersRef.current[layerKey] = setTimeout(() => {
          autoAdvanceNext(channelId, layerId);
          delete imageTimersRef.current[layerKey];
        }, item.duration * 1000);
      }

      // Load next item in background if playlist mode (for videos)
      if (layer.playlistMode && index < layer.playlist.length - 1 && item.type !== 'image') {
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
  }, [connection.casparCG, connection.isConnected, state.channels, autoAdvanceNext]);

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
    // Handle null case - return to multi-channel view
    if (channelId === null) {
      setState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          currentView: 'multi',
          expandedChannel: null
        }
      }));
      return;
    }

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
    // Check if macro has any client commands
    const hasClientCommands = macro.commands?.some(cmd => cmd.type?.startsWith('CLIENT_'));

    // Only require connection for non-client-only macros
    if (!hasClientCommands && (!connection.casparCG || !connection.isConnected)) {
      console.warn('Cannot execute macro: Not connected to CasparCG');
      return { success: false, error: 'Not connected' };
    }

    try {
      // Create app context object for client commands
      const appContext = {
        togglePlaylistMode,
        toggleLoopMode,
        toggleLoopItem,
        addChannel,
        addLayer,
        nextItem,
        prevItem,
        loadRundown
      };

      const result = await runMacro(macro, connection.casparCG, { appContext });
      console.log('Macro executed:', result);
      return result;
    } catch (error) {
      console.error('Macro execution failed:', error);
      return { success: false, error: error.message };
    }
  }, [connection.casparCG, connection.isConnected, togglePlaylistMode, toggleLoopMode, toggleLoopItem, addChannel, addLayer, nextItem, prevItem]);

  // Rundown management
  const loadRundownList = async () => {
    const { ipcRenderer } = window.require('electron');
    const list = await ipcRenderer.invoke('rundown:list');
    setRundowns(list);
  };

  const saveRundown = useCallback(async (name) => {
    const { ipcRenderer } = window.require('electron');
    const rundownData = {
      channels: state.channels,
      ui: state.ui
    };
    const result = await ipcRenderer.invoke('rundown:save', name, rundownData);
    if (result.success) {
      await loadRundownList();
    }
    return result;
  }, [state.channels, state.ui]);

  const loadRundown = useCallback(async (name) => {
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('rundown:load', name);
    if (result.success && result.data) {
      setState(prev => ({
        ...prev,
        channels: result.data.channels || [],
        ui: {
          ...prev.ui,
          ...result.data.ui
        }
      }));
      return { success: true };
    }
    return result;
  }, []);

  const deleteRundown = useCallback(async (name) => {
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('rundown:delete', name);
    if (result.success) {
      await loadRundownList();
    }
    return result;
  }, []);

  const value = {
    state,
    setState,
    connection,
    setConnection,
    showConnectionDialog,
    setShowConnectionDialog,
    showSettings,
    setShowSettings,
    settings,
    updateSettings,
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
    updateItemDuration,
    selectPlaylistItems,
    deleteSelectedItems,
    undoDelete,
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
    executeMacro,
    rundowns,
    loadRundownList,
    saveRundown,
    loadRundown,
    deleteRundown
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
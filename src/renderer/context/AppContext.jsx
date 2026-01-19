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
  },
  activeStreams: {},  // { [channelId]: { streamUrl, relayPort, isActive } }
  autoConnectTrigger: 0,  // Increment to signal auto-connect for previews
  autoConnectChannelId: null  // Which channel to auto-connect: null, 'all', or specific channelId
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
    mediaFolderPath: '',
    // New MSE streaming settings
    previewScale: '384:216',
    previewPreset: 'ultrafast',
    previewTune: 'zerolatency',
    previewAudioBitrate: '128k',
    // Session and preview settings
    autoLoadLastSession: true,  // Auto-load last session on startup
    autoConnectPreviews: false  // Auto-connect previews when loading rundowns
  });
  const [rundowns, setRundowns] = useState([]);
  const oscListenerRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const imageTimersRef = useRef({}); // Track image auto-advance timers by channel-layer key
  const lastTimeRef = useRef({}); // Track last time updates for completion detection

  // Refs to track current state for the quit handler (avoids stale closure)
  const settingsRef = useRef(settings);
  const stateRef = useRef(state);

  // Keep refs updated when state changes
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
          // End of playlist, stop - clear ALL playing flags
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
                    currentIndex: -1,
                    playlist: l.playlist.map(item => ({ ...item, playing: false }))
                  };
                })
              };
            })
          };
        }
      }

      // Update currentIndex AND playing flags immediately (not just pendingAutoAdvance)
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
                currentIndex: nextIndex,
                pendingAutoAdvance: nextIndex,
                playlist: l.playlist.map((item, idx) => ({
                  ...item,
                  playing: idx === nextIndex,
                  selected: idx === nextIndex
                }))
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

    setState(prev => {
      // Find the channel and layer to get current playlist item duration
      const ch = prev.channels.find(c => c.id === channel);
      const l = ch?.layers.find(la => la.id === layer);

      // Get totalTime from OSC or fall back to current playlist item's duration
      let effectiveTotalTime = update.totalTime;
      if (type === 'time' && (effectiveTotalTime === null || effectiveTotalTime === undefined)) {
        // Use the current playlist item's duration from metadata
        if (l && l.currentIndex >= 0 && l.playlist[l.currentIndex]) {
          const currentItem = l.playlist[l.currentIndex];
          effectiveTotalTime = currentItem.metadata?.duration || currentItem.duration || l.totalTime || 0;
        } else {
          effectiveTotalTime = l?.totalTime || 0;
        }
      }

      // Track time updates for completion detection
      if (type === 'time' && effectiveTotalTime > 0) {
        const lastTime = lastTimeRef.current[layerKey];
        const timeRemaining = effectiveTotalTime - update.currentTime;

        // Detect completion: total time > 0 and remaining time is very small
        if (timeRemaining <= 0.1 && timeRemaining >= 0) {
          // Only trigger once per completion
          if (!lastTime || lastTime.completed !== true) {
            lastTimeRef.current[layerKey] = { ...update, totalTime: effectiveTotalTime, completed: true };
            // Trigger auto-advance (schedule outside setState to avoid nested updates)
            setTimeout(() => autoAdvanceNext(channel, layer), 0);
          }
        } else {
          lastTimeRef.current[layerKey] = { ...update, totalTime: effectiveTotalTime, completed: false };
        }
      }

      return {
        ...prev,
        channels: prev.channels.map(ch => {
          if (ch.id !== channel) return ch;

          return {
            ...ch,
            layers: ch.layers.map(l => {
              if (l.id !== layer) return l;

              switch (type) {
                case 'time':
                  // Get totalTime from OSC or playlist item duration
                  let totalTime = update.totalTime;
                  if (totalTime === null || totalTime === undefined) {
                    if (l.currentIndex >= 0 && l.playlist[l.currentIndex]) {
                      const currentItem = l.playlist[l.currentIndex];
                      totalTime = currentItem.metadata?.duration || currentItem.duration || l.totalTime || 0;
                    } else {
                      totalTime = l.totalTime || 0;
                    }
                  }
                  return {
                    ...l,
                    currentTime: update.currentTime,
                    totalTime: totalTime
                  };

                case 'frame':
                  return {
                    ...l,
                    currentFrame: update.currentFrame,
                    totalFrames: update.totalFrames ?? l.totalFrames
                  };

                case 'paused':
                  // Only update isPaused from OSC - don't touch isPlaying
                  // isPlaying is controlled by user actions (play/stop commands)
                  // This prevents OSC from incorrectly setting isPlaying=true when layer is empty
                  return {
                    ...l,
                    isPaused: update.isPaused
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
      };
    });
  }, [autoAdvanceNext]);

  // Save settings on app close (only settings, not channel state)
  // Uses refs to access current state values, avoiding stale closure issues
  useEffect(() => {
    const { ipcRenderer } = window.require('electron');

    const handleBeforeQuit = async () => {
      // Use refs to get current values, not stale closure values
      const currentSettings = settingsRef.current;
      const currentState = stateRef.current;

      // Save current settings
      await ipcRenderer.invoke('config:save', {
        connection: {
          host: connection.host,
          port: connection.port,
          oscPort: connection.oscPort,
          previewUrl: connection.previewUrl
        },
        settings: currentSettings
      });

      // Auto-save current rundown as LastSession, or delete it if empty
      if (currentState.channels.length > 0) {
        // Inline the save logic to use current state from ref
        const channelsToSave = currentState.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          expanded: channel.expanded,
          layers: channel.layers.map(layer => ({
            id: layer.id,
            playlist: layer.playlist.map(item => ({
              id: item.id,
              type: item.type,
              name: item.name,
              path: item.path,
              relativePath: item.relativePath,
              duration: item.duration,
              resolution: item.resolution,
              frameRate: item.frameRate,
              inPointFrames: item.inPointFrames,
              outPointFrames: item.outPointFrames,
              inPoint: item.inPoint,
              outPoint: item.outPoint
            })),
            currentIndex: layer.currentIndex,
            playlistMode: layer.playlistMode,
            loopMode: layer.loopMode,
            loopItem: layer.loopItem,
            selectedItems: layer.selectedItems || []
          }))
        }));

        const rundownData = {
          channels: channelsToSave,
          ui: { expandedChannel: currentState.ui.expandedChannel }
        };

        await ipcRenderer.invoke('rundown:save', '__LastSession__', rundownData);
      } else {
        // Delete LastSession if closing with no channels
        await ipcRenderer.invoke('rundown:delete', '__LastSession__');
      }

      ipcRenderer.send('app:state-saved');
    };

    ipcRenderer.on('app:before-quit', handleBeforeQuit);

    // Also save on browser beforeunload for extra safety
    const handleBeforeUnload = () => {
      // Sync save using current ref values
      const currentSettings = settingsRef.current;
      ipcRenderer.invoke('config:save', {
        connection: {
          host: connection.host,
          port: connection.port,
          oscPort: connection.oscPort,
          previewUrl: connection.previewUrl
        },
        settings: currentSettings
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      ipcRenderer.removeListener('app:before-quit', handleBeforeQuit);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [connection.host, connection.port, connection.oscPort, connection.previewUrl]);

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
              await casparCommands.play(connection.casparCG, channel.id, layer.id, nextItem, {
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
                await casparCommands.loadBg(connection.casparCG, channel.id, layer.id, bgItem, {
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

  // Load config: Only loads connection settings and app settings (not channel state)
  // Channel state is loaded separately via rundowns
  const loadConfig = async () => {
    const { ipcRenderer } = window.require('electron');
    const config = await ipcRenderer.invoke('config:load');

    if (config) {
      // Load connection settings
      if (config.connection) {
        setConnection(prev => ({ ...prev, ...config.connection }));
      }
      // NOTE: config.state (channels) is NOT loaded here - app starts with empty channels
      // User should explicitly load a rundown if they want to restore channel state

      // Load app settings
      if (config.settings) {
        setSettings(prev => ({ ...prev, ...config.settings }));
        // Scan and load media folder if path is saved
        if (config.settings.mediaFolderPath) {
          try {
            const result = await ipcRenderer.invoke('media:scanFolder', config.settings.mediaFolderPath);
            if (result.success) {
              setState(prev => ({
                ...prev,
                media: {
                  ...prev.media,
                  rootPath: config.settings.mediaFolderPath,
                  tree: result.tree
                }
              }));
              // Start watching for changes
              await ipcRenderer.invoke('media:watchFolder', config.settings.mediaFolderPath);
            } else {
              // Folder scan failed, just set the path
              setState(prev => ({
                ...prev,
                media: {
                  ...prev.media,
                  rootPath: config.settings.mediaFolderPath
                }
              }));
            }
          } catch (err) {
            console.error('Error loading media folder:', err);
            // Set path anyway for UI display
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

      // Auto-load LastSession if setting enabled
      if (config.settings?.autoLoadLastSession !== false) {
        try {
          const lastSessionResult = await ipcRenderer.invoke('rundown:load', '__LastSession__');
          if (lastSessionResult.success && lastSessionResult.data) {
            const channelsWithState = (lastSessionResult.data.channels || []).map(channel => ({
              ...channel,
              layers: channel.layers.map(layer => ({
                ...layer,
                isPlaying: false,
                isPaused: false,
                currentTime: 0,
                totalTime: 0,
                currentFrame: 0,
                totalFrames: 0,
                deletedItems: layer.deletedItems || [],
                playlist: layer.playlist.map(item => ({
                  ...item,
                  selected: false,
                  playing: false
                }))
              }))
            }));

            setState(prev => ({
              ...prev,
              channels: channelsWithState,
              ui: { ...prev.ui, ...lastSessionResult.data.ui },
              // Trigger auto-connect for ALL channels if setting enabled
              autoConnectTrigger: config.settings?.autoConnectPreviews ? (prev.autoConnectTrigger || 0) + 1 : prev.autoConnectTrigger,
              autoConnectChannelId: config.settings?.autoConnectPreviews ? 'all' : null
            }));
          }
        } catch (err) {
          // No LastSession to restore - this is fine
        }
      }
    }
  };

  // Save settings only (connection + app settings, NOT channel state)
  // Channel state is saved separately via rundowns
  const saveSettings = async () => {
    const { ipcRenderer } = window.require('electron');
    await ipcRenderer.invoke('config:save', {
      connection: {
        host: connection.host,
        port: connection.port,
        oscPort: connection.oscPort,
        previewUrl: connection.previewUrl
      },
      settings: settings
    });
  };

  const updateSettings = useCallback(async (newSettings) => {
    const { ipcRenderer } = window.require('electron');
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    // Save settings immediately (only connection + settings, not channel state)
    await ipcRenderer.invoke('config:save', {
      connection: {
        host: connection.host,
        port: connection.port,
        oscPort: connection.oscPort,
        previewUrl: connection.previewUrl
      },
      settings: updatedSettings
    });

    return updatedSettings;
  }, [settings, connection]);

  const loadMacros = async () => {
    const { ipcRenderer } = window.require('electron');
    const macros = await ipcRenderer.invoke('macro:list');
    setState(prev => ({ ...prev, macros }));
  };

  // CasparCG Connection
  const connectToCaspar = useCallback(async (host, port, oscPort, previewUrl = '') => {
    const { ipcRenderer } = window.require('electron');

    try {
      // Disconnect any existing connection first
      setConnection(prev => {
        if (prev.casparCG) {
          try {
            prev.casparCG.disconnect();
          } catch (e) {
            console.log('Error disconnecting previous connection:', e);
          }
        }
        return { ...prev, isConnected: false, casparCG: null };
      });

      const ccg = new CasparCG({
        host: host,
        port: parseInt(port),
        autoConnect: false
      });

      await ccg.connect();

      // Get server version
      let serverInfo = { version: 'Unknown' };

      // Use VERSION command to get server version
      // casparcg-connection v6.3.3 returns an object with a .request property that resolves to the response
      try {
        const versionResult = await ccg.version();

        // The library returns { request: Promise<response>, ... }
        // We need to await the request to get the actual response
        if (versionResult && versionResult.request) {
          const response = await versionResult.request;
          if (response && response.data) {
            // response.data.fullVersion contains the full version string
            if (response.data.fullVersion) {
              serverInfo.version = response.data.fullVersion;
            } else if (typeof response.data === 'string') {
              // Fallback: extract version from string
              const versionMatch = response.data.match(/(\d+\.\d+\.\d+)/);
              if (versionMatch) {
                serverInfo.version = versionMatch[1];
              }
            }
          }
        } else if (versionResult && !versionResult.error) {
          // Some library versions return the response directly
          if (versionResult.response && versionResult.response.data) {
            const data = versionResult.response.data;
            if (data.fullVersion) {
              serverInfo.version = data.fullVersion;
            } else if (typeof data === 'string') {
              const versionMatch = data.match(/(\d+\.\d+\.\d+)/);
              if (versionMatch) {
                serverInfo.version = versionMatch[1];
              }
            }
          }
        }
      } catch (versionErr) {
        console.log('VERSION command failed:', versionErr);
      }

      setConnection(prev => ({
        ...prev,
        isConnected: true,
        host,
        port: parseInt(port),
        oscPort: parseInt(oscPort),
        previewUrl: previewUrl || '',
        casparCG: ccg,
        serverInfo
      }));

      // Now set up listeners AFTER successful connection
      ccg.on('disconnect', () => {
        console.log('CasparCG disconnected');
        setConnection(prev => ({
          ...prev,
          isConnected: false,
          casparCG: null,
          serverInfo: null
        }));
      });

      ccg.on('error', (err) => {
        console.error('CasparCG connection error:', err);
        // Check if this is still our active connection before disconnecting
        setConnection(prev => {
          if (prev.casparCG === ccg) {
            return {
              ...prev,
              isConnected: false,
              casparCG: null,
              serverInfo: null
            };
          }
          return prev;
        });
      });

      // Start OSC server
      const oscResult = await ipcRenderer.invoke('osc:start', parseInt(oscPort));
      if (oscResult.success) {
        setOscConnected(true);
        console.log('OSC Server started on port', oscPort);
      } else {
        console.warn('Failed to start OSC server:', oscResult.error);
      }

      console.log('Connected to CasparCG:', serverInfo);
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
    const newChannelId = state.channels.length + 1;
    const newChannel = {
      id: newChannelId,
      name: `Channel ${newChannelId}`,
      layers: [createNewLayer(1)],
      expanded: false
    };

    setState(prev => ({
      ...prev,
      channels: [...prev.channels, newChannel],
      // Trigger auto-connect for ONLY the new channel if setting enabled
      autoConnectTrigger: settings.autoConnectPreviews ? (prev.autoConnectTrigger || 0) + 1 : prev.autoConnectTrigger,
      autoConnectChannelId: settings.autoConnectPreviews ? newChannelId : null
    }));
  }, [state.channels, settings.autoConnectPreviews]);

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
    isPaused: false,        // Track paused state for proper resume
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
  const addMediaToPlaylist = useCallback(async (channelId, layerId, mediaFile) => {
    const { ipcRenderer } = window.require('electron');

    // Compute relative path from media root
    const relativePath = computeRelativePath(mediaFile.path, state.media.rootPath);

    // Determine media type from file extension or metadata
    const fileType = mediaFile.type || getFileType(mediaFile.name);

    // Get duration and frameRate from existing metadata or default
    let duration = mediaFile.metadata?.duration || (fileType === 'image' ? settings.defaultImageDuration : 0);
    let resolution = mediaFile.metadata?.resolution || '';
    let frameRate = mediaFile.metadata?.frameRate ?? 25; // Default to 25fps

    // If it's a video and we don't have duration, fetch metadata
    if (fileType === 'video' && !mediaFile.metadata?.duration) {
      try {
        const metadata = await ipcRenderer.invoke('media:getMetadata', mediaFile.path, 'video');
        if (metadata) {
          duration = metadata.duration || 0;
          resolution = metadata.resolution || '';
          frameRate = metadata.frameRate ?? 25;
        }
      } catch (err) {
        console.warn('Failed to get video metadata:', err);
      }
    }

    const itemId = uuidv4();

    const playlistItem = {
      id: itemId,
      type: fileType,
      name: mediaFile.name,
      path: mediaFile.path,
      relativePath: relativePath,
      duration,
      resolution,
      frameRate,
      inPointFrames: null,  // Store in/out as frames for precision
      outPointFrames: null,
      inPoint: null,  // Keep for backward compatibility (seconds)
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

  // Update item in/out points by itemId
  // Now accepts frame values (inPointFrames, outPointFrames)
  const updateItemInOutPoints = useCallback((channelId, layerId, itemId, inPointFrames, outPointFrames) => {
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
                      const frameRate = item.frameRate || 25;
                      // Convert frames to seconds for backward compatibility
                      const inPoint = inPointFrames !== null ? inPointFrames / frameRate : null;
                      const outPoint = outPointFrames !== null ? outPointFrames / frameRate : null;
                      return { ...item, inPointFrames, outPointFrames, inPoint, outPoint };
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
    setState(prev => {
      const channel = prev.channels.find(ch => ch.id === channelId);
      const layer = channel?.layers.find(l => l.id === layerId);
      const newPlaylistMode = !layer?.playlistMode;

      // If enabling playlist mode and current item is an image, set up timeout
      if (newPlaylistMode && layer?.isPlaying && layer?.currentIndex >= 0) {
        const currentItem = layer.playlist[layer.currentIndex];
        if (currentItem?.type === 'image' && currentItem?.duration > 0 && !layer.loopItem) {
          const layerKey = `${channelId}-${layerId}`;
          // Clear any existing timeout
          if (imageTimersRef.current[layerKey]) {
            clearTimeout(imageTimersRef.current[layerKey]);
          }
          // Set new timeout (using full duration since we don't track elapsed time)
          imageTimersRef.current[layerKey] = setTimeout(() => {
            // Re-check state when timeout fires
            setState(currentState => {
              const ch = currentState.channels.find(c => c.id === channelId);
              const ly = ch?.layers.find(l => l.id === layerId);
              if (ly?.playlistMode && !ly?.loopItem) {
                setTimeout(() => autoAdvanceNext(channelId, layerId), 0);
              }
              return currentState;
            });
            delete imageTimersRef.current[layerKey];
          }, currentItem.duration * 1000);
        }
      }

      return {
        ...prev,
        channels: prev.channels.map(ch => {
          if (ch.id === channelId) {
            return {
              ...ch,
              layers: ch.layers.map(l => {
                if (l.id === layerId) {
                  return { ...l, playlistMode: newPlaylistMode };
                }
                return l;
              })
            };
          }
          return ch;
        })
      };
    });
  }, [autoAdvanceNext]);

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
      // Pass item object so formatClipPath can use relativePath
      await casparCommands.play(connection.casparCG, channelId, layerId, item, {
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
                    isPaused: false,
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
          // Read current state to check if playlist mode is still enabled
          setState(currentState => {
            const ch = currentState.channels.find(c => c.id === channelId);
            const ly = ch?.layers.find(l => l.id === layerId);
            if (ly?.playlistMode && !ly?.loopItem) {
              // Trigger advance after returning state unchanged
              setTimeout(() => autoAdvanceNext(channelId, layerId), 0);
            }
            return currentState; // Return unchanged
          });
          delete imageTimersRef.current[layerKey];
        }, item.duration * 1000);
      }

      // Load next item in background if playlist mode (for videos)
      if (layer.playlistMode && index < layer.playlist.length - 1 && item.type !== 'image') {
        const nextItem = layer.playlist[index + 1];
        await casparCommands.loadBg(connection.casparCG, channelId, layerId, nextItem, {
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
                  return { ...l, isPlaying: false, isPaused: true };
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
                  return { ...l, isPlaying: true, isPaused: false };
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
                  // Get the currently playing item to make it the selection
                  const playingItem = l.currentIndex >= 0 ? l.playlist[l.currentIndex] : null;
                  return {
                    ...l,
                    isPlaying: false,
                    isPaused: false,
                    currentTime: 0,
                    currentIndex: -1,  // Reset active (green) state
                    selectedItems: playingItem ? [playingItem.id] : [],  // Make stopped item the selection (blue)
                    playlist: l.playlist.map(item => ({ ...item, playing: false, selected: false }))
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

  const setExpandedPreviewHeight = useCallback((height) => {
    setState(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        previewSize: Math.max(200, Math.min(800, height)) // Clamp between 200-800px
      }
    }));
  }, []);

  // Stream tracking for preview persistence across view changes
  // Player instances are stored in playerStore.js (module-level Map) to persist across unmount/remount
  const setStreamActive = useCallback((channelId, streamUrl, relayPort) => {
    setState(prev => ({
      ...prev,
      activeStreams: {
        ...prev.activeStreams,
        [channelId]: { streamUrl, relayPort, isActive: true }
      }
    }));
  }, []);

  const setStreamInactive = useCallback((channelId) => {
    setState(prev => {
      const newActiveStreams = { ...prev.activeStreams };
      delete newActiveStreams[channelId];
      return {
        ...prev,
        activeStreams: newActiveStreams
      };
    });
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

  // Save rundown: Saves channel/layer CONFIGURATION only, not runtime state
  // Runtime state (isPlaying, isPaused, currentTime, etc.) comes from CasparCG via OSC
  const saveRundown = useCallback(async (name) => {
    const { ipcRenderer } = window.require('electron');

    // Strip runtime state from channels/layers - only save configuration
    const channelsToSave = state.channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      expanded: channel.expanded,
      layers: channel.layers.map(layer => ({
        id: layer.id,
        playlist: layer.playlist.map(item => ({
          // Save playlist item configuration
          id: item.id,
          type: item.type,
          name: item.name,
          path: item.path,
          relativePath: item.relativePath,
          duration: item.duration,
          resolution: item.resolution,
          frameRate: item.frameRate,
          inPointFrames: item.inPointFrames,
          outPointFrames: item.outPointFrames,
          inPoint: item.inPoint,
          outPoint: item.outPoint
          // NOT saving: selected, playing - these are runtime state
        })),
        currentIndex: layer.currentIndex,
        playlistMode: layer.playlistMode,
        loopMode: layer.loopMode,
        loopItem: layer.loopItem,
        selectedItems: layer.selectedItems || []
        // NOT saving: isPlaying, isPaused, currentTime, totalTime, currentFrame, totalFrames
        // These are runtime state from CasparCG via OSC
      }))
    }));

    const rundownData = {
      channels: channelsToSave,
      ui: {
        expandedChannel: state.ui.expandedChannel
      }
    };
    const result = await ipcRenderer.invoke('rundown:save', name, rundownData);
    if (result.success) {
      await loadRundownList();
    }
    return result;
  }, [state.channels, state.ui]);

  // Load rundown: Loads channel/layer configuration, initializes all layers as stopped
  // Playing state will only come from CasparCG via OSC - user must manually trigger playback
  const loadRundown = useCallback(async (name) => {
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('rundown:load', name);
    if (result.success && result.data) {
      // Initialize runtime state for all loaded channels/layers
      const channelsWithState = (result.data.channels || []).map(channel => ({
        ...channel,
        layers: channel.layers.map(layer => ({
          ...layer,
          // Initialize runtime state to stopped
          isPlaying: false,
          isPaused: false,
          currentTime: 0,
          totalTime: 0,
          currentFrame: 0,
          totalFrames: 0,
          deletedItems: layer.deletedItems || [],
          // Initialize playlist items as not playing/selected
          playlist: layer.playlist.map(item => ({
            ...item,
            selected: false,
            playing: false
          }))
        }))
      }));

      setState(prev => ({
        ...prev,
        channels: channelsWithState,
        ui: {
          ...prev.ui,
          ...result.data.ui
        },
        // Trigger auto-connect for ALL channels if setting enabled
        autoConnectTrigger: settings.autoConnectPreviews ? (prev.autoConnectTrigger || 0) + 1 : prev.autoConnectTrigger,
        autoConnectChannelId: settings.autoConnectPreviews ? 'all' : null
      }));
      return { success: true };
    }
    return result;
  }, [settings.autoConnectPreviews]);

  const deleteRundown = useCallback(async (name) => {
    const { ipcRenderer } = window.require('electron');
    const result = await ipcRenderer.invoke('rundown:delete', name);
    if (result.success) {
      await loadRundownList();
    }
    return result;
  }, []);

  // Clear all channels (new rundown)
  const clearAllChannels = useCallback(() => {
    setState(prev => ({
      ...prev,
      channels: [],
      ui: {
        ...prev.ui,
        currentView: 'multi',
        expandedChannel: null
      }
    }));
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
    updateItemInOutPoints,
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
    setExpandedPreviewHeight,
    setStreamActive,
    setStreamInactive,
    saveSettings,
    loadMacros,
    createMacro,
    updateMacro,
    deleteMacro,
    executeMacro,
    rundowns,
    loadRundownList,
    saveRundown,
    loadRundown,
    deleteRundown,
    clearAllChannels
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
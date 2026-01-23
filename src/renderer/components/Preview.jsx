import React, { useState, useRef, useEffect } from 'react';
import mpegts from 'mpegts.js';
import { useApp } from '../context/AppContext';
import './Preview.css';

export default function Preview({ channelId, expanded = false }) {
  const { connection, settings, setStreamActive, setStreamInactive, state } = useApp();
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const cleanupIntervalRef = useRef(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');
  const autoConnectTriggeredRef = useRef(0);

  // Manual SourceBuffer cleanup to prevent memory growth
  const cleanupSourceBuffer = () => {
    if (!playerRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const bufferSize = settings.previewBufferSize ?? 15;

    try {
      // Access mpegts.js internals to get SourceBuffers
      const msectl = playerRef.current._msectl;
      if (!msectl || !msectl._sourceBuffers) return;

      const currentTime = video.currentTime;
      const removeEnd = currentTime - bufferSize;

      // Only cleanup if we have data older than our buffer size
      if (removeEnd <= 0) return;

      // Iterate through all source buffers (video, audio)
      for (const type in msectl._sourceBuffers) {
        const sb = msectl._sourceBuffers[type];
        if (!sb || sb.updating) continue;

        try {
          // Check if there's data to remove
          if (sb.buffered && sb.buffered.length > 0) {
            const bufferedStart = sb.buffered.start(0);
            if (bufferedStart < removeEnd) {
              // Remove old data from start up to removeEnd
              sb.remove(bufferedStart, removeEnd);
              console.log(`[Preview ${channelId}] Cleaned ${(removeEnd - bufferedStart).toFixed(1)}s from ${type} buffer`);
            }
          }
        } catch (e) {
          // SourceBuffer might be updating or removed, ignore
        }
      }
    } catch (e) {
      // Ignore errors accessing internals
    }
  };

  // Start/stop cleanup interval based on connection state
  useEffect(() => {
    if (isConnected) {
      // Run cleanup every 2 seconds
      cleanupIntervalRef.current = setInterval(cleanupSourceBuffer, 2000);
    } else {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
    }

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
    };
  }, [isConnected, settings.previewBufferSize]);

  // Auto-connect when rundown loaded with setting enabled
  useEffect(() => {
    // Check if we should auto-connect this specific channel
    const shouldConnect = state.autoConnectChannelId === 'all' || state.autoConnectChannelId === channelId;

    if (state.autoConnectTrigger > 0 &&
        state.autoConnectTrigger !== autoConnectTriggeredRef.current &&
        shouldConnect &&
        !isConnected &&
        !isConnecting &&
        connection.isConnected &&
        settings.autoConnectPreviews) {
      autoConnectTriggeredRef.current = state.autoConnectTrigger;
      // Small delay to ensure state is settled
      setTimeout(() => {
        handleConnect();
      }, 100);
    }
  }, [state.autoConnectTrigger, state.autoConnectChannelId, channelId, isConnected, isConnecting, connection.isConnected, settings.autoConnectPreviews]);

  // Execute raw AMCP command
  const executeStreamCommand = async (command) => {
    const ccg = connection.casparCG;
    if (!ccg) throw new Error('Not connected');

    try {
      const result = await ccg.sendCustom({ command });
      if (result && result.request) {
        return await result.request;
      }
      return result;
    } catch (err) {
      console.error('sendCustom failed:', err);
      throw err;
    }
  };

  // Connect to stream (starts new relay and creates player)
  const handleConnect = async () => {
    if (!connection.casparCG || !connection.isConnected) return;

    const { ipcRenderer } = window.require('electron');
    setIsConnecting(true);
    setError(null);

    try {
      // Get settings
      const previewPort = settings.previewPort || 9250;
      const actualPort = previewPort + channelId - 1;

      // Start the stream relay server
      console.log(`[Preview ${channelId}] Starting stream relay on port ${actualPort}`);
      const relayResult = await ipcRenderer.invoke('stream:startRelay', channelId, actualPort);

      if (!relayResult.success) {
        throw new Error(relayResult.error || 'Failed to start stream relay');
      }

      const relayUrl = relayResult.streamUrl;
      setStreamUrl(relayUrl);
      console.log(`[Preview ${channelId}] Stream URL: ${relayUrl}`);

      // Build and send the ADD STREAM command to CasparCG with MPEGTS format
      const scale = settings.previewScale || '384:216';
      const preset = settings.previewPreset || 'ultrafast';
      const tune = settings.previewTune || 'zerolatency';
      // Quality: 0=worst (CRF 51), 100=best (CRF 18)
      const crf = Math.round(51 - (settings.previewQuality || 50) * 0.33);

      const casparUrl = relayUrl.replace('/stream', '/stream.ts');
      const streamCommand = `ADD ${channelId} STREAM "${casparUrl}" -format mpegts -codec:v libx264 -crf:v ${crf} -tune:v ${tune} -preset:v ${preset} -filter:v scale=${scale.replace(':', ':')} -filter:a "pan=stereo|c0=FL|c1=FR"`;

      console.log('[Preview] Sending MPEGTS stream command:', streamCommand);

      try {
        await executeStreamCommand(streamCommand);
      } catch (cmdErr) {
        console.warn('ADD STREAM command failed:', cmdErr);
        throw new Error('Failed to start CasparCG stream: ' + cmdErr.message);
      }

      // Give CasparCG a moment to start streaming
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create mpegts.js player
      if (!mpegts.isSupported()) {
        throw new Error('mpegts.js is not supported in this browser');
      }

      console.log(`[Preview ${channelId}] Creating mpegts.js player`);

      // Configure buffer settings based on user-specified buffer size (in seconds)
      const bufferSize = settings.previewBufferSize ?? 15;

      // Derive all settings from the buffer size
      // Lower buffer = more aggressive latency chasing, higher buffer = smoother playback
      const bufferConfig = {
        // Only enable latency chasing for small buffers (< 5 seconds)
        liveBufferLatencyChasing: bufferSize < 5,
        // Scale latency settings based on buffer size
        liveBufferLatencyMaxLatency: Math.max(0.5, bufferSize / 5),
        liveBufferLatencyMinRemain: Math.max(0.2, bufferSize / 15),
        lazyLoadMaxDuration: Math.max(0.3, bufferSize / 8),
        // Buffer cleanup settings
        autoCleanupMaxBackwardDuration: bufferSize,
        autoCleanupMinBackwardDuration: Math.max(1, Math.floor(bufferSize / 2)),
      };

      console.log(`[Preview ${channelId}] Using buffer size: ${bufferSize}s, latency chasing: ${bufferConfig.liveBufferLatencyChasing}`);

      const player = mpegts.createPlayer({
        type: 'mpegts',
        url: relayUrl,
        isLive: true,
        hasAudio: false,  // Ignore audio - CasparCG sends 16-channel HE-AAC which browsers can't decode
      }, {
        enableWorker: true,
        seekType: 'range',
        autoCleanupSourceBuffer: true,
        ...bufferConfig,
      });

      // Handle player events
      player.on(mpegts.Events.ERROR, (errorType, errorDetail, errorInfo) => {
        console.error(`[Preview ${channelId}] mpegts error:`, errorType, errorDetail, errorInfo);
        if (errorType === mpegts.ErrorTypes.NETWORK_ERROR) {
          setError('Network error - stream may have ended');
          // Clean up on network error to allow reconnection
          handleDisconnect();
        } else if (errorType === mpegts.ErrorTypes.MEDIA_ERROR) {
          setError('Media error - codec issue');
        } else {
          setError(`Playback error: ${errorDetail}`);
        }
      });

      player.on(mpegts.Events.LOADING_COMPLETE, () => {
        console.log(`[Preview ${channelId}] Loading complete`);
      });

      player.on(mpegts.Events.METADATA_ARRIVED, (metadata) => {
        console.log(`[Preview ${channelId}] Metadata arrived:`, metadata);
      });

      // Attach to video element and start playback
      player.attachMediaElement(videoRef.current);
      player.load();

      // Start playing
      try {
        await player.play();
        console.log(`[Preview ${channelId}] Playback started`);
      } catch (playErr) {
        console.warn(`[Preview ${channelId}] Autoplay failed, trying muted:`, playErr);
        videoRef.current.muted = true;
        await player.play();
      }

      // Store player in ref (component never unmounts now)
      playerRef.current = player;
      // Store metadata in context
      setStreamActive(channelId, relayUrl, actualPort);

      setIsConnected(true);
      setIsConnecting(false);

    } catch (err) {
      console.error('Failed to connect:', err);
      setError(err.message || 'Failed to connect');
      setIsConnecting(false);

      // Cleanup on error
      await ipcRenderer.invoke('stream:stopRelay', channelId);
    }
  };

  // Disconnect from stream (manual disconnect - destroys player and stops relay)
  const handleDisconnect = async () => {
    const { ipcRenderer } = window.require('electron');

    try {
      // Remove the stream consumer from CasparCG
      if (connection.casparCG && connection.isConnected && streamUrl) {
        try {
          const casparUrl = streamUrl.replace('/stream', '/stream.ts');
          await executeStreamCommand(`REMOVE ${channelId} STREAM "${casparUrl}"`);
        } catch (e) {
          console.log('Remove stream command failed (may be expected):', e);
        }
      }

      // Destroy the player completely
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.unload();
          playerRef.current.detachMediaElement();
          playerRef.current.destroy();
        } catch (err) {
          console.warn(`[Preview ${channelId}] Error destroying player:`, err);
        }
        playerRef.current = null;
      }

      // Clear video element
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.load();
      }

      // Stop the stream relay
      await ipcRenderer.invoke('stream:stopRelay', channelId);

      // Clear stream from context
      setStreamInactive(channelId);

    } catch (err) {
      console.error('Error disconnecting:', err);
    }

    setIsConnected(false);
    setStreamUrl('');
    setError(null);
    setIsConnecting(false);
  };

  // Handle video error
  const handleVideoError = () => {
    if (isConnected) {
      setError('Stream playback error');
    }
  };

  // Handle video stall - recover by seeking to live edge (only for small buffers)
  const handleVideoStalled = () => {
    if (isConnected && videoRef.current && playerRef.current) {
      const bufferSize = settings.previewBufferSize ?? 15;
      const video = videoRef.current;

      // For larger buffers (>= 5s), just try to resume - don't seek (causes more stutters)
      if (bufferSize >= 5) {
        video.play().catch(() => {});
        return;
      }

      console.log(`[Preview ${channelId}] Video stalled, attempting recovery`);

      // Check if we have buffered data ahead
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const currentTime = video.currentTime;
        const threshold = bufferSize < 3 ? 0.5 : 1.0;

        // If we're behind the buffer, seek to near the end (live edge)
        if (bufferedEnd - currentTime > threshold) {
          console.log(`[Preview ${channelId}] Seeking to live edge: ${bufferedEnd - 0.3}`);
          video.currentTime = bufferedEnd - 0.3;
        }
      }

      // Try to resume playback
      video.play().catch(() => {});
    }
  };

  // Handle video waiting (buffering) - only seek for very small buffers
  const handleVideoWaiting = () => {
    if (isConnected && videoRef.current) {
      const bufferSize = settings.previewBufferSize ?? 15;

      // Only auto-seek for small buffer sizes (< 3 seconds)
      if (bufferSize >= 3) {
        return;
      }

      const video = videoRef.current;

      // If we've been waiting and have buffer ahead, seek forward
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        if (bufferedEnd - video.currentTime > 1) {
          console.log(`[Preview ${channelId}] Buffering detected, catching up to live`);
          video.currentTime = bufferedEnd - 0.3;
        }
      }
    }
  };

  if (!connection.isConnected) {
    return (
      <div className={`preview ${expanded ? 'expanded' : ''}`}>
        <div className="preview-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2" strokeWidth="2"/>
            <polyline points="17 2 12 7 7 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p>Not connected to CasparCG</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`preview ${expanded ? 'expanded' : ''}`}>
      <video
        ref={videoRef}
        className="preview-video"
        autoPlay
        muted
        playsInline
        onError={handleVideoError}
        onStalled={handleVideoStalled}
        onWaiting={handleVideoWaiting}
        style={{ display: isConnected ? 'block' : 'none' }}
      />

      {!isConnected && (
        <div className="preview-placeholder">
          {isConnecting ? (
            <>
              <div className="preview-loading">
                <div className="loading-spinner"></div>
              </div>
              <p>Connecting to stream...</p>
              <button className="btn btn-secondary btn-sm" onClick={handleDisconnect}>
                Cancel
              </button>
            </>
          ) : error ? (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                <line x1="15" y1="9" x2="9" y2="15" strokeWidth="2" strokeLinecap="round"/>
                <line x1="9" y1="9" x2="15" y2="15" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={handleConnect}>
                Retry
              </button>
            </>
          ) : (
            <>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
                <rect x="2" y="7" width="20" height="15" rx="2" ry="2" strokeWidth="2"/>
                <polyline points="17 2 12 7 7 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p>Channel {channelId} Preview</p>
              <div className="preview-buttons">
                <button className="btn btn-primary btn-sm" onClick={handleConnect}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Connect
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isConnected && (
        <div className="preview-controls">
          <button
            className="btn-icon btn-sm"
            onClick={handleDisconnect}
            title="Disconnect"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12"/>
            </svg>
          </button>
          <span className="preview-label">
            Channel {channelId}
            <span className="streaming-badge">LIVE</span>
          </span>
        </div>
      )}
    </div>
  );
}

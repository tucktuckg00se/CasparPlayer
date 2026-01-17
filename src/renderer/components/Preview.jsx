import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import './Preview.css';

export default function Preview({ channelId, expanded = false }) {
  const { connection, settings } = useApp();
  const videoRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const abortControllerRef = useRef(null);
  const pendingChunksRef = useRef([]);
  const isAppendingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');

  // Construct preview URL based on connection settings
  useEffect(() => {
    if (connection.isConnected && connection.previewUrl) {
      const url = connection.previewUrl.replace('{channel}', channelId);
      setStreamUrl(url);
    } else if (connection.isConnected) {
      const previewPort = settings.previewPort || 9250;
      setStreamUrl(`http://${connection.host}:${previewPort + channelId - 1}`);
    } else {
      setStreamUrl('');
    }
  }, [connection.isConnected, connection.host, connection.previewUrl, channelId, settings.previewPort]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMSE();
    };
  }, []);

  // Helper to execute raw AMCP command
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

  // Cleanup MSE resources
  const cleanupMSE = useCallback(() => {
    // Abort any in-progress fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear pending chunks
    pendingChunksRef.current = [];
    isAppendingRef.current = false;

    // Clean up source buffer
    if (sourceBufferRef.current && mediaSourceRef.current) {
      try {
        if (mediaSourceRef.current.readyState === 'open') {
          sourceBufferRef.current.abort();
        }
      } catch (e) {
        console.log('Error aborting source buffer:', e);
      }
      sourceBufferRef.current = null;
    }

    // End media source
    if (mediaSourceRef.current) {
      try {
        if (mediaSourceRef.current.readyState === 'open') {
          mediaSourceRef.current.endOfStream();
        }
      } catch (e) {
        console.log('Error ending media source:', e);
      }
      mediaSourceRef.current = null;
    }

    // Revoke object URL and clear video
    if (videoRef.current) {
      const src = videoRef.current.src;
      videoRef.current.src = '';
      if (src && src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
    }
  }, []);

  // Process pending chunks for source buffer
  const processPendingChunks = useCallback(() => {
    if (!sourceBufferRef.current || isAppendingRef.current) return;
    if (pendingChunksRef.current.length === 0) return;

    const sourceBuffer = sourceBufferRef.current;
    if (sourceBuffer.updating) return;

    try {
      isAppendingRef.current = true;
      const chunk = pendingChunksRef.current.shift();
      sourceBuffer.appendBuffer(chunk);
    } catch (e) {
      console.error('Error appending buffer:', e);
      isAppendingRef.current = false;
      // If quota exceeded, remove old data
      if (e.name === 'QuotaExceededError' && sourceBufferRef.current) {
        try {
          const buffered = sourceBufferRef.current.buffered;
          if (buffered.length > 0) {
            const removeEnd = buffered.start(0) + 5; // Keep 5 seconds
            sourceBufferRef.current.remove(0, removeEnd);
          }
        } catch (removeErr) {
          console.error('Error removing buffer:', removeErr);
        }
      }
    }
  }, []);

  // Start MSE stream consumption
  const startMSEPlayback = useCallback(async (url) => {
    if (!('MediaSource' in window)) {
      setError('MSE not supported in this browser');
      return false;
    }

    try {
      cleanupMSE();

      // Create MediaSource
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;

      // Create object URL and set as video source
      const objectUrl = URL.createObjectURL(mediaSource);
      if (videoRef.current) {
        videoRef.current.src = objectUrl;
      }

      // Wait for MediaSource to open
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('MediaSource open timeout')), 10000);
        mediaSource.addEventListener('sourceopen', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        mediaSource.addEventListener('error', (e) => {
          clearTimeout(timeout);
          reject(e);
        }, { once: true });
      });

      // Add source buffer with fmp4 codecs
      // Using baseline profile for broad compatibility
      const mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
      if (!MediaSource.isTypeSupported(mimeType)) {
        throw new Error(`MIME type not supported: ${mimeType}`);
      }

      const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
      sourceBufferRef.current = sourceBuffer;

      // Handle source buffer update end
      sourceBuffer.addEventListener('updateend', () => {
        isAppendingRef.current = false;
        processPendingChunks();
      });

      sourceBuffer.addEventListener('error', (e) => {
        console.error('SourceBuffer error:', e);
      });

      // Start fetching the stream
      abortControllerRef.current = new AbortController();

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Accept': 'video/mp4'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();

      // Read stream and append to source buffer
      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('Stream ended');
              if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
                // Wait for pending appends before ending
                const waitForAppends = () => {
                  if (pendingChunksRef.current.length === 0 && !isAppendingRef.current) {
                    try {
                      mediaSourceRef.current.endOfStream();
                    } catch (e) {}
                  } else {
                    setTimeout(waitForAppends, 100);
                  }
                };
                waitForAppends();
              }
              break;
            }

            // Add chunk to pending queue and process
            pendingChunksRef.current.push(value);
            processPendingChunks();
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            console.error('Stream read error:', e);
            setError('Stream read error');
          }
        }
      };

      readStream();

      // Start video playback
      if (videoRef.current) {
        try {
          await videoRef.current.play();
          setIsPlaying(true);
          setError(null);
          return true;
        } catch (playErr) {
          console.error('Video play failed:', playErr);
          // Autoplay may be blocked, continue anyway
          setIsPlaying(true);
          return true;
        }
      }

      return true;
    } catch (err) {
      console.error('MSE setup failed:', err);
      setError(err.message || 'Failed to setup MSE playback');
      cleanupMSE();
      return false;
    }
  }, [cleanupMSE, processPendingChunks]);

  // Start streaming from CasparCG using ADD STREAM command with fmp4
  const handleStartStream = async () => {
    if (!connection.casparCG || !connection.isConnected) return;

    try {
      setError(null);
      setIsConnecting(true);

      // Get settings
      const previewPort = settings.previewPort || 9250;
      const actualPort = previewPort + channelId - 1;
      const scale = settings.previewScale || '384:216';
      const preset = settings.previewPreset || 'ultrafast';
      const tune = settings.previewTune || 'zerolatency';
      const audioBitrate = settings.previewAudioBitrate || '128k';
      const crf = Math.round(51 - (settings.previewQuality / 100) * 41);

      // Build fmp4 streaming command
      // URL must be quoted separately, ffmpeg args must be outside the quotes
      const streamCommand = `ADD ${channelId} STREAM "http://127.0.0.1:${actualPort}/stream.mp4" -f mp4 -movflags frag_keyframe+empty_moov+default_base_moof -c:v libx264 -preset ${preset} -tune ${tune} -crf ${crf} -c:a aac -b:a ${audioBitrate} -vf scale=${scale} -af "pan=stereo|c0=FL|c1=FR"`;

      console.log('Sending stream command:', streamCommand);

      try {
        await executeStreamCommand(streamCommand);
      } catch (cmdErr) {
        console.warn('ADD STREAM command failed:', cmdErr);
        // Try alternative format for older CasparCG versions
        const altCommand = `ADD ${channelId} STREAM "http://0.0.0.0:${actualPort}" -f mp4 -movflags frag_keyframe+empty_moov+default_base_moof -c:v libx264 -preset ${preset} -tune ${tune} -crf ${crf} -c:a aac -b:a ${audioBitrate} -vf scale=${scale}`;

        await executeStreamCommand(altCommand);
      }

      setIsStreaming(true);
      const streamUrl = `http://${connection.host}:${actualPort}/stream.mp4`;
      setStreamUrl(streamUrl);

      // Give the stream a moment to start
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Start MSE playback
      const success = await startMSEPlayback(streamUrl);
      if (!success) {
        // Fallback to direct URL playback
        console.log('MSE failed, trying direct URL playback');
        handlePlay();
      }

      setIsConnecting(false);
    } catch (err) {
      console.error('Failed to start stream:', err);
      setError('Failed to start CasparCG stream. Check server configuration.');
      setIsStreaming(false);
      setIsConnecting(false);
    }
  };

  // Stop streaming from CasparCG
  const handleStopStream = async () => {
    try {
      cleanupMSE();

      if (connection.casparCG && connection.isConnected && isStreaming) {
        const previewPort = settings.previewPort || 9250;
        const actualPort = previewPort + channelId - 1;

        // Try to remove the stream
        try {
          await executeStreamCommand(`REMOVE ${channelId} STREAM "http://127.0.0.1:${actualPort}/stream.mp4"`);
        } catch (e) {
          console.log('Remove stream command failed (may be expected):', e);
        }
        try {
          await executeStreamCommand(`REMOVE ${channelId} STREAM "http://0.0.0.0:${actualPort}"`);
        } catch (e) {}
      }

      setIsPlaying(false);
      setIsStreaming(false);
      setError(null);
    } catch (err) {
      console.error('Failed to stop stream:', err);
      setIsStreaming(false);
      setIsPlaying(false);
    }
  };

  // Direct URL playback (fallback)
  const handlePlay = () => {
    if (videoRef.current && streamUrl) {
      videoRef.current.src = streamUrl;
      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
          setError(null);
        })
        .catch(err => {
          console.error('Failed to play preview:', err);
          setError('Failed to load preview stream');
          setIsPlaying(false);
        });
    }
  };

  const handleStop = () => {
    cleanupMSE();
    setIsPlaying(false);
  };

  const handleError = () => {
    setError('Stream unavailable');
    setIsPlaying(false);
  };

  if (!connection.isConnected) {
    return (
      <div className={`preview ${expanded ? 'expanded' : ''}`}>
        <div className="preview-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2" strokeWidth="2"/>
            <polyline points="17 2 12 7 7 2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <p>Not connected</p>
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
        onError={handleError}
        style={{ display: isPlaying ? 'block' : 'none' }}
      />

      {!isPlaying && (
        <div className="preview-placeholder">
          {isConnecting ? (
            <>
              <div className="preview-loading">
                <div className="loading-spinner"></div>
              </div>
              <p>Connecting to stream...</p>
            </>
          ) : error ? (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                <line x1="15" y1="9" x2="9" y2="15" strokeWidth="2" strokeLinecap="round"/>
                <line x1="9" y1="9" x2="15" y2="15" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={handleStartStream}>
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
                <button className="btn btn-primary btn-sm" onClick={handleStartStream}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Connect
                </button>
                <button className="btn btn-sm" onClick={handlePlay} title="Load from URL directly">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  URL
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isPlaying && (
        <div className="preview-controls">
          <button
            className="btn-icon btn-sm"
            onClick={isStreaming ? handleStopStream : handleStop}
            title={isStreaming ? 'Disconnect Stream' : 'Stop Preview'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12"/>
            </svg>
          </button>
          <span className="preview-label">
            Channel {channelId}
            {isStreaming && <span className="streaming-badge">LIVE</span>}
          </span>
        </div>
      )}
    </div>
  );
}

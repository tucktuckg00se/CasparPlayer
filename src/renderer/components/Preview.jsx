import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import './Preview.css';

export default function Preview({ channelId, expanded = false }) {
  const { connection, settings } = useApp();
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');

  // Construct preview URL based on connection settings
  useEffect(() => {
    if (connection.isConnected && connection.previewUrl) {
      // If custom preview URL is set, use it
      const url = connection.previewUrl.replace('{channel}', channelId);
      setStreamUrl(url);
    } else if (connection.isConnected) {
      // Default preview URL using settings
      const previewPort = settings.previewPort || 9250;
      setStreamUrl(`http://${connection.host}:${previewPort + channelId - 1}`);
    } else {
      setStreamUrl('');
    }
  }, [connection.isConnected, connection.host, connection.previewUrl, channelId, settings.previewPort]);

  // Start streaming from CasparCG using ADD STREAM command
  const handleStartStream = async () => {
    if (!connection.casparCG || !connection.isConnected) return;

    try {
      setError(null);
      // Calculate CRF based on quality setting (lower CRF = higher quality)
      const crf = Math.round(51 - (settings.previewQuality / 100) * 41);
      const previewPort = settings.previewPort || 9250;
      const networkCache = settings.networkCache || 500;

      // Start streaming from CasparCG
      // Note: This requires CasparCG server to be configured for streaming
      const streamCommand = `ADD ${channelId} STREAM udp://127.0.0.1:${previewPort + channelId - 1} -format mpegts -codec:v libx264 -crf:v ${crf} -tune zerolatency -preset ultrafast -codec:a aac`;

      await connection.casparCG.do(streamCommand);
      setIsStreaming(true);

      // Give the stream a moment to start before connecting
      setTimeout(() => {
        handlePlay();
      }, 500);
    } catch (err) {
      console.error('Failed to start stream:', err);
      setError('Failed to start CasparCG stream');
    }
  };

  // Stop streaming from CasparCG
  const handleStopStream = async () => {
    try {
      if (connection.casparCG && connection.isConnected && isStreaming) {
        const previewPort = settings.previewPort || 9250;
        const stopCommand = `REMOVE ${channelId} STREAM udp://127.0.0.1:${previewPort + channelId - 1}`;
        await connection.casparCG.do(stopCommand).catch(() => {});
      }
      handleStop();
      setIsStreaming(false);
    } catch (err) {
      console.error('Failed to stop stream:', err);
    }
  };

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
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      setIsPlaying(false);
    }
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
          {error ? (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                <line x1="15" y1="9" x2="9" y2="15" strokeWidth="2" strokeLinecap="round"/>
                <line x1="9" y1="9" x2="15" y2="15" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={handlePlay}>
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
                <button className="btn btn-primary btn-sm" onClick={handlePlay}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Load URL
                </button>
                <button className="btn btn-sm" onClick={handleStartStream} title="Start stream from CasparCG">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Start Stream
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
            title={isStreaming ? 'Stop Stream' : 'Stop Preview'}
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

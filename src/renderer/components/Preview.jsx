import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import './Preview.css';

export default function Preview({ channelId, expanded = false }) {
  const { connection } = useApp();
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [streamUrl, setStreamUrl] = useState('');

  // Construct preview URL based on connection settings
  useEffect(() => {
    if (connection.isConnected && connection.previewUrl) {
      // If custom preview URL is set, use it
      const url = connection.previewUrl.replace('{channel}', channelId);
      setStreamUrl(url);
    } else if (connection.isConnected) {
      // Default preview URL (FFmpeg stream typically on port 9000+channel)
      const previewPort = 9000 + channelId;
      setStreamUrl(`http://${connection.host}:${previewPort}/stream`);
    } else {
      setStreamUrl('');
    }
  }, [connection.isConnected, connection.host, connection.previewUrl, channelId]);

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
              <button className="btn btn-primary btn-sm" onClick={handlePlay}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Load Preview
              </button>
            </>
          )}
        </div>
      )}

      {isPlaying && (
        <div className="preview-controls">
          <button className="btn-icon btn-sm" onClick={handleStop} title="Stop Preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12"/>
            </svg>
          </button>
          <span className="preview-label">Channel {channelId}</span>
        </div>
      )}
    </div>
  );
}

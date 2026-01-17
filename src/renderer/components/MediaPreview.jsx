import React, { useState, useEffect } from 'react';
import { formatFileSize, formatDuration } from '../utils/fileTypes';
import './MediaPreview.css';

export default function MediaPreview({ file }) {
  const [thumbnail, setThumbnail] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (file && (file.type === 'video' || file.type === 'image')) {
      loadThumbnail(file);
    } else {
      setThumbnail(null);
    }
  }, [file]);

  const loadThumbnail = async (file) => {
    setIsLoading(true);
    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('media:generateThumbnail', file.path, file.type);
      if (result?.thumbnail) {
        setThumbnail(`file://${result.thumbnail}?${Date.now()}`);
      }
    } catch (error) {
      console.error('Error loading thumbnail:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!file) {
    return (
      <div className="media-preview empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
          <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="2" />
          <polyline points="21,15 16,10 5,21" strokeWidth="2" />
        </svg>
        <p>Select a file to preview</p>
      </div>
    );
  }

  return (
    <div className="media-preview">
      <div className="preview-thumbnail">
        {isLoading ? (
          <div className="preview-loading">
            <div className="loading-spinner" />
          </div>
        ) : thumbnail ? (
          <img src={thumbnail} alt={file.name} />
        ) : (
          <div className="preview-placeholder">
            {getTypeIcon(file.type)}
          </div>
        )}
      </div>

      <div className="preview-info">
        <h4 className="preview-name" title={file.name}>{file.name}</h4>

        <div className="preview-details">
          <div className="detail-row">
            <span className="detail-label">Type</span>
            <span className="detail-value type-badge" data-type={file.type}>
              {file.type}
            </span>
          </div>

          {file.metadata?.resolution && (
            <div className="detail-row">
              <span className="detail-label">Resolution</span>
              <span className="detail-value">{file.metadata.resolution}</span>
            </div>
          )}

          {file.metadata?.duration > 0 && (
            <div className="detail-row">
              <span className="detail-label">Duration</span>
              <span className="detail-value">{formatDuration(file.metadata.duration)}</span>
            </div>
          )}

          {file.metadata?.frameRate > 0 && (
            <div className="detail-row">
              <span className="detail-label">Frame Rate</span>
              <span className="detail-value">{file.metadata.frameRate.toFixed(2)} fps</span>
            </div>
          )}

          {file.metadata?.codec && (
            <div className="detail-row">
              <span className="detail-label">Codec</span>
              <span className="detail-value">{file.metadata.codec.toUpperCase()}</span>
            </div>
          )}

          {file.size > 0 && (
            <div className="detail-row">
              <span className="detail-label">Size</span>
              <span className="detail-value">{formatFileSize(file.size)}</span>
            </div>
          )}
        </div>

        <div className="preview-path" title={file.path}>
          {file.relativePath || file.path}
        </div>
      </div>
    </div>
  );
}

function getTypeIcon(type) {
  switch (type) {
    case 'video':
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
        </svg>
      );
    case 'image':
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
        </svg>
      );
    case 'audio':
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      );
    case 'template':
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
        </svg>
      );
    default:
      return (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
        </svg>
      );
  }
}

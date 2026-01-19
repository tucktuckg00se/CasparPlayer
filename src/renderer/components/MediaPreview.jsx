import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatFileSize, formatDuration } from '../utils/fileTypes';
import { localPathToCasparClip, findCasparMetadata, convertClipInfoToMetadata } from '../services/casparMediaService';
import './MediaPreview.css';

export default function MediaPreview({ file }) {
  const { connection, state, getCasparThumbnail } = useApp();
  const [thumbnail, setThumbnail] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!file || !connection.isConnected) {
      setThumbnail(null);
      setMetadata(null);
      return;
    }

    const loadCasparData = async () => {
      setIsLoading(true);

      // Get CasparCG clip name from local path
      const clipName = localPathToCasparClip(file.path, state.media.rootPath);

      if (clipName) {
        // Get CasparCG metadata from cached list
        const casparClip = findCasparMetadata(file.path, state.media.rootPath, state.casparMedia.list);
        if (casparClip) {
          setMetadata(convertClipInfoToMetadata(casparClip));
        } else {
          setMetadata(null);
        }

        // Get CasparCG thumbnail
        const thumb = await getCasparThumbnail(clipName);
        setThumbnail(thumb);
      } else {
        setMetadata(null);
        setThumbnail(null);
      }

      setIsLoading(false);
    };

    loadCasparData();
  }, [file, connection.isConnected, state.media.rootPath, state.casparMedia.list, getCasparThumbnail]);

  // Not connected state
  if (!connection.isConnected) {
    return (
      <div className="media-preview empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
          <path d="M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="19" x2="12" y2="23" strokeWidth="2"/>
          <line x1="8" y1="23" x2="16" y2="23" strokeWidth="2"/>
        </svg>
        <p>Connect to CasparCG to view media preview</p>
      </div>
    );
  }

  // No file selected state
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
            <span className="detail-value type-badge" data-type={metadata?.type || file.type}>
              {metadata?.type || file.type}
            </span>
          </div>

          {metadata?.frameRate > 0 && (
            <div className="detail-row">
              <span className="detail-label">Frame Rate</span>
              <span className="detail-value">{metadata.frameRate.toFixed(2)} fps</span>
            </div>
          )}

          {metadata?.duration > 0 && (
            <div className="detail-row">
              <span className="detail-label">Duration</span>
              <span className="detail-value">{formatDuration(metadata.duration)}</span>
            </div>
          )}

          {metadata?.frameCount > 0 && (
            <div className="detail-row">
              <span className="detail-label">Frames</span>
              <span className="detail-value">{metadata.frameCount.toLocaleString()}</span>
            </div>
          )}

          {metadata?.size > 0 && (
            <div className="detail-row">
              <span className="detail-label">Size</span>
              <span className="detail-value">{formatFileSize(metadata.size)}</span>
            </div>
          )}

          {!metadata && file.size > 0 && (
            <div className="detail-row">
              <span className="detail-label">Size</span>
              <span className="detail-value">{formatFileSize(file.size)}</span>
            </div>
          )}
        </div>

        {metadata?.source === 'casparcg' && (
          <div className="preview-source">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>CasparCG metadata</span>
          </div>
        )}

        {!metadata && (
          <div className="preview-source warning">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>Not found in CasparCG media</span>
          </div>
        )}

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

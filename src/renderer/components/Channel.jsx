import React, { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import Layer from './Layer';
import Preview from './Preview';
import './Channel.css';

export default function Channel({ channel, isExpanded = false, isHidden = false }) {
  const { deleteChannel, addLayer, toggleExpandChannel, state, setExpandedPreviewHeight } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // Get the expanded preview height from state
  const expandedPreviewHeight = state.ui.previewSize || 400;

  // Handle resize drag
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = expandedPreviewHeight;

    const handleMouseMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - resizeStartY.current;
      const newHeight = resizeStartHeight.current + deltaY;
      setExpandedPreviewHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [expandedPreviewHeight, setExpandedPreviewHeight]);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteChannel(channel.id);
    setShowDeleteConfirm(false);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Calculate channel width based on layers (only in normal mode)
  const baseWidth = 420; // preview + 1 layer
  const layerWidth = 392; // each additional layer
  const addButtonWidth = 60;
  const channelWidth = isExpanded
    ? '100%'
    : `${baseWidth + (Math.max(0, channel.layers.length - 1) * layerWidth) + addButtonWidth}px`;

  // Build class names
  const classNames = ['channel'];
  if (isExpanded) classNames.push('channel-expanded');
  if (isHidden) classNames.push('channel-hidden');

  return (
    <div className={classNames.join(' ')} style={{ width: channelWidth }}>
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm">
            <h3>Delete Channel?</h3>
            <p>Are you sure you want to delete {channel.name}? All layers and playlist items will be removed. This cannot be undone.</p>
            <div className="delete-confirm-buttons">
              <button className="btn" onClick={cancelDelete}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Only show header in normal mode - expanded mode uses container header */}
      {!isExpanded && (
        <div className="channel-header">
          <h3 className="channel-name">{channel.name}</h3>
          <div className="channel-actions">
            <button
              className="btn-icon"
              title="Expand Channel"
              onClick={() => toggleExpandChannel(channel.id)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="btn-icon btn-danger-icon"
              onClick={handleDelete}
              title="Delete Channel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="3 6 5 6 21 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <div
        className={`channel-preview ${isExpanded ? 'channel-preview-expanded' : ''}`}
        style={isExpanded ? { height: `${expandedPreviewHeight}px` } : undefined}
      >
        <Preview channelId={channel.id} expanded={isExpanded} />
        {isExpanded && (
          <div
            className={`preview-resize-handle ${isResizing ? 'resizing' : ''}`}
            onMouseDown={handleResizeStart}
            title="Drag to resize preview"
          >
            <div className="resize-handle-bar" />
          </div>
        )}
      </div>

      <div className={`channel-layers ${isExpanded ? 'channel-layers-expanded' : ''}`}>
        {channel.layers.map(layer => (
          <Layer
            key={layer.id}
            layer={layer}
            channelId={channel.id}
            channelFrameRate={channel.channelFrameRate}
            expanded={isExpanded}
          />
        ))}

        {/* Only show add button in normal mode - expanded mode uses container header */}
        {!isExpanded && (
          <button
            className="add-layer-button"
            onClick={() => addLayer(channel.id)}
            title="Add Layer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
              <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
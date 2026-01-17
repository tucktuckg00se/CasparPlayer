import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DRAG_TYPES, setDragEventData } from './DragDropProvider';
import { formatDuration } from '../utils/timecode';
import './PlaylistItem.css';

export default function PlaylistItem({
  item,
  index,
  isPlaying,
  isCurrent,
  isSelected,
  channelId,
  layerId,
  onItemClick
}) {
  const { removePlaylistItem, playItem, updateItemDuration } = useApp();
  const isMacro = item.type === 'macro';
  const isImage = item.type === 'image';
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationValue, setDurationValue] = useState(item.duration.toString());

  const handleClick = (e) => {
    if (onItemClick) {
      onItemClick(e);
    }
  };

  const handleDoubleClick = () => {
    playItem(channelId, layerId, index);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    removePlaylistItem(channelId, layerId, item.id);
  };

  const handleDragStart = (e) => {
    setDragEventData(e, DRAG_TYPES.PLAYLIST_ITEM, {
      item,
      sourceChannelId: channelId,
      sourceLayerId: layerId,
      index
    });
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  const handleDurationClick = (e) => {
    if (isImage) {
      e.stopPropagation();
      setDurationValue(item.duration.toString());
      setEditingDuration(true);
    }
  };

  const handleDurationChange = (e) => {
    setDurationValue(e.target.value);
  };

  const handleDurationBlur = () => {
    const newDuration = parseFloat(durationValue) || 0;
    if (newDuration !== item.duration) {
      updateItemDuration(channelId, layerId, item.id, newDuration);
    }
    setEditingDuration(false);
  };

  const handleDurationKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleDurationBlur();
    } else if (e.key === 'Escape') {
      setDurationValue(item.duration.toString());
      setEditingDuration(false);
    }
  };

  return (
    <div
      className={`playlist-item ${isCurrent ? 'current' : ''} ${isPlaying ? 'playing' : ''} ${isMacro ? 'macro' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <span className="item-index">{index + 1}</span>

      <div className="item-icon">
        {getTypeIcon(item.type)}
      </div>

      <div className="item-info">
        <span className="item-name" title={item.relativePath || item.name}>
          {item.relativePath || item.name}
        </span>
        {item.resolution && (
          <span className="item-meta">{item.resolution}</span>
        )}
      </div>

      <div className="item-duration">
        {item.inPoint !== null || item.outPoint !== null ? (
          <span className="item-io" title="Has In/Out points">IO</span>
        ) : null}
        {isImage && editingDuration ? (
          <input
            type="number"
            className="duration-input"
            value={durationValue}
            onChange={handleDurationChange}
            onBlur={handleDurationBlur}
            onKeyDown={handleDurationKeyDown}
            autoFocus
            min="0"
            step="0.5"
            onClick={e => e.stopPropagation()}
          />
        ) : item.duration > 0 ? (
          <span
            className={isImage ? 'duration-editable' : ''}
            onClick={handleDurationClick}
            title={isImage ? 'Click to edit duration' : ''}
          >
            {formatDuration(item.duration)}
          </span>
        ) : null}
      </div>

      <button
        className="item-remove"
        onClick={handleRemove}
        title="Remove from playlist"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="18" y1="6" x2="6" y2="18" strokeWidth="2" strokeLinecap="round"/>
          <line x1="6" y1="6" x2="18" y2="18" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>

      {isPlaying && (
        <div className="playing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
    </div>
  );
}

function getTypeIcon(type) {
  switch (type) {
    case 'video':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
        </svg>
      );
    case 'image':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
        </svg>
      );
    case 'audio':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      );
    case 'macro':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5z" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
        </svg>
      );
  }
}

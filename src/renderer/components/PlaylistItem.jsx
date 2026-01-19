import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DRAG_TYPES, setDragEventData } from './DragDropProvider';
import { formatDuration, framesToTimecode } from '../utils/timecode';
import TimecodeInput from './TimecodeInput';
import './PlaylistItem.css';

const { ipcRenderer } = window.require('electron');

export default function PlaylistItem({
  item,
  index,
  isPlaying,
  isCurrent,
  isSelected,
  channelId,
  layerId,
  channelFrameRate,
  onItemClick
}) {
  const { removePlaylistItem, playItem, updateItemDuration, updateItemInOutPoints, updateItemMetadata } = useApp();
  const isMacro = item.type === 'macro';
  const isImage = item.type === 'image';
  const isVideo = item.type === 'video';
  const [showDurationEditor, setShowDurationEditor] = useState(false);
  const [showInOutEditor, setShowInOutEditor] = useState(false);
  const [inPointFrames, setInPointFrames] = useState(item.inPointFrames ?? null);
  const [outPointFrames, setOutPointFrames] = useState(item.outPointFrames ?? null);
  const frameRate = item.frameRate ?? 25;
  const maxFrames = item.duration > 0 ? Math.floor(item.duration * frameRate) : null;

  // For images, use channel frame rate for duration calculation
  const imageFrameRate = channelFrameRate || 25;
  // Convert image duration (seconds) to frames for the timecode editor
  const imageDurationFrames = isImage && item.duration > 0
    ? Math.round(item.duration * imageFrameRate)
    : null;
  const [localImageDurationFrames, setLocalImageDurationFrames] = useState(imageDurationFrames);

  // Calculate effective duration (considering in/out points for videos)
  const getEffectiveDuration = () => {
    if (isVideo && (item.inPointFrames !== null || item.outPointFrames !== null)) {
      const inFrames = item.inPointFrames || 0;
      const outFrames = item.outPointFrames !== null ? item.outPointFrames : (item.duration * frameRate);
      return (outFrames - inFrames) / frameRate;
    }
    return item.duration;
  };
  const effectiveDuration = getEffectiveDuration();

  // Sync local state when item prop changes
  useEffect(() => {
    setInPointFrames(item.inPointFrames ?? null);
    setOutPointFrames(item.outPointFrames ?? null);
  }, [item.inPointFrames, item.outPointFrames]);

  // Sync image duration frames when item.duration or channel frame rate changes
  useEffect(() => {
    if (isImage && item.duration > 0) {
      setLocalImageDurationFrames(Math.round(item.duration * imageFrameRate));
    }
  }, [item.duration, imageFrameRate, isImage]);

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
      setShowDurationEditor(!showDurationEditor);
    }
  };

  // Handle image duration change from TimecodeInput (receives frames)
  const handleImageDurationFramesChange = (frames) => {
    setLocalImageDurationFrames(frames);
    if (frames !== null && frames > 0) {
      // Convert frames to seconds using channel frame rate
      const seconds = frames / imageFrameRate;
      updateItemDuration(channelId, layerId, item.id, seconds);
    }
  };

  // Handle in/out editor click - verify metadata first if needed
  const handleInOutClick = async (e) => {
    e.stopPropagation();

    // If frameRate is default (25) and not verified, try to fetch actual metadata
    if (isVideo && item.frameRate === 25 && !item.metadataVerified) {
      try {
        const metadata = await ipcRenderer.invoke('media:getMetadata', item.path, 'video');
        if (metadata?.frameRate) {
          updateItemMetadata(channelId, layerId, item.id, metadata);
        }
      } catch (err) {
        console.warn('Failed to verify video metadata:', err);
      }
    }

    setShowInOutEditor(!showInOutEditor);
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
        <span className="item-name" title={item.relativePath || item.path || item.name}>
          {item.name}
        </span>
        {item.resolution && (
          <span className="item-meta">{item.resolution}</span>
        )}
      </div>

      <div className="item-duration">
        {item.inPointFrames !== null || item.outPointFrames !== null ? (
          <span
            className="item-io"
            title={`In: ${item.inPointFrames !== null ? framesToTimecode(item.inPointFrames, frameRate) : '-'} / Out: ${item.outPointFrames !== null ? framesToTimecode(item.outPointFrames, frameRate) : '-'}${frameRate !== 25 ? ` @ ${frameRate.toFixed(2)}fps` : ''}`}
            onClick={handleInOutClick}
          >
            IO
          </span>
        ) : isVideo ? (
          <span
            className="item-io-add"
            title={`Click to set In/Out points (HH:MM:SS:FF)${frameRate !== 25 ? ` @ ${frameRate.toFixed(2)}fps` : ''}`}
            onClick={handleInOutClick}
          >
            +IO
          </span>
        ) : null}
        {effectiveDuration > 0 ? (
          <span
            className={isImage ? 'duration-editable' : 'duration-display'}
            onClick={handleDurationClick}
            title={isImage ? 'Click to edit duration' : `Duration: ${formatDuration(effectiveDuration)}${isVideo && effectiveDuration !== item.duration ? ` (full: ${formatDuration(item.duration)})` : ''}`}
          >
            {formatDuration(effectiveDuration)}
          </span>
        ) : (
          <span
            className={isImage ? 'duration-editable duration-unknown' : 'duration-display duration-unknown'}
            onClick={handleDurationClick}
          >
            --:--
          </span>
        )}
      </div>

      {/* In/Out Point Editor with Timecode inputs */}
      {showInOutEditor && isVideo && (
        <div className="item-io-editor" onClick={e => e.stopPropagation()}>
          <div className="io-fps-display">
            {frameRate.toFixed(2)} fps
          </div>
          <div className="io-row">
            <label>In:</label>
            <TimecodeInput
              value={inPointFrames}
              onChange={(frames) => {
                setInPointFrames(frames);
                updateItemInOutPoints(channelId, layerId, item.id, frames, outPointFrames);
              }}
              frameRate={frameRate}
              maxFrames={maxFrames}
            />
          </div>
          <div className="io-row">
            <label>Out:</label>
            <TimecodeInput
              value={outPointFrames}
              onChange={(frames) => {
                setOutPointFrames(frames);
                updateItemInOutPoints(channelId, layerId, item.id, inPointFrames, frames);
              }}
              frameRate={frameRate}
              maxFrames={maxFrames}
            />
          </div>
          <div className="io-row io-actions">
            <button
              className="io-clear-btn"
              title="Clear In/Out points"
              onClick={() => {
                setInPointFrames(null);
                setOutPointFrames(null);
                updateItemInOutPoints(channelId, layerId, item.id, null, null);
              }}
            >
              Clear
            </button>
            <button
              className="io-done-btn"
              title="Close editor"
              onClick={() => setShowInOutEditor(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Image Duration Editor */}
      {showDurationEditor && isImage && (
        <div className="item-io-editor" onClick={e => e.stopPropagation()}>
          <div className="io-fps-display">
            {imageFrameRate.toFixed(2)} fps (channel)
          </div>
          <div className="io-row">
            <label>Dur:</label>
            <TimecodeInput
              value={localImageDurationFrames}
              onChange={handleImageDurationFramesChange}
              frameRate={imageFrameRate}
              maxFrames={null}
            />
          </div>
          <div className="io-row io-actions">
            <button
              className="io-clear-btn"
              title="Reset to default (5 sec)"
              onClick={() => {
                const defaultFrames = Math.round(5 * imageFrameRate);
                setLocalImageDurationFrames(defaultFrames);
                updateItemDuration(channelId, layerId, item.id, 5);
              }}
            >
              Reset
            </button>
            <button
              className="io-done-btn"
              title="Close editor"
              onClick={() => setShowDurationEditor(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

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

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DRAG_TYPES, parseDragData } from './DragDropProvider';
import PlaylistItem from './PlaylistItem';
import './Playlist.css';

export default function Playlist({ items, currentIndex, channelId, layerId, expanded = false }) {
  const { addMediaToPlaylist, reorderPlaylistItems } = useApp();
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
    setDragOverIndex(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    setDragOverIndex(null);

    const dragData = parseDragData(e);
    if (!dragData) return;

    if (dragData.type === DRAG_TYPES.MEDIA_FILE) {
      // Add media file to playlist
      const mediaFile = dragData.data;
      addMediaToPlaylist(channelId, layerId, {
        name: mediaFile.name,
        path: mediaFile.path,
        type: mediaFile.type,
        metadata: mediaFile.metadata
      });
    } else if (dragData.type === DRAG_TYPES.MACRO) {
      // Add macro to playlist
      const macro = dragData.data;
      addMediaToPlaylist(channelId, layerId, {
        name: macro.name,
        path: null,
        type: 'macro',
        macroId: macro.id,
        metadata: { color: macro.color }
      });
    } else if (dragData.type === DRAG_TYPES.PLAYLIST_ITEM) {
      // Reorder within same playlist or copy from another
      const sourceItem = dragData.data;
      if (sourceItem.sourceChannelId === channelId && sourceItem.sourceLayerId === layerId) {
        // Reorder within same playlist
        if (dragOverIndex !== null && dragOverIndex !== sourceItem.index) {
          reorderPlaylistItems(channelId, layerId, sourceItem.index, dragOverIndex);
        }
      } else {
        // Copy from another playlist - add the item
        addMediaToPlaylist(channelId, layerId, {
          name: sourceItem.item.name,
          path: sourceItem.item.path,
          type: sourceItem.item.type,
          metadata: sourceItem.item.metadata
        });
      }
    }
  };

  const handleItemDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(index);
  };

  if (items.length === 0) {
    return (
      <div
        className={`playlist empty ${expanded ? 'expanded' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="playlist-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
            <line x1="8" y1="6" x2="21" y2="6" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="12" x2="21" y2="12" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="18" x2="21" y2="18" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p>Drop media here</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`playlist ${expanded ? 'expanded' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="playlist-items">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`playlist-item-wrapper ${dragOverIndex === index ? 'drag-over' : ''}`}
            onDragOver={(e) => handleItemDragOver(e, index)}
          >
            <PlaylistItem
              item={item}
              index={index}
              isPlaying={index === currentIndex && item.playing}
              isCurrent={index === currentIndex}
              channelId={channelId}
              layerId={layerId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

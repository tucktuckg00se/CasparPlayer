import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DRAG_TYPES, parseDragData } from './DragDropProvider';
import PlaylistItem from './PlaylistItem';
import './Playlist.css';

export default function Playlist({ items, currentIndex, channelId, layerId, channelFrameRate, expanded = false, selectedItems = [], lastSelectedIndex = null, isLayerPlaying = false }) {
  const { addMediaToPlaylist, reorderPlaylistItems, selectPlaylistItems, deleteSelectedItems, undoDelete, attachMacroToItem } = useApp();
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [lastClickIndex, setLastClickIndex] = useState(null);
  const [macroAttachMenu, setMacroAttachMenu] = useState(null); // { x, y, macroId, macroName, targetItemId }
  const containerRef = useRef(null);

  // Close macro attach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (macroAttachMenu && !e.target.closest('.macro-attach-menu')) {
        setMacroAttachMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [macroAttachMenu]);

  // Handle macro attachment selection
  const handleMacroAttach = (position) => {
    if (!macroAttachMenu) return;
    if (position === 'start' || position === 'end') {
      attachMacroToItem(channelId, layerId, macroAttachMenu.targetItemId, macroAttachMenu.macroId, position);
    }
    setMacroAttachMenu(null);
  };

  // Handle keyboard events for delete and undo
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if this playlist is focused
      if (!containerRef.current?.contains(document.activeElement) &&
          document.activeElement !== containerRef.current) {
        return;
      }

      if (e.key === 'Delete' && selectedItems.length > 0) {
        e.preventDefault();
        deleteSelectedItems(channelId, layerId);
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undoDelete(channelId, layerId);
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey) && items.length > 0) {
        e.preventDefault();
        // Select all items
        selectPlaylistItems(channelId, layerId, items.map(item => item.id));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [channelId, layerId, selectedItems, items, deleteSelectedItems, undoDelete, selectPlaylistItems]);

  // Handle item click with modifiers for multi-select
  // Single-click ONLY sets blue selection, never green (active)
  // Green (active) only happens when play button is clicked or double-click
  const handleItemClick = (itemId, index, e) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: toggle selection for multi-select
      selectPlaylistItems(channelId, layerId, [itemId], 'toggle');
    } else if (e.shiftKey && lastClickIndex !== null) {
      // Shift+Click: range select
      const start = Math.min(lastClickIndex, index);
      const end = Math.max(lastClickIndex, index);
      const rangeIds = items.slice(start, end + 1).map(item => item.id);
      selectPlaylistItems(channelId, layerId, rangeIds);
    } else {
      // Regular click: only blue selection, never changes active (green)
      selectPlaylistItems(channelId, layerId, [itemId]);
      setLastClickIndex(index);
    }
  };

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

    const dragData = parseDragData(e);
    if (!dragData) {
      setDragOverIndex(null);
      return;
    }

    if (dragData.type === DRAG_TYPES.MEDIA_FILE) {
      // Add media file to playlist
      const mediaFile = dragData.data;
      addMediaToPlaylist(channelId, layerId, {
        name: mediaFile.name,
        path: mediaFile.path,
        type: mediaFile.type,
        metadata: mediaFile.metadata
      });
      setDragOverIndex(null);
    } else if (dragData.type === DRAG_TYPES.MACRO) {
      const macro = dragData.data;

      // Check if dropped on an existing non-macro item
      if (dragOverIndex !== null && items[dragOverIndex] && items[dragOverIndex].type !== 'macro') {
        // Show macro attach menu
        const targetItem = items[dragOverIndex];
        setMacroAttachMenu({
          x: e.clientX,
          y: e.clientY,
          macroId: macro.id,
          macroName: macro.name,
          macroColor: macro.color,
          targetItemId: targetItem.id,
          targetItemName: targetItem.name
        });
        setDragOverIndex(null);
      } else {
        // Add macro as standalone item
        addMediaToPlaylist(channelId, layerId, {
          name: macro.name,
          path: null,
          type: 'macro',
          macroId: macro.id,
          metadata: { color: macro.color }
        });
        setDragOverIndex(null);
      }
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
      setDragOverIndex(null);
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
        ref={containerRef}
        className={`playlist empty ${expanded ? 'expanded' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={0}
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
      ref={containerRef}
      className={`playlist ${expanded ? 'expanded' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      tabIndex={0}
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
              isSelected={selectedItems.includes(item.id)}
              channelId={channelId}
              layerId={layerId}
              channelFrameRate={channelFrameRate}
              onItemClick={(e) => handleItemClick(item.id, index, e)}
            />
          </div>
        ))}
      </div>

      {/* Macro Attach Context Menu */}
      {macroAttachMenu && (
        <div
          className="macro-attach-menu"
          style={{
            position: 'fixed',
            left: macroAttachMenu.x,
            top: macroAttachMenu.y,
            zIndex: 1000
          }}
        >
          <div className="macro-attach-menu-header">
            <span
              className="macro-attach-menu-color"
              style={{ backgroundColor: macroAttachMenu.macroColor || '#ff6432' }}
            />
            Attach "{macroAttachMenu.macroName}"
          </div>
          <div className="macro-attach-menu-target">
            to "{macroAttachMenu.targetItemName}"
          </div>
          <button
            className="macro-attach-menu-item"
            onClick={() => handleMacroAttach('start')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Attach to Start
          </button>
          <button
            className="macro-attach-menu-item"
            onClick={() => handleMacroAttach('end')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
            Attach to End
          </button>
          <button
            className="macro-attach-menu-item macro-attach-menu-cancel"
            onClick={() => setMacroAttachMenu(null)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

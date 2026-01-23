import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Playlist from './Playlist';
import LayerControls from './LayerControls';
import TimeDisplay from './TimeDisplay';
import './Layer.css';

export default function Layer({ layer, channelId, channelFrameRate, expanded = false }) {
  const { state, deleteLayer, renameLayer } = useApp();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(layer.name || `Layer ${layer.id}`);
  const nameInputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = () => {
    setEditName(layer.name || `Layer ${layer.id}`);
    setIsEditingName(true);
  };

  const handleNameChange = (e) => {
    setEditName(e.target.value);
  };

  const handleNameBlur = () => {
    const trimmedName = editName.trim();
    const currentName = layer.name || `Layer ${layer.id}`;
    if (trimmedName && trimmedName !== currentName) {
      renameLayer(channelId, layer.id, trimmedName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setEditName(layer.name || `Layer ${layer.id}`);
      setIsEditingName(false);
    }
  };

  const handleDeleteLayer = () => {
    const displayName = layer.name || `Layer ${layer.id}`;
    if (layer.playlist.length > 0) {
      if (!confirm(`Delete ${displayName}? All playlist items will be removed.`)) {
        return;
      }
    }
    deleteLayer(channelId, layer.id);
  };

  return (
    <div className={`layer ${expanded ? 'expanded' : ''}`}>
      <div className="layer-header">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            className="layer-name-input"
            value={editName}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
          />
        ) : (
          <span
            className="layer-title editable"
            onClick={handleNameClick}
            title="Click to rename"
          >
            {layer.name || `Layer ${layer.id}`}
          </span>
        )}
        <div className="layer-modes">
          <ModeIndicator
            label="PL"
            active={layer.playlistMode}
            title="Playlist Mode"
          />
          <ModeIndicator
            label="LP"
            active={layer.loopMode}
            title="Loop Playlist"
          />
          <ModeIndicator
            label="LI"
            active={layer.loopItem}
            title="Loop Item"
          />
        </div>
        <button
          className="btn-icon btn-sm"
          onClick={handleDeleteLayer}
          title="Delete Layer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18" strokeWidth="2" strokeLinecap="round"/>
            <line x1="6" y1="6" x2="18" y2="18" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <TimeDisplay
        currentTime={layer.currentTime}
        totalTime={layer.totalTime}
        isPlaying={layer.isPlaying}
      />

      <LayerControls
        layer={layer}
        channelId={channelId}
      />

      <Playlist
        items={layer.playlist}
        currentIndex={layer.currentIndex}
        channelId={channelId}
        layerId={layer.id}
        channelFrameRate={channelFrameRate}
        expanded={expanded}
        selectedItems={layer.selectedItems || []}
        lastSelectedIndex={layer.lastSelectedIndex}
        isLayerPlaying={layer.isPlaying}
      />
    </div>
  );
}

function ModeIndicator({ label, active, title }) {
  return (
    <span
      className={`mode-indicator ${active ? 'active' : ''}`}
      title={title}
    >
      {label}
    </span>
  );
}

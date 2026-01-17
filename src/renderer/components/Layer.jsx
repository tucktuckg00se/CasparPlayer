import React from 'react';
import { useApp } from '../context/AppContext';
import Playlist from './Playlist';
import LayerControls from './LayerControls';
import TimeDisplay from './TimeDisplay';
import './Layer.css';

export default function Layer({ layer, channelId, expanded = false }) {
  const { state, deleteLayer } = useApp();

  const handleDeleteLayer = () => {
    if (layer.playlist.length > 0) {
      if (!confirm(`Delete Layer ${layer.id}? All playlist items will be removed.`)) {
        return;
      }
    }
    deleteLayer(channelId, layer.id);
  };

  return (
    <div className={`layer ${expanded ? 'expanded' : ''}`}>
      <div className="layer-header">
        <span className="layer-title">Layer {layer.id}</span>
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
        expanded={expanded}
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

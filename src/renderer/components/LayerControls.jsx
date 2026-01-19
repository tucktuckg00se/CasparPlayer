import React from 'react';
import { useApp } from '../context/AppContext';
import './LayerControls.css';

export default function LayerControls({ layer, channelId }) {
  const {
    connection,
    playItem,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    nextItem,
    prevItem,
    togglePlaylistMode,
    toggleLoopMode,
    toggleLoopItem
  } = useApp();

  const isConnected = connection.isConnected;
  const hasItems = layer.playlist.length > 0;

  const handlePrevious = () => {
    prevItem(channelId, layer.id);
  };

  const handlePlay = () => {
    if (layer.isPaused) {
      // Resume from paused state
      resumePlayback(channelId, layer.id);
    } else if (hasItems) {
      // Find the selected item (blue) to play
      // selectedItems contains item IDs, find the index of the first selected item
      let index = 0;
      if (layer.selectedItems && layer.selectedItems.length > 0) {
        const selectedId = layer.selectedItems[0];
        const selectedIndex = layer.playlist.findIndex(item => item.id === selectedId);
        if (selectedIndex >= 0) {
          index = selectedIndex;
        }
      } else if (layer.currentIndex >= 0) {
        // Fall back to currentIndex if nothing selected
        index = layer.currentIndex;
      }
      playItem(channelId, layer.id, index);
    }
  };

  const handlePause = () => {
    pausePlayback(channelId, layer.id);
  };

  const handleStop = () => {
    stopPlayback(channelId, layer.id);
  };

  const handleNext = () => {
    nextItem(channelId, layer.id);
  };

  return (
    <div className="layer-controls">
      <div className="transport-controls">
        <button
          className="control-btn"
          onClick={handlePrevious}
          disabled={!isConnected || !hasItems}
          title="Previous Item"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        {layer.isPlaying && !layer.isPaused ? (
          <button
            className="control-btn control-btn-primary"
            onClick={handlePause}
            disabled={!isConnected}
            title="Pause"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          </button>
        ) : (
          <button
            className="control-btn control-btn-primary"
            onClick={handlePlay}
            disabled={!isConnected || !hasItems}
            title={layer.isPaused ? "Resume" : "Play"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        )}

        <button
          className="control-btn"
          onClick={handleStop}
          disabled={!isConnected}
          title="Stop"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12"/>
          </svg>
        </button>

        <button
          className="control-btn"
          onClick={handleNext}
          disabled={!isConnected || !hasItems}
          title="Next Item"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <div className="mode-controls">
        <button
          className={`mode-btn ${layer.playlistMode ? 'active' : ''}`}
          onClick={() => togglePlaylistMode(channelId, layer.id)}
          title="Playlist Mode - Auto-advance to next item"
        >
          PL
        </button>

        <button
          className={`mode-btn ${layer.loopMode ? 'active' : ''}`}
          onClick={() => toggleLoopMode(channelId, layer.id)}
          title="Loop Playlist - Loop back to first item"
        >
          LP
        </button>

        <button
          className={`mode-btn ${layer.loopItem ? 'active' : ''}`}
          onClick={() => toggleLoopItem(channelId, layer.id)}
          title="Loop Item - Repeat current item"
        >
          LI
        </button>
      </div>
    </div>
  );
}

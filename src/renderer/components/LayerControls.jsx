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
    toggleLoopItem,
    setInPoint,
    setOutPoint,
    clearInOutPoints
  } = useApp();

  const isConnected = connection.isConnected;
  const hasItems = layer.playlist.length > 0;
  const hasCurrentItem = layer.currentIndex >= 0;

  const handlePrevious = () => {
    prevItem(channelId, layer.id);
  };

  const handlePlay = () => {
    if (layer.isPlaying) {
      resumePlayback(channelId, layer.id);
    } else if (hasItems) {
      // If nothing selected, play first item
      const index = layer.currentIndex >= 0 ? layer.currentIndex : 0;
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

  const handleSetIn = () => {
    setInPoint(channelId, layer.id, layer.currentTime);
  };

  const handleSetOut = () => {
    setOutPoint(channelId, layer.id, layer.currentTime);
  };

  const handleClearIO = () => {
    clearInOutPoints(channelId, layer.id);
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

        {layer.isPlaying ? (
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
            title="Play"
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

      <div className="io-controls">
        <button
          className="io-btn"
          onClick={handleSetIn}
          disabled={!hasCurrentItem}
          title="Set In Point"
        >
          IN
        </button>

        <button
          className="io-btn"
          onClick={handleSetOut}
          disabled={!hasCurrentItem}
          title="Set Out Point"
        >
          OUT
        </button>

        <button
          className="io-btn io-btn-clear"
          onClick={handleClearIO}
          disabled={!hasCurrentItem}
          title="Clear In/Out Points"
        >
          CLR
        </button>
      </div>
    </div>
  );
}

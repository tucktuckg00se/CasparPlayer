import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Channel from './Channel';
import './ChannelsContainer.css';

export default function ChannelsContainer() {
  const { state, addChannel, addLayer, toggleExpandChannel, renameChannel } = useApp();
  const expandedChannelId = state.ui.expandedChannel;
  const isExpanded = expandedChannelId !== null;
  const expandedChannel = isExpanded ? state.channels.find(ch => ch.id === expandedChannelId) : null;

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const nameInputRef = useRef(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = () => {
    if (expandedChannel) {
      setEditName(expandedChannel.name);
      setIsEditingName(true);
    }
  };

  const handleNameChange = (e) => {
    setEditName(e.target.value);
  };

  const handleNameBlur = () => {
    const trimmedName = editName.trim();
    if (trimmedName && expandedChannel && trimmedName !== expandedChannel.name) {
      renameChannel(expandedChannelId, trimmedName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setEditName(expandedChannel?.name || '');
      setIsEditingName(false);
    }
  };

  return (
    <div className={`channels-container ${isExpanded ? 'has-expanded' : ''}`}>
      <div className="channels-header">
        {isExpanded ? (
          <>
            <button
              className="btn"
              onClick={() => toggleExpandChannel(null)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="19" y1="12" x2="5" y2="12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="12 19 5 12 12 5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to All Channels
            </button>
            <h2 className="channels-title">
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  className="expanded-channel-name-input"
                  value={editName}
                  onChange={handleNameChange}
                  onBlur={handleNameBlur}
                  onKeyDown={handleNameKeyDown}
                />
              ) : (
                <span
                  className="expanded-channel-name editable"
                  onClick={handleNameClick}
                  title="Click to rename"
                >
                  {expandedChannel?.name || 'Channel'}
                </span>
              )}
              {expandedChannel && (expandedChannel.channelResolution || expandedChannel.channelFrameRate) && (
                <span className="channel-format-inline">
                  {expandedChannel.channelResolution}
                  {expandedChannel.channelResolution && expandedChannel.channelFrameRate && ' / '}
                  {expandedChannel.channelFrameRate && `${expandedChannel.channelFrameRate}fps`}
                </span>
              )}
            </h2>
            <button className="btn btn-primary" onClick={() => addLayer(expandedChannelId)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
                <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Layer
            </button>
          </>
        ) : (
          <>
            <h2 className="channels-title">Channels</h2>
            <button className="btn btn-primary" onClick={addChannel}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
                <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Add Channel
            </button>
          </>
        )}
      </div>

      <div className="channels-grid">
        {state.channels.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
              <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2"/>
              <line x1="8" y1="21" x2="16" y2="21" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12" y2="21" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <h3>No Channels</h3>
            <p>Click "Add Channel" to create your first channel</p>
          </div>
        ) : (
          state.channels.map(channel => (
            <Channel
              key={channel.id}
              channel={channel}
              isExpanded={expandedChannelId === channel.id}
              isHidden={isExpanded && expandedChannelId !== channel.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
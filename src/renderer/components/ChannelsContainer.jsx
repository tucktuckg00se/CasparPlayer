import React from 'react';
import { useApp } from '../context/AppContext';
import Channel from './Channel';
import './ChannelsContainer.css';

export default function ChannelsContainer() {
  const { state, addChannel, addLayer, toggleExpandChannel } = useApp();
  const expandedChannelId = state.ui.expandedChannel;
  const isExpanded = expandedChannelId !== null;

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
              {state.channels.find(ch => ch.id === expandedChannelId)?.name || 'Channel'}
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
import React from 'react';
import { useApp } from '../context/AppContext';
import Layer from './Layer';
import Preview from './Preview';
import './ExpandedChannel.css';

export default function ExpandedChannel() {
  const { state, toggleExpandChannel, addLayer } = useApp();
  const channel = state.channels.find(ch => ch.id === state.ui.expandedChannel);

  if (!channel) {
    return null;
  }

  return (
    <div className="expanded-channel">
      <div className="expanded-header">
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
        <h2 className="expanded-title">{channel.name}</h2>
        <button
          className="btn btn-primary"
          onClick={() => addLayer(channel.id)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
            <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add Layer
        </button>
      </div>

      <div className="expanded-preview">
        <Preview channelId={channel.id} expanded={true} />
      </div>

      <div className="expanded-layers">
        {channel.layers.map(layer => (
          <Layer
            key={layer.id}
            layer={layer}
            channelId={channel.id}
            expanded={true}
          />
        ))}
      </div>
    </div>
  );
}

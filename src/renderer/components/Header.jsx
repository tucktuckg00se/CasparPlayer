import React from 'react';
import { useApp } from '../context/AppContext';
import './Header.css';

export default function Header() {
  const { connection, setShowConnectionDialog, setShowSettings, disconnect } = useApp();

  const handleConnectionClick = () => {
    if (connection.isConnected) {
      disconnect();
    } else {
      setShowConnectionDialog(true);
    }
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="app-logo">
          <div className="logo-icon">CP</div>
          <div className="logo-text">
            <div className="logo-title">CasparPlayer</div>
            <div className="logo-subtitle">Broadcast Playout</div>
          </div>
        </div>
      </div>

      <div className="header-center">
        {connection.serverInfo && (
          <div className="server-info">
            <span className="server-version">
              v{connection.serverInfo.version || 'Unknown'}
            </span>
          </div>
        )}
      </div>

      <div className="header-right">
        <button className="header-btn" onClick={handleSettingsClick} title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <div className="status-indicator" onClick={handleConnectionClick}>
          <span className={`status-dot ${connection.isConnected ? 'connected' : ''}`}></span>
          <span className="status-text">
            {connection.isConnected
              ? `Connected to ${connection.host}:${connection.port}`
              : 'Disconnected'
            }
          </span>
        </div>
      </div>
    </header>
  );
}
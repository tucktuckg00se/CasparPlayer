import React from 'react';
import { useApp } from '../context/AppContext';
import './Header.css';

export default function Header() {
  const { connection, setShowConnectionDialog, disconnect } = useApp();

  const handleConnectionClick = () => {
    if (connection.isConnected) {
      disconnect();
    } else {
      setShowConnectionDialog(true);
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="app-logo">
          <div className="logo-icon">CG</div>
          <div className="logo-text">
            <div className="logo-title">CasparCG</div>
            <div className="logo-subtitle">Advanced Client</div>
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
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import './ConnectionDialog.css';

export default function ConnectionDialog({ onClose }) {
  const { connection, settings, connectToCaspar, setShowSettings } = useApp();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async (e) => {
    e.preventDefault();
    setError(null);
    setConnecting(true);

    const success = await connectToCaspar(
      settings.host,
      settings.port,
      settings.oscPort,
      connection.previewUrl
    );

    setConnecting(false);

    if (success) {
      onClose();
    } else {
      setError('Failed to connect to CasparCG server. Please check your settings.');
    }
  };

  const handleOpenSettings = () => {
    onClose();
    setShowSettings(true);
  };

  const handleCancel = () => {
    if (!connection.isConnected) {
      // Don't allow closing if never connected
      return;
    }
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal connection-dialog">
        <div className="modal-header">
          <h2 className="modal-title">Connect to CasparCG Server</h2>
        </div>

        <form onSubmit={handleConnect}>
          <div className="modal-body">
            <div className="connection-info">
              <div className="connection-detail">
                <span className="detail-label">Host:</span>
                <span className="detail-value">{settings.host}</span>
              </div>
              <div className="connection-detail">
                <span className="detail-label">AMCP Port:</span>
                <span className="detail-value">{settings.port}</span>
              </div>
              <div className="connection-detail">
                <span className="detail-label">OSC Port:</span>
                <span className="detail-value">{settings.oscPort}</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-link settings-link"
              onClick={handleOpenSettings}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
              </svg>
              Change connection settings
            </button>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
          </div>

          <div className="modal-footer">
            {connection.isConnected && (
              <button
                type="button"
                className="btn"
                onClick={handleCancel}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={connecting}
            >
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
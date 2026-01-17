import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import './ConnectionDialog.css';

export default function ConnectionDialog({ onClose }) {
  const { connection, connectToCaspar } = useApp();
  const [host, setHost] = useState(connection.host || '127.0.0.1');
  const [port, setPort] = useState(connection.port || 5250);
  const [oscPort, setOscPort] = useState(connection.oscPort || 6250);
  const [previewUrl, setPreviewUrl] = useState(connection.previewUrl || '');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async (e) => {
    e.preventDefault();
    setError(null);
    setConnecting(true);

    const success = await connectToCaspar(host, port, oscPort, previewUrl);

    setConnecting(false);

    if (success) {
      onClose();
    } else {
      setError('Failed to connect to CasparCG server. Please check your settings.');
    }
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
            <div className="input-group">
              <label htmlFor="host">Host / IP Address</label>
              <input
                id="host"
                type="text"
                className="input"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="127.0.0.1"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="port">AMCP Port</label>
              <input
                id="port"
                type="number"
                className="input"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="5250"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="oscPort">OSC Port</label>
              <input
                id="oscPort"
                type="number"
                className="input"
                value={oscPort}
                onChange={(e) => setOscPort(e.target.value)}
                placeholder="6250"
                required
              />
            </div>

            <div className="input-group">
              <label htmlFor="previewUrl">Preview Stream URL (optional)</label>
              <input
                id="previewUrl"
                type="text"
                className="input"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                placeholder="http://host:port/stream?channel={channel}"
              />
              <span className="input-hint">Use {'{channel}'} as placeholder for channel number</span>
            </div>

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
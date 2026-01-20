import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import StyledSelect from './StyledSelect';
import './Settings.css';

export default function Settings({ onClose }) {
  const { settings, updateSettings, state, setMediaRoot, apiStatus } = useApp();
  const [editedSettings, setEditedSettings] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('connection');

  useEffect(() => {
    setEditedSettings({ ...settings });
  }, [settings]);

  const handleChange = (field, value) => {
    setEditedSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(editedSettings);
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectMediaFolder = async () => {
    const { ipcRenderer } = window.require('electron');
    try {
      const folderPath = await ipcRenderer.invoke('media:selectFolder');
      if (folderPath) {
        // Update local state
        setEditedSettings(prev => ({ ...prev, mediaFolderPath: folderPath }));
        // Auto-save just the mediaFolderPath - updateSettings merges with current settings
        // This avoids stale closure issues with editedSettings
        await updateSettings({ mediaFolderPath: folderPath });
        // Also scan and set the media folder
        const result = await ipcRenderer.invoke('media:scanFolder', folderPath);
        if (result.success) {
          setMediaRoot(folderPath, result.tree);
          await ipcRenderer.invoke('media:watchFolder', folderPath);
        }
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleClearMediaFolder = () => {
    handleChange('mediaFolderPath', '');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
        </div>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'connection' ? 'active' : ''}`}
            onClick={() => setActiveTab('connection')}
          >
            Connection
          </button>
          <button
            className={`settings-tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
          <button
            className={`settings-tab ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            Media
          </button>
          <button
            className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            API
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'connection' && (
            <div className="settings-section">
              <h3 className="settings-section-title">CasparCG Server</h3>

              <div className="input-group">
                <label htmlFor="host">Host / IP Address</label>
                <input
                  id="host"
                  type="text"
                  className="input"
                  value={editedSettings.host}
                  onChange={(e) => handleChange('host', e.target.value)}
                  placeholder="127.0.0.1"
                />
              </div>

              <div className="settings-row">
                <div className="input-group">
                  <label htmlFor="port">AMCP Port</label>
                  <input
                    id="port"
                    type="number"
                    className="input"
                    value={editedSettings.port}
                    onChange={(e) => handleChange('port', parseInt(e.target.value) || 5250)}
                    placeholder="5250"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="oscPort">OSC Port</label>
                  <input
                    id="oscPort"
                    type="number"
                    className="input"
                    value={editedSettings.oscPort}
                    onChange={(e) => handleChange('oscPort', parseInt(e.target.value) || 6250)}
                    placeholder="6250"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="settings-section">
              <h3 className="settings-section-title">Preview Settings</h3>

              <div className="input-group">
                <label htmlFor="previewQuality">Preview Quality (%)</label>
                <input
                  id="previewQuality"
                  type="number"
                  className="input"
                  value={editedSettings.previewQuality}
                  onChange={(e) => handleChange('previewQuality', Math.min(100, Math.max(0, parseInt(e.target.value) || 50)))}
                  min="0"
                  max="100"
                  placeholder="50"
                />
                <span className="input-hint">Lower values reduce bandwidth but decrease quality</span>
              </div>

              <div className="settings-row">
                <div className="input-group">
                  <label htmlFor="networkCache">Network Cache (ms)</label>
                  <input
                    id="networkCache"
                    type="number"
                    className="input"
                    value={editedSettings.networkCache}
                    onChange={(e) => handleChange('networkCache', parseInt(e.target.value) || 500)}
                    placeholder="500"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="previewPort">Preview Port</label>
                  <input
                    id="previewPort"
                    type="number"
                    className="input"
                    value={editedSettings.previewPort}
                    onChange={(e) => handleChange('previewPort', parseInt(e.target.value) || 9250)}
                    placeholder="9250"
                  />
                </div>
              </div>

              <h3 className="settings-section-title" style={{ marginTop: '20px' }}>MSE Streaming Options</h3>

              <div className="settings-row">
                <div className="input-group">
                  <label htmlFor="previewScale">Preview Resolution</label>
                  <StyledSelect
                    value={editedSettings.previewScale || '384:216'}
                    onChange={(value) => handleChange('previewScale', value)}
                    options={[
                      { value: '288:162', label: '288x162 (Low)' },
                      { value: '384:216', label: '384x216 (Default)' },
                      { value: '480:270', label: '480x270 (Medium)' },
                      { value: '640:360', label: '640x360 (High)' },
                      { value: '1280:720', label: '1280x720 (Higher)' },
                      { value: '1920:1080', label: '1920x1080 (Highest)' }
                    ]}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="previewPreset">Encoding Preset</label>
                  <StyledSelect
                    value={editedSettings.previewPreset || 'ultrafast'}
                    onChange={(value) => handleChange('previewPreset', value)}
                    options={[
                      { value: 'ultrafast', label: 'Ultrafast (Lowest Latency)' },
                      { value: 'superfast', label: 'Superfast' },
                      { value: 'veryfast', label: 'Veryfast' },
                      { value: 'faster', label: 'Faster' }
                    ]}
                  />
                </div>
              </div>

              <div className="settings-row">
                <div className="input-group">
                  <label htmlFor="previewTune">Encoding Tune</label>
                  <StyledSelect
                    value={editedSettings.previewTune || 'zerolatency'}
                    onChange={(value) => handleChange('previewTune', value)}
                    options={[
                      { value: 'zerolatency', label: 'Zero Latency (Live)' },
                      { value: 'film', label: 'Film' },
                      { value: 'animation', label: 'Animation' }
                    ]}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="previewAudioBitrate">Audio Bitrate</label>
                  <StyledSelect
                    value={editedSettings.previewAudioBitrate || '128k'}
                    onChange={(value) => handleChange('previewAudioBitrate', value)}
                    options={[
                      { value: '64k', label: '64k (Low)' },
                      { value: '96k', label: '96k' },
                      { value: '128k', label: '128k (Default)' },
                      { value: '192k', label: '192k (High)' }
                    ]}
                  />
                </div>
              </div>
              <span className="input-hint">These settings affect the fmp4 streaming from CasparCG to the preview window</span>

              <h3 className="settings-section-title" style={{ marginTop: '20px' }}>Playback Buffer</h3>
              <div className="input-group">
                <label htmlFor="previewBufferSize">Buffer Size (seconds)</label>
                <input
                  id="previewBufferSize"
                  type="number"
                  className="input"
                  value={editedSettings.previewBufferSize ?? 15}
                  onChange={(e) => handleChange('previewBufferSize', Math.min(30, Math.max(1, parseInt(e.target.value) || 15)))}
                  min="1"
                  max="30"
                  placeholder="15"
                />
                <span className="input-hint">
                  Higher values (10-15): Smoother playback, more delay<br/>
                  Lower values (2-5): Less delay, may stutter on slow connections<br/>
                  Reconnect preview after changing this setting
                </span>
              </div>

              <h3 className="settings-section-title" style={{ marginTop: '20px' }}>Auto-Connect</h3>
              <div className="input-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editedSettings.autoConnectPreviews || false}
                    onChange={(e) => handleChange('autoConnectPreviews', e.target.checked)}
                  />
                  Auto-connect previews when loading rundowns
                </label>
                <span className="input-hint">Automatically start live preview streams for all channels</span>
              </div>
            </div>
          )}

          {activeTab === 'media' && (
            <div className="settings-section">
              <h3 className="settings-section-title">Media Settings</h3>

              <div className="input-group">
                <label htmlFor="defaultImageDuration">Default Image Duration (seconds)</label>
                <input
                  id="defaultImageDuration"
                  type="number"
                  className="input"
                  value={editedSettings.defaultImageDuration}
                  onChange={(e) => handleChange('defaultImageDuration', parseInt(e.target.value) || 5)}
                  min="1"
                  placeholder="5"
                />
                <span className="input-hint">How long images display before auto-advancing in playlists</span>
              </div>

              <div className="input-group">
                <label htmlFor="defaultMacroDuration">Default Macro Duration (seconds)</label>
                <input
                  id="defaultMacroDuration"
                  type="number"
                  className="input"
                  value={editedSettings.defaultMacroDuration || 5}
                  onChange={(e) => handleChange('defaultMacroDuration', parseInt(e.target.value) || 5)}
                  min="1"
                  placeholder="5"
                />
                <span className="input-hint">How long standalone macro items run before auto-advancing</span>
              </div>

              <div className="input-group">
                <label>Media Folder Path</label>
                <div className="folder-input-row">
                  <input
                    type="text"
                    className="input"
                    value={editedSettings.mediaFolderPath}
                    readOnly
                    placeholder="No folder selected"
                  />
                  <button className="btn" onClick={handleSelectMediaFolder}>
                    Browse...
                  </button>
                  {editedSettings.mediaFolderPath && (
                    <button className="btn btn-danger-subtle" onClick={handleClearMediaFolder}>
                      Clear
                    </button>
                  )}
                </div>
                <span className="input-hint">The folder will be auto-loaded on startup</span>
              </div>

              <h3 className="settings-section-title" style={{ marginTop: '20px' }}>Session</h3>
              <div className="input-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editedSettings.autoLoadLastSession !== false}
                    onChange={(e) => handleChange('autoLoadLastSession', e.target.checked)}
                  />
                  Auto-load last session on startup
                </label>
                <span className="input-hint">Restore channels and playlists from previous session</span>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="settings-section">
              <h3 className="settings-section-title">External Control API</h3>

              <div className="input-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editedSettings.apiEnabled || false}
                    onChange={(e) => handleChange('apiEnabled', e.target.checked)}
                  />
                  Enable HTTP/WebSocket API
                </label>
                <span className="input-hint">Allow external applications to control this client</span>
              </div>

              <div className="input-group">
                <label htmlFor="apiPort">API Port</label>
                <input
                  id="apiPort"
                  type="number"
                  className="input"
                  value={editedSettings.apiPort || 8088}
                  onChange={(e) => handleChange('apiPort', parseInt(e.target.value) || 8088)}
                  disabled={!editedSettings.apiEnabled}
                />
                <span className="input-hint">HTTP and WebSocket server port</span>
              </div>

              {editedSettings.apiEnabled && (
                <div className="api-info" style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: apiStatus?.isRunning ? 'var(--success)' : 'var(--text-secondary)' }}>
                      {apiStatus?.isRunning ? 'Server Running' : 'Server Stopped'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    <div><strong>REST:</strong> http://127.0.0.1:{editedSettings.apiPort || 8088}/api/</div>
                    <div><strong>WebSocket:</strong> ws://127.0.0.1:{editedSettings.apiPort || 8088}/ws</div>
                  </div>
                </div>
              )}

              <h3 className="settings-section-title" style={{ marginTop: '20px' }}>API Documentation</h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                <p style={{ marginBottom: '8px' }}>Available endpoints:</p>
                <ul style={{ marginLeft: '16px', marginBottom: '8px' }}>
                  <li><code>POST /api/command</code> - Execute commands</li>
                  <li><code>GET /api/state</code> - Get current state</li>
                  <li><code>GET /api/status</code> - Get server status</li>
                  <li><code>GET /api/commands</code> - List available commands</li>
                </ul>
                <p>WebSocket clients receive real-time state updates.</p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

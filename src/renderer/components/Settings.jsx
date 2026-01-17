import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import './Settings.css';

export default function Settings({ onClose }) {
  const { settings, updateSettings, state, setMediaRoot } = useApp();
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
        handleChange('mediaFolderPath', folderPath);
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

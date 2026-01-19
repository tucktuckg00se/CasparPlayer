import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import './RundownList.css';

export default function RundownList() {
  const { rundowns, saveRundown, loadRundown, deleteRundown, loadRundownList, clearAllChannels } = useApp();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [rundownName, setRundownName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [showNewConfirm, setShowNewConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // stores rundown name to delete

  const handleSaveClick = () => {
    setShowSaveDialog(true);
    setRundownName('');
    setError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!rundownName.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const result = await saveRundown(rundownName.trim());
      if (result.success) {
        setShowSaveDialog(false);
        setRundownName('');
      } else {
        setError(result.error || 'Failed to save rundown');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (name) => {
    setLoading(name);
    setError(null);
    try {
      const result = await loadRundown(name);
      if (!result.success) {
        setError(result.error || 'Failed to load rundown');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = (name) => {
    setDeleteConfirm(name);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const result = await deleteRundown(deleteConfirm);
      if (!result.success) {
        setError(result.error || 'Failed to delete rundown');
      }
    } catch (err) {
      setError(err.message);
    }
    setDeleteConfirm(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleNewRundown = () => {
    setShowNewConfirm(true);
  };

  const confirmNewRundown = () => {
    clearAllChannels();
    setShowNewConfirm(false);
  };

  return (
    <div className="rundown-list">
      <div className="rundown-list-header">
        <button className="btn btn-secondary" onClick={handleNewRundown} title="New Rundown">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
            <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          New
        </button>
        <button className="btn btn-primary" onClick={handleSaveClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeWidth="2"/>
            <polyline points="17 21 17 13 7 13 7 21" strokeWidth="2"/>
            <polyline points="7 3 7 8 15 8" strokeWidth="2"/>
          </svg>
          Save
        </button>
        <button className="btn btn-icon" onClick={loadRundownList} title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M23 4v6h-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 20v-6h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {error && (
        <div className="rundown-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      {showSaveDialog && (
        <div className="save-dialog">
          <form onSubmit={handleSave}>
            <input
              type="text"
              className="input"
              autoFocus
              value={rundownName}
              onChange={(e) => setRundownName(e.target.value)}
              placeholder="Enter rundown name..."
            />
            <div className="save-dialog-actions">
              <button type="button" className="btn" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || !rundownName.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showNewConfirm && (
        <div className="save-dialog confirm-dialog">
          <p>Create a new rundown? This will clear all current channels and playlists.</p>
          <div className="save-dialog-actions">
            <button type="button" className="btn" onClick={() => setShowNewConfirm(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmNewRundown}>
              Create New
            </button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="save-dialog confirm-dialog">
          <p>Delete rundown "{deleteConfirm}"?</p>
          <div className="save-dialog-actions">
            <button type="button" className="btn" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDelete}>
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="rundown-items">
        {rundowns.filter(r => r.id !== '__LastSession__').length === 0 ? (
          <div className="rundown-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeWidth="2"/>
            </svg>
            <p>No saved rundowns</p>
            <p className="text-sm text-tertiary">Click "Save Current" to save your current setup</p>
          </div>
        ) : (
          rundowns.filter(r => r.id !== '__LastSession__').map(rundown => (
            <div key={rundown.id} className="rundown-item">
              <div className="rundown-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeWidth="2"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeWidth="2"/>
                </svg>
              </div>
              <div className="rundown-info">
                <span className="rundown-name">{rundown.name}</span>
                <span className="rundown-meta">
                  {rundown.channelCount} channel{rundown.channelCount !== 1 ? 's' : ''} | {formatDate(rundown.savedAt)}
                </span>
              </div>
              <div className="rundown-actions">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleLoad(rundown.id)}
                  disabled={loading === rundown.id}
                >
                  {loading === rundown.id ? 'Loading...' : 'Load'}
                </button>
                <button
                  className="btn-icon btn-sm btn-danger-icon"
                  onClick={() => handleDelete(rundown.id)}
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="3 6 5 6 21 6" strokeWidth="2"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

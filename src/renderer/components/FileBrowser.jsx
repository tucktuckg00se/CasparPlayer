import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import FileTree from './FileTree';
import MediaPreview from './MediaPreview';
import './FileBrowser.css';

export default function FileBrowser() {
  const { state, setMediaRoot, selectMediaFile, toggleFolderExpand } = useApp();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Listen for media folder changes
    const { ipcRenderer } = window.require('electron');

    const handleMediaChange = (event, { eventType, filePath }) => {
      console.log('Media changed:', eventType, filePath);
      // Rescan folder on changes
      if (state.media.rootPath) {
        scanFolder(state.media.rootPath);
      }
    };

    ipcRenderer.on('media:changed', handleMediaChange);

    return () => {
      ipcRenderer.removeListener('media:changed', handleMediaChange);
    };
  }, [state.media.rootPath]);

  const handleOpenFolder = async () => {
    const { ipcRenderer } = window.require('electron');

    try {
      const folderPath = await ipcRenderer.invoke('media:selectFolder');
      if (folderPath) {
        await scanFolder(folderPath);
        // Start watching for changes
        await ipcRenderer.invoke('media:watchFolder', folderPath);
      }
    } catch (err) {
      console.error('Error opening folder:', err);
      setError('Failed to open folder');
    }
  };

  const scanFolder = async (folderPath) => {
    const { ipcRenderer } = window.require('electron');

    setIsScanning(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('media:scanFolder', folderPath);
      if (result.success) {
        setMediaRoot(folderPath, result.tree);
      } else {
        setError(result.error || 'Failed to scan folder');
      }
    } catch (err) {
      console.error('Error scanning folder:', err);
      setError('Failed to scan folder');
    } finally {
      setIsScanning(false);
    }
  };

  const handleRefresh = () => {
    if (state.media.rootPath) {
      scanFolder(state.media.rootPath);
    }
  };

  const handleSelectFile = useCallback(async (file) => {
    const { ipcRenderer } = window.require('electron');

    // Get metadata for the file if not already loaded
    if (!file.metadata && (file.type === 'video' || file.type === 'image')) {
      const metadata = await ipcRenderer.invoke('media:getMetadata', file.path, file.type);
      selectMediaFile({ ...file, metadata });
    } else {
      selectMediaFile(file);
    }
  }, [selectMediaFile]);

  const handleToggleFolder = useCallback((folderId) => {
    toggleFolderExpand(folderId);
  }, [toggleFolderExpand]);

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <button className="btn btn-primary" onClick={handleOpenFolder} disabled={isScanning}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeWidth="2"/>
          </svg>
          {isScanning ? 'Scanning...' : 'Open Media Folder'}
        </button>
        {state.media.rootPath && (
          <button className="btn btn-icon" onClick={handleRefresh} disabled={isScanning} title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M23 4v6h-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1 20v-6h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="file-browser-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="file-browser-content">
        {!state.media.rootPath ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" strokeWidth="2"/>
            </svg>
            <p>No media folder selected</p>
            <p className="text-sm text-tertiary">Click "Open Media Folder" to browse your media files</p>
          </div>
        ) : (
          <>
            <div className="file-browser-path">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
              <span title={state.media.rootPath}>{getFolderName(state.media.rootPath)}</span>
            </div>
            <div className="file-tree-container">
              {isScanning ? (
                <div className="scanning-indicator">
                  <div className="loading-spinner" />
                  <span>Scanning...</span>
                </div>
              ) : (
                <FileTree
                  items={state.media.tree}
                  onSelect={handleSelectFile}
                  onToggle={handleToggleFolder}
                  selectedFile={state.media.selectedFile}
                />
              )}
            </div>
          </>
        )}
      </div>

      <div className="file-browser-preview">
        <MediaPreview file={state.media.selectedFile} />
      </div>
    </div>
  );
}

function getFolderName(path) {
  if (!path) return '';
  const parts = path.split(/[\/\\]/);
  return parts[parts.length - 1] || path;
}

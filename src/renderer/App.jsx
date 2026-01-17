import React, { useState, useEffect, useRef } from 'react';
import './styles/App.css';
import ConnectionDialog from './components/ConnectionDialog';
import Settings from './components/Settings';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChannelsContainer from './components/ChannelsContainer';
import ExpandedChannel from './components/ExpandedChannel';
import { AppProvider, useApp } from './context/AppContext';

function AppContent() {
  const {
    state,
    showConnectionDialog,
    setShowConnectionDialog,
    showSettings,
    setShowSettings,
    connection,
    connectToCaspar,
    settings,
    saveRundown,
    rundowns
  } = useApp();
  const autoConnectAttempted = useRef(false);
  const [currentRundownName, setCurrentRundownName] = useState(null);

  useEffect(() => {
    // Remove loading screen when app is ready
    const loadingScreen = document.querySelector('.loading-screen');
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => loadingScreen.remove(), 300);
      }, 500);
    }
  }, []);

  // Auto-connect on startup with saved settings (no dialog)
  useEffect(() => {
    if (!autoConnectAttempted.current && !connection.isConnected && settings.host) {
      autoConnectAttempted.current = true;
      // Attempt silent auto-connect
      connectToCaspar(
        settings.host || '127.0.0.1',
        settings.port || 5250,
        settings.oscPort || 6250,
        connection.previewUrl || ''
      ).catch((err) => {
        console.log('Auto-connect failed:', err.message);
        // Don't show dialog automatically - user can click status to connect
      });
    }
  }, [settings.host, settings.port, settings.oscPort, connection.isConnected, connectToCaspar, connection.previewUrl]);

  // Handle Ctrl+S for saving rundown
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRundown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRundownName, state.channels]);

  const handleSaveRundown = async () => {
    if (state.channels.length === 0) {
      return; // Nothing to save
    }

    if (currentRundownName) {
      // Quick save to existing rundown
      await saveRundown(currentRundownName);
    } else {
      // Prompt for name
      const name = window.prompt('Enter rundown name:');
      if (name && name.trim()) {
        const result = await saveRundown(name.trim());
        if (result.success) {
          setCurrentRundownName(name.trim());
        }
      }
    }
  };

  return (
    <div className="app">
      {showConnectionDialog && (
        <ConnectionDialog onClose={() => setShowConnectionDialog(false)} />
      )}

      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}

      <Header />

      <div className="app-main">
        <Sidebar />

        <div className="content-area">
          {state.ui.currentView === 'multi' ? (
            <ChannelsContainer />
          ) : (
            <ExpandedChannel />
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
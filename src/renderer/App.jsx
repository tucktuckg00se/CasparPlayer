import React, { useState, useEffect } from 'react';
import './styles/App.css';
import ConnectionDialog from './components/ConnectionDialog';
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
    connection 
  } = useApp();

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

  // Show connection dialog on first launch or when disconnected
  useEffect(() => {
    if (!connection.isConnected && !showConnectionDialog) {
      setShowConnectionDialog(true);
    }
  }, [connection.isConnected]);

  return (
    <div className="app">
      {showConnectionDialog && (
        <ConnectionDialog onClose={() => setShowConnectionDialog(false)} />
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
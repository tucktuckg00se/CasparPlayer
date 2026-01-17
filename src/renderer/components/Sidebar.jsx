import React from 'react';
import { useApp } from '../context/AppContext';
import FileBrowser from './FileBrowser';
import MacroList from './MacroList';
import RundownList from './RundownList';
import './Sidebar.css';

export default function Sidebar() {
  const { state, setSidebarTab } = useApp();
  const { sidebarTab } = state.ui;

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${sidebarTab === 'files' ? 'active' : ''}`}
          onClick={() => setSidebarTab('files')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="13 2 13 9 20 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Files
        </button>

        <button
          className={`sidebar-tab ${sidebarTab === 'macros' ? 'active' : ''}`}
          onClick={() => setSidebarTab('macros')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="3" strokeWidth="2"/>
            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Macros
        </button>

        <button
          className={`sidebar-tab ${sidebarTab === 'rundowns' ? 'active' : ''}`}
          onClick={() => setSidebarTab('rundowns')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Rundowns
        </button>
      </div>

      <div className="sidebar-content">
        {sidebarTab === 'files' && <FileBrowser />}
        {sidebarTab === 'macros' && <MacroList />}
        {sidebarTab === 'rundowns' && <RundownList />}
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DRAG_TYPES, setDragEventData } from './DragDropProvider';
import MacroEditor from './MacroEditor';
import './MacroList.css';

export default function MacroList() {
  const { state, createMacro, updateMacro, deleteMacro, executeMacro } = useApp();
  const [showEditor, setShowEditor] = useState(false);
  const [editingMacro, setEditingMacro] = useState(null);

  const handleNewMacro = () => {
    setEditingMacro(null);
    setShowEditor(true);
  };

  const handleEditMacro = (macro) => {
    setEditingMacro(macro);
    setShowEditor(true);
  };

  const handleSaveMacro = async (macro) => {
    if (editingMacro) {
      await updateMacro(macro);
    } else {
      await createMacro(macro);
    }
    setShowEditor(false);
    setEditingMacro(null);
  };

  const handleDeleteMacro = async (macro) => {
    if (confirm(`Delete macro "${macro.name}"? This cannot be undone.`)) {
      await deleteMacro(macro.id);
    }
  };

  const handleExecuteMacro = async (macro) => {
    await executeMacro(macro);
  };

  return (
    <div className="macro-list">
      <div className="macro-list-header">
        <button className="btn btn-primary" onClick={handleNewMacro}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
            <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          New Macro
        </button>
      </div>

      <div className="macro-list-content">
        {state.macros.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
              <circle cx="12" cy="12" r="3" strokeWidth="2"/>
              <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p>No macros created</p>
            <p className="text-sm text-tertiary">Create macros to automate CasparCG commands</p>
          </div>
        ) : (
          <div className="macros">
            {state.macros.map(macro => (
              <MacroItem
                key={macro.id}
                macro={macro}
                onEdit={() => handleEditMacro(macro)}
                onDelete={() => handleDeleteMacro(macro)}
                onExecute={() => handleExecuteMacro(macro)}
              />
            ))}
          </div>
        )}
      </div>

      {showEditor && (
        <MacroEditor
          macro={editingMacro}
          onSave={handleSaveMacro}
          onCancel={() => {
            setShowEditor(false);
            setEditingMacro(null);
          }}
        />
      )}
    </div>
  );
}

function MacroItem({ macro, onEdit, onDelete, onExecute }) {
  const handleDragStart = (e) => {
    setDragEventData(e, DRAG_TYPES.MACRO, {
      id: macro.id,
      name: macro.name,
      color: macro.color,
      commands: macro.commands
    });
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  return (
    <div
      className="macro-item"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="macro-color"
        style={{ backgroundColor: macro.color || '#ff6432' }}
      />

      <div className="macro-info">
        <span className="macro-name">{macro.name}</span>
        {macro.description && (
          <span className="macro-description">{macro.description}</span>
        )}
        <span className="macro-commands">
          {macro.commands?.length || 0} command{macro.commands?.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="macro-actions">
        <button
          className="btn-icon"
          onClick={onExecute}
          title="Run Macro"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>

        <button
          className="btn-icon"
          onClick={onEdit}
          title="Edit Macro"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          className="btn-icon btn-danger-icon"
          onClick={onDelete}
          title="Delete Macro"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="3 6 5 6 21 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

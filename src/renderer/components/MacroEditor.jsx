import React, { useState, useEffect } from 'react';
import { createMacroTemplate, createCommandTemplate } from '../services/macroExecutor';
import { getCommandTypesForEditor } from '../services/commandHandler';
import { createDefaultOffset } from '../utils/timecode';
import StyledSelect from './StyledSelect';
import OffsetTimecodeInput from './OffsetTimecodeInput';
import './MacroEditor.css';

// Get command types from unified command handler
const COMMAND_TYPES = getCommandTypesForEditor();

export default function MacroEditor({ macro, onSave, onCancel }) {
  const [editedMacro, setEditedMacro] = useState(null);

  useEffect(() => {
    if (macro) {
      setEditedMacro({ ...macro });
    } else {
      setEditedMacro(createMacroTemplate());
    }
  }, [macro]);

  if (!editedMacro) return null;

  const handleChange = (field, value) => {
    setEditedMacro(prev => ({
      ...prev,
      [field]: value,
      updatedAt: new Date().toISOString()
    }));
  };

  const handleAddCommand = () => {
    setEditedMacro(prev => ({
      ...prev,
      commands: [...prev.commands, createCommandTemplate()]
    }));
  };

  const handleUpdateCommand = (index, updates) => {
    setEditedMacro(prev => ({
      ...prev,
      commands: prev.commands.map((cmd, i) =>
        i === index ? { ...cmd, ...updates } : cmd
      )
    }));
  };

  const handleRemoveCommand = (index) => {
    setEditedMacro(prev => ({
      ...prev,
      commands: prev.commands.filter((_, i) => i !== index)
    }));
  };

  const handleMoveCommand = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= editedMacro.commands.length) return;

    setEditedMacro(prev => {
      const newCommands = [...prev.commands];
      [newCommands[index], newCommands[newIndex]] = [newCommands[newIndex], newCommands[index]];
      return { ...prev, commands: newCommands };
    });
  };

  const handleSave = () => {
    onSave(editedMacro);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="macro-editor modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {macro ? 'Edit Macro' : 'New Macro'}
          </h2>
        </div>

        <div className="modal-body">
          <div className="macro-form">
            <div className="input-group">
              <label>Name</label>
              <input
                type="text"
                className="input"
                value={editedMacro.name}
                onChange={e => handleChange('name', e.target.value)}
                placeholder="Macro name"
              />
            </div>

            <div className="input-group">
              <label>Description</label>
              <input
                type="text"
                className="input"
                value={editedMacro.description}
                onChange={e => handleChange('description', e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>Color</label>
                <input
                  type="color"
                  className="input input-color"
                  value={editedMacro.color}
                  onChange={e => handleChange('color', e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editedMacro.continueOnError}
                    onChange={e => handleChange('continueOnError', e.target.checked)}
                  />
                  Continue on error
                </label>
              </div>
            </div>
          </div>

          <div className="commands-section">
            <div className="commands-header">
              <h3>Commands</h3>
              <button className="btn btn-primary btn-sm" onClick={handleAddCommand}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Add Command
              </button>
            </div>

            <div className="commands-list">
              {editedMacro.commands.length === 0 ? (
                <div className="commands-empty">
                  <p>No commands. Click "Add Command" to start.</p>
                </div>
              ) : (
                editedMacro.commands.map((command, index) => (
                  <CommandEditor
                    key={index}
                    command={command}
                    index={index}
                    total={editedMacro.commands.length}
                    onUpdate={(updates) => handleUpdateCommand(index, updates)}
                    onRemove={() => handleRemoveCommand(index)}
                    onMove={(dir) => handleMoveCommand(index, dir)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!editedMacro.name.trim()}
          >
            Save Macro
          </button>
        </div>
      </div>
    </div>
  );
}

function CommandEditor({ command, index, total, onUpdate, onRemove, onMove }) {
  const handleParamChange = (key, value) => {
    onUpdate({
      params: { ...command.params, [key]: value }
    });
  };

  // Handle offset change from OffsetTimecodeInput
  const handleOffsetChange = (offset) => {
    onUpdate({ offset });
  };

  // Ensure command has offset object (migrate from legacy delay)
  const getOffset = () => {
    if (command.offset) return command.offset;
    // Migrate legacy delay (ms) to offset
    if (command.delay > 0) {
      const totalSeconds = command.delay / 1000;
      const seconds = Math.floor(totalSeconds);
      const frames = Math.round((totalSeconds % 1) * 25); // Assume 25fps for legacy
      return { hours: 0, minutes: 0, seconds, frames, negative: false };
    }
    return createDefaultOffset();
  };

  return (
    <div className="command-editor">
      <div className="command-header">
        <span className="command-index">{index + 1}</span>

        <StyledSelect
          className="command-type"
          value={command.type}
          onChange={(value) => onUpdate({ type: value })}
          options={COMMAND_TYPES.map(t => ({
            value: t.value,
            label: t.label,
            description: t.description,
            category: t.category
          }))}
          groupBy="category"
        />

        <div className="command-actions">
          <button
            className="btn-icon btn-sm"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            title="Move Up"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14l5-5 5 5H7z"/>
            </svg>
          </button>
          <button
            className="btn-icon btn-sm"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Move Down"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5H7z"/>
            </svg>
          </button>
          <button
            className="btn-icon btn-sm btn-danger-icon"
            onClick={onRemove}
            title="Remove"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="command-params">
        <div className="param-row">
          <label>Channel</label>
          <input
            type="number"
            className="input param-input"
            value={command.channel}
            onChange={e => onUpdate({ channel: parseInt(e.target.value) || 1 })}
            min="1"
          />

          <label>Layer</label>
          <input
            type="number"
            className="input param-input"
            value={command.layer}
            onChange={e => onUpdate({ layer: parseInt(e.target.value) || 1 })}
            min="1"
          />

          <label>Offset</label>
          <OffsetTimecodeInput
            value={getOffset()}
            onChange={handleOffsetChange}
            frameRate={25}
            allowNegative={true}
            compact={true}
          />
        </div>

        {(command.type === 'casparPlay' || command.type === 'casparLoadBg') && (
          <div className="param-row">
            <label>Clip</label>
            <input
              type="text"
              className="input"
              value={command.params.clip || ''}
              onChange={e => handleParamChange('clip', e.target.value)}
              placeholder="Filename without extension"
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={command.params.loop || false}
                onChange={e => handleParamChange('loop', e.target.checked)}
              />
              Loop
            </label>
          </div>
        )}

        {command.type === 'cgAdd' && (
          <div className="param-row">
            <label>Template</label>
            <input
              type="text"
              className="input"
              value={command.params.template || ''}
              onChange={e => handleParamChange('template', e.target.value)}
              placeholder="Template name"
            />
          </div>
        )}

        {command.type === 'custom' && (
          <div className="param-row">
            <label>AMCP Command</label>
            <input
              type="text"
              className="input"
              value={command.params.amcp || ''}
              onChange={e => handleParamChange('amcp', e.target.value)}
              placeholder="e.g., PLAY 1-10 AMB LOOP"
            />
          </div>
        )}

        {command.type === 'loadRundown' && (
          <div className="param-row">
            <label>Rundown Name</label>
            <input
              type="text"
              className="input"
              value={command.params.name || ''}
              onChange={e => handleParamChange('name', e.target.value)}
              placeholder="Rundown name"
            />
          </div>
        )}

        {command.type === 'executeMacro' && (
          <div className="param-row">
            <label>Macro ID</label>
            <input
              type="text"
              className="input"
              value={command.params.macroId || ''}
              onChange={e => handleParamChange('macroId', e.target.value)}
              placeholder="Macro ID"
            />
          </div>
        )}
      </div>
    </div>
  );
}

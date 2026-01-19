// Macro Executor Service
// Executes macro command sequences using the unified command handler

import { executeCommand as executeUnifiedCommand, LEGACY_COMMAND_MAP } from './commandHandler';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeMacro(macro, casparCG, context = {}) {
  if (!macro || !macro.commands || macro.commands.length === 0) {
    throw new Error('Invalid macro: no commands');
  }

  const results = [];
  let hasError = false;

  for (const command of macro.commands) {
    if (hasError && !macro.continueOnError) {
      break;
    }

    try {
      // Build params object from command
      const params = {
        channel: command.channel,
        layer: command.layer,
        ...(command.params || {})
      };

      // Execute using unified command handler (handles legacy command type mapping)
      const result = await executeUnifiedCommand(
        command.type,
        params,
        { ...context, casparCG }
      );

      results.push({ command, success: result.success !== false, result });

      // Wait if delay is specified
      if (command.delay > 0) {
        await delay(command.delay);
      }
    } catch (error) {
      console.error('Macro command failed:', command, error);
      results.push({ command, success: false, error: error.message });
      hasError = true;
    }
  }

  return {
    success: !hasError,
    results,
    macro: macro.name
  };
}

export function createMacroTemplate() {
  return {
    id: null,
    name: 'New Macro',
    description: '',
    color: '#ff6432', // Default macro color
    commands: [],
    continueOnError: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function createCommandTemplate(type = 'PLAY') {
  return {
    type,
    channel: 1,
    layer: 10,
    params: {},
    delay: 0
  };
}

export const COMMAND_TYPES = [
  // CasparCG commands
  { value: 'PLAY', label: 'Play', description: 'Play media on a layer', category: 'caspar' },
  { value: 'LOADBG', label: 'Load BG', description: 'Load media in background', category: 'caspar' },
  { value: 'PAUSE', label: 'Pause', description: 'Pause playback', category: 'caspar' },
  { value: 'RESUME', label: 'Resume', description: 'Resume playback', category: 'caspar' },
  { value: 'STOP', label: 'Stop', description: 'Stop playback', category: 'caspar' },
  { value: 'CLEAR', label: 'Clear', description: 'Clear layer', category: 'caspar' },
  { value: 'CG_ADD', label: 'CG Add', description: 'Add template to layer', category: 'caspar' },
  { value: 'CG_PLAY', label: 'CG Play', description: 'Play template', category: 'caspar' },
  { value: 'CG_STOP', label: 'CG Stop', description: 'Stop template', category: 'caspar' },
  { value: 'CG_UPDATE', label: 'CG Update', description: 'Update template data', category: 'caspar' },
  { value: 'CUSTOM', label: 'Custom', description: 'Custom AMCP command', category: 'caspar' },
  // Client-side commands
  { value: 'CLIENT_TOGGLE_PLAYLIST_MODE', label: 'Toggle Playlist Mode', description: 'Toggle auto-advance mode', category: 'client' },
  { value: 'CLIENT_TOGGLE_LOOP_MODE', label: 'Toggle Loop Mode', description: 'Toggle playlist looping', category: 'client' },
  { value: 'CLIENT_TOGGLE_LOOP_ITEM', label: 'Toggle Loop Item', description: 'Toggle item loop', category: 'client' },
  { value: 'CLIENT_ADD_CHANNEL', label: 'Add Channel', description: 'Add new channel', category: 'client' },
  { value: 'CLIENT_ADD_LAYER', label: 'Add Layer', description: 'Add layer to channel', category: 'client' },
  { value: 'CLIENT_NEXT_ITEM', label: 'Next Item', description: 'Go to next playlist item', category: 'client' },
  { value: 'CLIENT_PREV_ITEM', label: 'Previous Item', description: 'Go to previous playlist item', category: 'client' },
  { value: 'CLIENT_LOAD_RUNDOWN', label: 'Load Rundown', description: 'Load saved rundown', category: 'client' }
];

export default {
  executeMacro,
  createMacroTemplate,
  createCommandTemplate,
  COMMAND_TYPES
};

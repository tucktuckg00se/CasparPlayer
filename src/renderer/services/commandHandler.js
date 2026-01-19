// Unified Command Handler
// Single command system shared by API and macros

import casparCommands from './casparCommands';

// Command definitions with metadata
export const COMMANDS = {
  // ============ Transport (Client-side) ============
  play: {
    params: ['channel', 'layer', 'itemIndex?'],
    description: 'Play playlist item at index (or current)',
    category: 'transport'
  },
  pause: {
    params: ['channel', 'layer'],
    description: 'Pause playback (handles images too)',
    category: 'transport'
  },
  resume: {
    params: ['channel', 'layer'],
    description: 'Resume paused playback',
    category: 'transport'
  },
  stop: {
    params: ['channel', 'layer'],
    description: 'Stop playback',
    category: 'transport'
  },
  next: {
    params: ['channel', 'layer'],
    description: 'Go to next playlist item',
    category: 'transport'
  },
  prev: {
    params: ['channel', 'layer'],
    description: 'Go to previous playlist item',
    category: 'transport'
  },

  // ============ Mode toggles (Client-side) ============
  togglePlaylistMode: {
    params: ['channel', 'layer'],
    description: 'Toggle auto-advance mode',
    category: 'client'
  },
  toggleLoopMode: {
    params: ['channel', 'layer'],
    description: 'Toggle playlist looping',
    category: 'client'
  },
  toggleLoopItem: {
    params: ['channel', 'layer'],
    description: 'Toggle single item loop',
    category: 'client'
  },

  // ============ Rundown (Client-side) ============
  loadRundown: {
    params: ['name'],
    description: 'Load a saved rundown by name',
    category: 'client'
  },
  saveRundown: {
    params: ['name'],
    description: 'Save current rundown with name',
    category: 'client'
  },
  clearAll: {
    params: [],
    description: 'Clear all channels (new rundown)',
    category: 'client'
  },

  // ============ Channel/Layer management (Client-side) ============
  addChannel: {
    params: [],
    description: 'Add a new channel',
    category: 'client'
  },
  addLayer: {
    params: ['channel'],
    description: 'Add layer to channel',
    category: 'client'
  },
  deleteChannel: {
    params: ['channel'],
    description: 'Delete a channel',
    category: 'client'
  },
  deleteLayer: {
    params: ['channel', 'layer'],
    description: 'Delete a layer',
    category: 'client'
  },

  // ============ Direct CasparCG (Server commands) ============
  casparPlay: {
    params: ['channel', 'layer', 'clip', 'options?'],
    description: 'Direct PLAY command to CasparCG',
    category: 'caspar'
  },
  casparStop: {
    params: ['channel', 'layer'],
    description: 'Direct STOP command to CasparCG',
    category: 'caspar'
  },
  casparPause: {
    params: ['channel', 'layer'],
    description: 'Direct PAUSE command to CasparCG',
    category: 'caspar'
  },
  casparResume: {
    params: ['channel', 'layer'],
    description: 'Direct RESUME command to CasparCG',
    category: 'caspar'
  },
  casparClear: {
    params: ['channel', 'layer?'],
    description: 'Clear a layer (or whole channel)',
    category: 'caspar'
  },
  casparLoadBg: {
    params: ['channel', 'layer', 'clip', 'options?'],
    description: 'Load media in background',
    category: 'caspar'
  },
  cgAdd: {
    params: ['channel', 'layer', 'template', 'playOnLoad?', 'data?'],
    description: 'Add template to layer',
    category: 'caspar'
  },
  cgPlay: {
    params: ['channel', 'layer'],
    description: 'Play template on layer',
    category: 'caspar'
  },
  cgStop: {
    params: ['channel', 'layer'],
    description: 'Stop template on layer',
    category: 'caspar'
  },
  cgUpdate: {
    params: ['channel', 'layer', 'data'],
    description: 'Update template data',
    category: 'caspar'
  },
  custom: {
    params: ['amcp'],
    description: 'Execute raw AMCP command',
    category: 'caspar'
  },

  // ============ Macro ============
  executeMacro: {
    params: ['macroId'],
    description: 'Execute a saved macro by ID',
    category: 'macro'
  }
};

// Map old macro command types to new unified commands
export const LEGACY_COMMAND_MAP = {
  'PLAY': 'casparPlay',
  'LOADBG': 'casparLoadBg',
  'PAUSE': 'casparPause',
  'RESUME': 'casparResume',
  'STOP': 'casparStop',
  'CLEAR': 'casparClear',
  'CG_ADD': 'cgAdd',
  'CG_PLAY': 'cgPlay',
  'CG_STOP': 'cgStop',
  'CG_UPDATE': 'cgUpdate',
  'CUSTOM': 'custom',
  'CLIENT_TOGGLE_PLAYLIST_MODE': 'togglePlaylistMode',
  'CLIENT_TOGGLE_LOOP_MODE': 'toggleLoopMode',
  'CLIENT_TOGGLE_LOOP_ITEM': 'toggleLoopItem',
  'CLIENT_ADD_CHANNEL': 'addChannel',
  'CLIENT_ADD_LAYER': 'addLayer',
  'CLIENT_NEXT_ITEM': 'next',
  'CLIENT_PREV_ITEM': 'prev',
  'CLIENT_LOAD_RUNDOWN': 'loadRundown'
};

/**
 * Execute a unified command
 * @param {string} command - Command name (from COMMANDS)
 * @param {object} params - Command parameters
 * @param {object} context - Execution context { appContext, casparCG, state }
 * @returns {Promise<object>} - Result { success, result?, error? }
 */
export async function executeCommand(command, params = {}, context = {}) {
  const { appContext, casparCG } = context;

  // Handle legacy command types (for backward compatibility)
  const normalizedCommand = LEGACY_COMMAND_MAP[command] || command;

  const cmdDef = COMMANDS[normalizedCommand];
  if (!cmdDef) {
    throw new Error(`Unknown command: ${command}`);
  }

  // Resolve parameter variables if context variables exist
  const resolvedParams = resolveParams(params, context);

  try {
    // Route to appropriate handler based on category
    switch (cmdDef.category) {
      case 'transport':
        return await executeTransportCommand(normalizedCommand, resolvedParams, context);

      case 'client':
        return await executeClientCommand(normalizedCommand, resolvedParams, context);

      case 'caspar':
        if (!casparCG) {
          throw new Error('CasparCG connection required for server commands');
        }
        return await executeCasparCommand(normalizedCommand, resolvedParams, casparCG);

      case 'macro':
        return await executeMacroCommand(normalizedCommand, resolvedParams, context);

      default:
        throw new Error(`Unknown command category: ${cmdDef.category}`);
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute transport commands (play/pause/stop/next/prev)
 */
async function executeTransportCommand(command, params, context) {
  const { appContext } = context;
  if (!appContext) {
    throw new Error('Transport commands require app context');
  }

  const { channel, layer, itemIndex } = params;

  switch (command) {
    case 'play':
      await appContext.playItem(channel, layer, itemIndex);
      return { success: true };

    case 'pause':
      await appContext.pausePlayback(channel, layer);
      return { success: true };

    case 'resume':
      await appContext.resumePlayback(channel, layer);
      return { success: true };

    case 'stop':
      await appContext.stopPlayback(channel, layer);
      return { success: true };

    case 'next':
      await appContext.nextItem(channel, layer);
      return { success: true };

    case 'prev':
      await appContext.prevItem(channel, layer);
      return { success: true };

    default:
      throw new Error(`Unknown transport command: ${command}`);
  }
}

/**
 * Execute client-side commands (toggles, rundowns, channels/layers)
 */
async function executeClientCommand(command, params, context) {
  const { appContext } = context;
  if (!appContext) {
    throw new Error('Client commands require app context');
  }

  const { channel, layer, name, rundownName } = params;

  switch (command) {
    case 'togglePlaylistMode':
      appContext.togglePlaylistMode(channel, layer);
      return { success: true };

    case 'toggleLoopMode':
      appContext.toggleLoopMode(channel, layer);
      return { success: true };

    case 'toggleLoopItem':
      appContext.toggleLoopItem(channel, layer);
      return { success: true };

    case 'loadRundown':
      // Support both 'name' and legacy 'rundownName' parameter
      const loadName = name || rundownName;
      if (!loadName) {
        throw new Error('Load rundown requires name parameter');
      }
      await appContext.loadRundown(loadName);
      return { success: true };

    case 'saveRundown':
      if (!name) {
        throw new Error('Save rundown requires name parameter');
      }
      await appContext.saveRundown(name);
      return { success: true };

    case 'clearAll':
      appContext.clearAllChannels();
      return { success: true };

    case 'addChannel':
      appContext.addChannel();
      return { success: true };

    case 'addLayer':
      appContext.addLayer(channel);
      return { success: true };

    case 'deleteChannel':
      appContext.deleteChannel(channel);
      return { success: true };

    case 'deleteLayer':
      appContext.deleteLayer(channel, layer);
      return { success: true };

    default:
      throw new Error(`Unknown client command: ${command}`);
  }
}

/**
 * Execute CasparCG server commands
 */
async function executeCasparCommand(command, params, casparCG) {
  const { channel, layer, clip, options = {}, template, playOnLoad, data, amcp } = params;

  switch (command) {
    case 'casparPlay':
      return await casparCommands.play(casparCG, channel, layer, clip, options);

    case 'casparLoadBg':
      return await casparCommands.loadBg(casparCG, channel, layer, clip, options);

    case 'casparPause':
      return await casparCommands.pause(casparCG, channel, layer);

    case 'casparResume':
      return await casparCommands.resume(casparCG, channel, layer);

    case 'casparStop':
      return await casparCommands.stop(casparCG, channel, layer);

    case 'casparClear':
      return await casparCommands.clear(casparCG, channel, layer);

    case 'cgAdd':
      return await casparCommands.cgAdd(casparCG, channel, layer, template, playOnLoad ?? true, data || {});

    case 'cgPlay':
      return await casparCommands.cgPlay(casparCG, channel, layer);

    case 'cgStop':
      return await casparCommands.cgStop(casparCG, channel, layer);

    case 'cgUpdate':
      return await casparCommands.cgUpdate(casparCG, channel, layer, data || {});

    case 'custom':
      if (!amcp) {
        throw new Error('Custom command requires amcp parameter');
      }
      return await casparCommands.executeRawCommand(casparCG, amcp);

    default:
      throw new Error(`Unknown CasparCG command: ${command}`);
  }
}

/**
 * Execute macro command
 */
async function executeMacroCommand(command, params, context) {
  const { appContext } = context;
  if (!appContext) {
    throw new Error('Macro execution requires app context');
  }

  const { macroId } = params;
  if (!macroId) {
    throw new Error('Execute macro requires macroId parameter');
  }

  await appContext.executeMacro(macroId);
  return { success: true };
}

/**
 * Resolve variable references in params
 * Variables start with $ and are replaced with context values
 */
function resolveParams(params, context) {
  const resolved = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith('$')) {
      const varName = value.slice(1);
      resolved[key] = context[varName] ?? value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveParams(value, context);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Get list of available commands for API discovery
 */
export function getCommandList() {
  return Object.entries(COMMANDS).map(([name, def]) => ({
    command: name,
    params: def.params,
    description: def.description,
    category: def.category
  }));
}

/**
 * Get commands grouped by category
 */
export function getCommandsByCategory() {
  const grouped = {};

  for (const [name, def] of Object.entries(COMMANDS)) {
    if (!grouped[def.category]) {
      grouped[def.category] = [];
    }
    grouped[def.category].push({
      command: name,
      params: def.params,
      description: def.description
    });
  }

  return grouped;
}

/**
 * Get command types formatted for the macro editor dropdown
 * Returns unified command names with labels and categories
 */
export function getCommandTypesForEditor() {
  const categoryLabels = {
    transport: 'Transport',
    client: 'Client Commands',
    caspar: 'CasparCG Commands',
    macro: 'Macro'
  };

  const commandLabels = {
    // Transport
    play: 'Play',
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    next: 'Next Item',
    prev: 'Previous Item',
    // Client
    togglePlaylistMode: 'Toggle Playlist Mode',
    toggleLoopMode: 'Toggle Loop Mode',
    toggleLoopItem: 'Toggle Loop Item',
    loadRundown: 'Load Rundown',
    saveRundown: 'Save Rundown',
    clearAll: 'Clear All',
    addChannel: 'Add Channel',
    addLayer: 'Add Layer',
    deleteChannel: 'Delete Channel',
    deleteLayer: 'Delete Layer',
    // CasparCG
    casparPlay: 'CasparCG: Play',
    casparStop: 'CasparCG: Stop',
    casparPause: 'CasparCG: Pause',
    casparResume: 'CasparCG: Resume',
    casparClear: 'CasparCG: Clear',
    casparLoadBg: 'CasparCG: Load BG',
    cgAdd: 'CG: Add Template',
    cgPlay: 'CG: Play Template',
    cgStop: 'CG: Stop Template',
    cgUpdate: 'CG: Update Template',
    custom: 'Custom AMCP',
    // Macro
    executeMacro: 'Execute Macro'
  };

  return Object.entries(COMMANDS).map(([name, def]) => ({
    value: name,
    label: commandLabels[name] || name,
    description: def.description,
    category: categoryLabels[def.category] || def.category,
    params: def.params
  }));
}

export default {
  COMMANDS,
  LEGACY_COMMAND_MAP,
  executeCommand,
  getCommandList,
  getCommandsByCategory,
  getCommandTypesForEditor
};

// Macro Executor Service
// Executes macro command sequences

import casparCommands from './casparCommands';

export async function executeMacro(macro, casparCG, context = {}) {
  if (!macro || !macro.commands || macro.commands.length === 0) {
    throw new Error('Invalid macro: no commands');
  }

  if (!casparCG) {
    throw new Error('Not connected to CasparCG');
  }

  const results = [];
  let hasError = false;

  for (const command of macro.commands) {
    if (hasError && !macro.continueOnError) {
      break;
    }

    try {
      const result = await executeCommand(command, casparCG, context);
      results.push({ command, success: true, result });

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

async function executeCommand(command, casparCG, context) {
  const { type, channel, layer, params = {} } = command;

  // Replace context variables in params
  const resolvedParams = resolveParams(params, context);

  switch (type) {
    case 'PLAY':
      return await casparCommands.play(
        casparCG,
        channel,
        layer,
        resolvedParams.clip,
        resolvedParams
      );

    case 'LOADBG':
      return await casparCommands.loadBg(
        casparCG,
        channel,
        layer,
        resolvedParams.clip,
        resolvedParams
      );

    case 'PAUSE':
      return await casparCommands.pause(casparCG, channel, layer);

    case 'RESUME':
      return await casparCommands.resume(casparCG, channel, layer);

    case 'STOP':
      return await casparCommands.stop(casparCG, channel, layer);

    case 'CLEAR':
      return await casparCommands.clear(casparCG, channel, layer);

    case 'CG_ADD':
      return await casparCommands.cgAdd(
        casparCG,
        channel,
        layer,
        resolvedParams.template,
        resolvedParams.playOnLoad ?? true,
        resolvedParams.data || {}
      );

    case 'CG_PLAY':
      return await casparCommands.cgPlay(casparCG, channel, layer);

    case 'CG_STOP':
      return await casparCommands.cgStop(casparCG, channel, layer);

    case 'CG_UPDATE':
      return await casparCommands.cgUpdate(
        casparCG,
        channel,
        layer,
        resolvedParams.data || {}
      );

    case 'CALL':
      return await casparCommands.call(casparCG, channel, layer, resolvedParams);

    case 'CUSTOM':
      // Send raw AMCP command
      if (resolvedParams.amcp) {
        return await casparCG.do(resolvedParams.amcp);
      }
      throw new Error('Custom command requires amcp parameter');

    default:
      throw new Error(`Unknown command type: ${type}`);
  }
}

function resolveParams(params, context) {
  const resolved = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith('$')) {
      // Variable reference
      const varName = value.slice(1);
      resolved[key] = context[varName] ?? value;
    } else if (typeof value === 'object' && value !== null) {
      // Nested object
      resolved[key] = resolveParams(value, context);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  { value: 'PLAY', label: 'Play', description: 'Play media on a layer' },
  { value: 'LOADBG', label: 'Load BG', description: 'Load media in background' },
  { value: 'PAUSE', label: 'Pause', description: 'Pause playback' },
  { value: 'RESUME', label: 'Resume', description: 'Resume playback' },
  { value: 'STOP', label: 'Stop', description: 'Stop playback' },
  { value: 'CLEAR', label: 'Clear', description: 'Clear layer' },
  { value: 'CG_ADD', label: 'CG Add', description: 'Add template to layer' },
  { value: 'CG_PLAY', label: 'CG Play', description: 'Play template' },
  { value: 'CG_STOP', label: 'CG Stop', description: 'Stop template' },
  { value: 'CG_UPDATE', label: 'CG Update', description: 'Update template data' },
  { value: 'CUSTOM', label: 'Custom', description: 'Custom AMCP command' }
];

export default {
  executeMacro,
  createMacroTemplate,
  createCommandTemplate,
  COMMAND_TYPES
};

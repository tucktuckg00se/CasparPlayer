// Macro Executor Service
// Executes macro command sequences using the unified command handler

import { executeCommand as executeUnifiedCommand, LEGACY_COMMAND_MAP } from './commandHandler';
import { offsetToSeconds, createDefaultOffset } from '../utils/timecode';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert legacy delay (ms) to offset object
 */
function legacyDelayToOffset(delayMs, frameRate = 25) {
  if (!delayMs || delayMs <= 0) return createDefaultOffset();
  const totalSeconds = delayMs / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.round((totalSeconds % 1) * frameRate);
  return { hours, minutes, seconds, frames, negative: false };
}

/**
 * Get offset in milliseconds from command (handles legacy delay and new offset format)
 */
function getOffsetMs(command, channelFrameRate = 25) {
  // New offset format
  if (command.offset) {
    return offsetToSeconds(command.offset, channelFrameRate) * 1000;
  }
  // Legacy delay format (already in ms)
  if (command.delay > 0) {
    return command.delay;
  }
  return 0;
}

export async function executeMacro(macro, casparCG, context = {}) {
  if (!macro || !macro.commands || macro.commands.length === 0) {
    throw new Error('Invalid macro: no commands');
  }

  const results = [];
  let hasError = false;
  const channelFrameRate = context.channelFrameRate || 25;

  for (const command of macro.commands) {
    if (hasError && !macro.continueOnError) {
      break;
    }

    try {
      // Build params object from command (use params directly, no top-level channel/layer)
      const params = { ...(command.params || {}) };

      // Execute using unified command handler (handles legacy command type mapping)
      const result = await executeUnifiedCommand(
        command.type,
        params,
        { ...context, casparCG }
      );

      results.push({ command, success: result.success !== false, result });

      // Wait based on offset (supports both legacy delay and new offset format)
      const offsetMs = getOffsetMs(command, channelFrameRate);
      if (offsetMs > 0) {
        await delay(offsetMs);
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

export function createCommandTemplate(type = 'casparPlay') {
  return {
    type,
    params: {
      channel: 1,
      layer: 10
    },
    offset: createDefaultOffset()  // New offset format replaces delay
  };
}

export default {
  executeMacro,
  createMacroTemplate,
  createCommandTemplate
};

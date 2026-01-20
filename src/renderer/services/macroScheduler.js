// Macro Scheduler Service
// Handles scheduling macros with timecode offsets for playlist items

import { offsetToSeconds, isOffsetZero } from '../utils/timecode';

// Track scheduled timers by item ID
const scheduledTimers = new Map();

/**
 * Schedule a macro to execute at a specific offset from a trigger point
 * @param {string} itemId - The playlist item ID (for cancellation)
 * @param {string} position - 'start' or 'end' position
 * @param {Object} macroAttachment - { macroId, offset }
 * @param {Function} executeMacroFn - Function to execute the macro
 * @param {Object} macro - The macro object to execute
 * @param {number} channelFrameRate - Channel frame rate for offset calculation
 * @param {number} triggerTime - When the trigger occurs (ms timestamp or 0 for now)
 * @returns {number|null} Timer ID or null if executed immediately
 */
export function scheduleMacro(
  itemId,
  position,
  macroAttachment,
  executeMacroFn,
  macro,
  channelFrameRate = 25,
  triggerTime = 0
) {
  if (!macroAttachment || !macro) return null;

  const { offset } = macroAttachment;
  const offsetMs = offsetToSeconds(offset, channelFrameRate) * 1000;
  const key = `${itemId}-${position}`;

  // Cancel any existing timer for this item/position
  cancelScheduledMacro(itemId, position);

  // If offset is zero, execute immediately
  if (isOffsetZero(offset)) {
    console.log(`[MacroScheduler] Executing macro immediately for ${position} of item ${itemId}`);
    executeMacroFn(macro);
    return null;
  }

  // For positive offsets, schedule to execute after the offset time
  if (offsetMs > 0) {
    console.log(`[MacroScheduler] Scheduling macro for ${position} of item ${itemId} in ${offsetMs}ms`);
    const timerId = setTimeout(() => {
      console.log(`[MacroScheduler] Executing scheduled macro for ${position} of item ${itemId}`);
      executeMacroFn(macro);
      scheduledTimers.delete(key);
    }, offsetMs);

    scheduledTimers.set(key, { timerId, itemId, position });
    return timerId;
  }

  // For negative offsets (before trigger), this should be handled by the caller
  // by delaying the trigger itself
  console.log(`[MacroScheduler] Negative offset for ${position} of item ${itemId}: ${offsetMs}ms`);
  return null;
}

/**
 * Schedule start macro for a playlist item
 * Handles both positive (after start) and negative (before start) offsets
 * @param {Object} item - Playlist item with startMacro attachment
 * @param {Function} executeMacroFn - Function to execute macro
 * @param {Function} getMacroFn - Function to get macro by ID
 * @param {number} channelFrameRate - Channel frame rate
 * @returns {Object} { shouldDelayPlay: boolean, delayMs: number, timerId: number|null }
 */
export function scheduleStartMacro(item, executeMacroFn, getMacroFn, channelFrameRate = 25) {
  if (!item?.startMacro) {
    return { shouldDelayPlay: false, delayMs: 0, timerId: null };
  }

  const macro = getMacroFn(item.startMacro.macroId);
  if (!macro) {
    console.warn(`[MacroScheduler] Start macro not found: ${item.startMacro.macroId}`);
    return { shouldDelayPlay: false, delayMs: 0, timerId: null };
  }

  const offset = item.startMacro.offset;
  const offsetMs = offsetToSeconds(offset, channelFrameRate) * 1000;

  // Negative offset = execute before play, delay the play
  if (offsetMs < 0) {
    const delayMs = Math.abs(offsetMs);
    console.log(`[MacroScheduler] Negative start offset: executing macro first, delaying play by ${delayMs}ms`);
    executeMacroFn(macro);
    return { shouldDelayPlay: true, delayMs, timerId: null };
  }

  // Positive or zero offset = schedule after play starts
  const timerId = scheduleMacro(
    item.id,
    'start',
    item.startMacro,
    executeMacroFn,
    macro,
    channelFrameRate
  );

  return { shouldDelayPlay: false, delayMs: 0, timerId };
}

/**
 * Schedule end macro for a playlist item
 * @param {Object} item - Playlist item with endMacro attachment
 * @param {number} itemDuration - Item duration in seconds
 * @param {Function} executeMacroFn - Function to execute macro
 * @param {Function} getMacroFn - Function to get macro by ID
 * @param {number} channelFrameRate - Channel frame rate
 * @returns {number|null} Timer ID or null
 */
export function scheduleEndMacro(item, itemDuration, executeMacroFn, getMacroFn, channelFrameRate = 25) {
  if (!item?.endMacro || !itemDuration) {
    return null;
  }

  const macro = getMacroFn(item.endMacro.macroId);
  if (!macro) {
    console.warn(`[MacroScheduler] End macro not found: ${item.endMacro.macroId}`);
    return null;
  }

  const offset = item.endMacro.offset;
  const offsetMs = offsetToSeconds(offset, channelFrameRate) * 1000;
  const itemDurationMs = itemDuration * 1000;
  const key = `${item.id}-end`;

  // Cancel any existing timer
  cancelScheduledMacro(item.id, 'end');

  // Negative offset = execute before item ends
  if (offsetMs < 0) {
    const executeAtMs = itemDurationMs + offsetMs; // e.g., 10000 + (-2000) = 8000ms
    if (executeAtMs > 0) {
      console.log(`[MacroScheduler] Scheduling end macro ${Math.abs(offsetMs)}ms before item ends (at ${executeAtMs}ms)`);
      const timerId = setTimeout(() => {
        console.log(`[MacroScheduler] Executing end macro for item ${item.id}`);
        executeMacroFn(macro);
        scheduledTimers.delete(key);
      }, executeAtMs);

      scheduledTimers.set(key, { timerId, itemId: item.id, position: 'end' });
      return timerId;
    } else {
      // Offset is larger than duration, execute immediately
      console.log(`[MacroScheduler] End macro offset larger than duration, executing immediately`);
      executeMacroFn(macro);
      return null;
    }
  }

  // Zero offset = execute when item ends (at duration)
  if (isOffsetZero(offset)) {
    console.log(`[MacroScheduler] Scheduling end macro at item end (${itemDurationMs}ms)`);
    const timerId = setTimeout(() => {
      console.log(`[MacroScheduler] Executing end macro for item ${item.id}`);
      executeMacroFn(macro);
      scheduledTimers.delete(key);
    }, itemDurationMs);

    scheduledTimers.set(key, { timerId, itemId: item.id, position: 'end' });
    return timerId;
  }

  // Positive offset = execute after item ends
  const executeAtMs = itemDurationMs + offsetMs;
  console.log(`[MacroScheduler] Scheduling end macro ${offsetMs}ms after item ends (at ${executeAtMs}ms)`);
  const timerId = setTimeout(() => {
    console.log(`[MacroScheduler] Executing end macro for item ${item.id}`);
    executeMacroFn(macro);
    scheduledTimers.delete(key);
  }, executeAtMs);

  scheduledTimers.set(key, { timerId, itemId: item.id, position: 'end' });
  return timerId;
}

/**
 * Cancel a scheduled macro
 * @param {string} itemId - The playlist item ID
 * @param {string} position - 'start' or 'end' (optional, cancels both if not specified)
 */
export function cancelScheduledMacro(itemId, position = null) {
  if (position) {
    const key = `${itemId}-${position}`;
    const scheduled = scheduledTimers.get(key);
    if (scheduled) {
      clearTimeout(scheduled.timerId);
      scheduledTimers.delete(key);
      console.log(`[MacroScheduler] Cancelled ${position} macro for item ${itemId}`);
    }
  } else {
    // Cancel both start and end
    cancelScheduledMacro(itemId, 'start');
    cancelScheduledMacro(itemId, 'end');
  }
}

/**
 * Cancel all scheduled macros for all items
 */
export function cancelAllScheduledMacros() {
  for (const [key, scheduled] of scheduledTimers.entries()) {
    clearTimeout(scheduled.timerId);
  }
  scheduledTimers.clear();
  console.log('[MacroScheduler] Cancelled all scheduled macros');
}

/**
 * Get count of currently scheduled macros
 */
export function getScheduledCount() {
  return scheduledTimers.size;
}

export default {
  scheduleMacro,
  scheduleStartMacro,
  scheduleEndMacro,
  cancelScheduledMacro,
  cancelAllScheduledMacros,
  getScheduledCount
};

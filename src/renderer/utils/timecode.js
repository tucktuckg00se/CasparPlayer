// Timecode utilities for CasparCG playback

export function framesToTimecode(frames, frameRate = 25) {
  if (!frames || frames < 0) return '00:00:00:00';

  const totalSeconds = frames / frameRate;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const remainingFrames = Math.floor(frames % frameRate);

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
    remainingFrames.toString().padStart(2, '0')
  ].join(':');
}

export function secondsToTimecode(seconds, showFrames = false, frameRate = 25) {
  if (!seconds || seconds < 0) return showFrames ? '00:00:00:00' : '00:00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (showFrames) {
    const frames = Math.floor((seconds % 1) * frameRate);
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0'),
      frames.toString().padStart(2, '0')
    ].join(':');
  }

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0')
  ].join(':');
}

export function timecodeToSeconds(timecode, frameRate = 25) {
  if (!timecode) return 0;

  const parts = timecode.split(':').map(Number);

  if (parts.length === 4) {
    // HH:MM:SS:FF format
    const [hours, minutes, seconds, frames] = parts;
    return hours * 3600 + minutes * 60 + seconds + frames / frameRate;
  } else if (parts.length === 3) {
    // HH:MM:SS format
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

export function timecodeToFrames(timecode, frameRate = 25) {
  return Math.floor(timecodeToSeconds(timecode, frameRate) * frameRate);
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatRemainingTime(remaining) {
  if (!remaining || remaining <= 0) return '-00:00';
  return '-' + formatDuration(remaining);
}

export function calculateProgress(current, total) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, (current / total) * 100));
}

// ==================== Macro Offset Utilities ====================

/**
 * Create a default offset object
 * @returns {Object} Default offset with all zeros
 */
export function createDefaultOffset() {
  return {
    hours: 0,
    minutes: 0,
    seconds: 0,
    frames: 0,
    negative: false
  };
}

/**
 * Convert offset object to seconds using channel frame rate
 * @param {Object} offset - The offset object { hours, minutes, seconds, frames, negative }
 * @param {number} channelFrameRate - The channel's frame rate (e.g., 25, 30, 50, 60)
 * @returns {number} Total seconds (negative if offset.negative is true)
 */
export function offsetToSeconds(offset, channelFrameRate = 25) {
  if (!offset) return 0;

  const { hours = 0, minutes = 0, seconds = 0, frames = 0, negative = false } = offset;
  const totalSeconds = (hours * 3600) + (minutes * 60) + seconds + (frames / channelFrameRate);

  return negative ? -totalSeconds : totalSeconds;
}

/**
 * Convert seconds to offset object
 * @param {number} totalSeconds - Seconds (can be negative)
 * @param {number} channelFrameRate - The channel's frame rate
 * @returns {Object} Offset object { hours, minutes, seconds, frames, negative }
 */
export function secondsToOffset(totalSeconds, channelFrameRate = 25) {
  const negative = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);

  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const seconds = Math.floor(absSeconds % 60);
  const frames = Math.round((absSeconds % 1) * channelFrameRate);

  return { hours, minutes, seconds, frames, negative };
}

/**
 * Convert offset object to total frames
 * @param {Object} offset - The offset object
 * @param {number} channelFrameRate - The channel's frame rate
 * @returns {number} Total frames (negative if offset.negative is true)
 */
export function offsetToFrames(offset, channelFrameRate = 25) {
  return Math.round(offsetToSeconds(offset, channelFrameRate) * channelFrameRate);
}

/**
 * Format offset object as timecode string
 * @param {Object} offset - The offset object
 * @returns {string} Formatted string like "-00:01:30:15" or "00:00:05:00"
 */
export function formatOffset(offset) {
  if (!offset) return '00:00:00:00';

  const { hours = 0, minutes = 0, seconds = 0, frames = 0, negative = false } = offset;
  const sign = negative ? '-' : '';

  return sign + [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
    frames.toString().padStart(2, '0')
  ].join(':');
}

/**
 * Parse timecode string to offset object
 * @param {string} timecodeString - String like "-00:01:30:15" or "00:00:05:00"
 * @returns {Object} Offset object
 */
export function parseOffsetString(timecodeString) {
  if (!timecodeString) return createDefaultOffset();

  const negative = timecodeString.startsWith('-');
  const cleanString = timecodeString.replace(/^-/, '');
  const parts = cleanString.split(':').map(Number);

  if (parts.length === 4) {
    return {
      hours: parts[0] || 0,
      minutes: parts[1] || 0,
      seconds: parts[2] || 0,
      frames: parts[3] || 0,
      negative
    };
  }

  return createDefaultOffset();
}

/**
 * Check if offset is zero (no delay)
 * @param {Object} offset - The offset object
 * @returns {boolean} True if offset is effectively zero
 */
export function isOffsetZero(offset) {
  if (!offset) return true;
  const { hours = 0, minutes = 0, seconds = 0, frames = 0 } = offset;
  return hours === 0 && minutes === 0 && seconds === 0 && frames === 0;
}

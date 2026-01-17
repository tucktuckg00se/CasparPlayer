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

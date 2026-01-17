// Media type detection utilities for CasparCG supported formats

export const VIDEO_EXTENSIONS = [
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv',
  '.m4v', '.mpeg', '.mpg', '.mxf', '.ts', '.m2ts'
];

export const IMAGE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif',
  '.tga', '.webp', '.psd'
];

export const AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.aac', '.flac', '.ogg', '.wma', '.m4a'
];

export const TEMPLATE_EXTENSIONS = [
  '.html', '.htm', '.ft'
];

export function getFileType(filename) {
  if (!filename) return 'unknown';

  const ext = getExtension(filename);

  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (TEMPLATE_EXTENSIONS.includes(ext)) return 'template';

  return 'unknown';
}

export function getExtension(filename) {
  if (!filename) return '';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

export function isMediaFile(filename) {
  const type = getFileType(filename);
  return type !== 'unknown';
}

export function isCasparCGMedia(filename) {
  const type = getFileType(filename);
  return ['video', 'image', 'audio', 'template'].includes(type);
}

export function getFileIcon(type) {
  switch (type) {
    case 'video':
      return 'film';
    case 'image':
      return 'image';
    case 'audio':
      return 'music';
    case 'template':
      return 'code';
    case 'folder':
      return 'folder';
    default:
      return 'file';
  }
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
  const value = (bytes / Math.pow(1000, exponent)).toFixed(exponent > 0 ? 1 : 0);

  return `${value} ${units[exponent]}`;
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

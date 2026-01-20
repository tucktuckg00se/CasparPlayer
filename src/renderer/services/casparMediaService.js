// CasparCG Media Service - Utilities for converting CasparCG media metadata

// Map CasparCG type to app's internal type
function mapCasparType(casparType) {
  switch (casparType?.toUpperCase()) {
    case 'MOVIE':
      return 'video';
    case 'STILL':
      return 'image';
    case 'AUDIO':
      return 'audio';
    default:
      return 'media';
  }
}

// Validate and normalize framerate value
function normalizeFrameRate(rawFrameRate) {
  if (rawFrameRate === null || rawFrameRate === undefined) return null;

  const fps = parseFloat(rawFrameRate);

  // Validate it's a reasonable framerate (between 1 and 120)
  if (isNaN(fps) || fps <= 0 || fps > 120) return null;

  // Round to 2 decimal places for cleaner display
  return Math.round(fps * 100) / 100;
}

// Convert CasparCG ClipInfo to app's metadata format
export function convertClipInfoToMetadata(clipInfo) {
  if (!clipInfo) return null;

  const frameRate = normalizeFrameRate(clipInfo.framerate);

  const duration = frameRate && clipInfo.frames > 0
    ? clipInfo.frames / frameRate
    : 0;

  // Parse datetime - could be YYYYMMDDHHMMSS format or Unix timestamp
  let lastModified = null;
  if (clipInfo.datetime) {
    const dt = String(clipInfo.datetime);
    if (dt.length === 14) {
      // Format: YYYYMMDDHHMMSS (e.g., 20200502192622)
      const year = dt.substring(0, 4);
      const month = dt.substring(4, 6);
      const day = dt.substring(6, 8);
      const hour = dt.substring(8, 10);
      const min = dt.substring(10, 12);
      const sec = dt.substring(12, 14);
      const date = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`);
      if (!isNaN(date.getTime())) {
        lastModified = date.toISOString();
      }
    } else if (clipInfo.datetime > 0) {
      // Assume Unix timestamp
      const date = new Date(clipInfo.datetime * 1000);
      if (!isNaN(date.getTime())) {
        lastModified = date.toISOString();
      }
    }
  }

  return {
    duration,
    frameRate, // Will be null if invalid, allowing fallback logic to work properly
    frameCount: clipInfo.frames,
    size: clipInfo.size,
    type: mapCasparType(clipInfo.type),
    lastModified,
    source: 'casparcg'
  };
}

// Match local path to CasparCG clip name
// CasparCG uses forward slashes and no extension
export function localPathToCasparClip(localPath, mediaRoot) {
  if (!localPath || !mediaRoot) return null;

  // Normalize path separators to forward slashes
  const normalizedPath = localPath.replace(/\\/g, '/');
  const normalizedRoot = mediaRoot.replace(/\\/g, '/').replace(/\/$/, '');

  // Check if path starts with media root
  if (!normalizedPath.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
    return null;
  }

  // Get relative path (remove media root prefix)
  let relativePath = normalizedPath.substring(normalizedRoot.length);

  // Remove leading slash
  if (relativePath.startsWith('/')) {
    relativePath = relativePath.substring(1);
  }

  // Remove file extension
  const lastDot = relativePath.lastIndexOf('.');
  if (lastDot > 0) {
    relativePath = relativePath.substring(0, lastDot);
  }

  return relativePath;
}

// Find CasparCG metadata for a local file path
// Uses the cached CLS list - no additional server calls needed
export function findCasparMetadata(localPath, mediaRoot, casparMediaList) {
  if (!casparMediaList || casparMediaList.length === 0) return null;

  const clipName = localPathToCasparClip(localPath, mediaRoot);
  if (!clipName) return null;

  // CasparCG clip names are case-insensitive
  // Normalize path separators since CasparCG may use backslashes or forward slashes
  const normalizedClipName = clipName.toLowerCase().replace(/\\/g, '/');

  return casparMediaList.find(c => {
    const casparClipName = (c.clip || '').toLowerCase().replace(/\\/g, '/');
    return casparClipName === normalizedClipName;
  });
}

// Check if a file exists in CasparCG's media list
export function isFileInCasparMedia(localPath, mediaRoot, casparMediaList) {
  return findCasparMetadata(localPath, mediaRoot, casparMediaList) !== null;
}

export default {
  convertClipInfoToMetadata,
  localPathToCasparClip,
  findCasparMetadata,
  isFileInCasparMedia,
  mapCasparType
};

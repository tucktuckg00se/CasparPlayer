const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Supported media extensions
const VIDEO_EXTENSIONS = [
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv',
  '.m4v', '.mpeg', '.mpg', '.mxf', '.ts', '.m2ts'
];

const IMAGE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.tif',
  '.tga', '.webp', '.psd'
];

const AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.aac', '.flac', '.ogg', '.wma', '.m4a'
];

const TEMPLATE_EXTENSIONS = [
  '.html', '.htm', '.ft'
];

const ALL_MEDIA_EXTENSIONS = [
  ...VIDEO_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...TEMPLATE_EXTENSIONS
];

function getFileType(filename) {
  if (!filename) return 'unknown';
  const ext = path.extname(filename).toLowerCase();

  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (TEMPLATE_EXTENSIONS.includes(ext)) return 'template';

  return 'unknown';
}

function isMediaFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ALL_MEDIA_EXTENSIONS.includes(ext);
}

async function getFileStats(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString()
    };
  } catch (error) {
    return { size: 0, created: null, modified: null };
  }
}

async function scanDirectory(dirPath, rootPath = null) {
  if (!rootPath) rootPath = dirPath;

  const result = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files and directories
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        const children = await scanDirectory(fullPath, rootPath);
        // Only include folders that have media files (directly or in subfolders)
        if (children.length > 0 || hasMediaInFolder(fullPath)) {
          result.push({
            id: relativePath.replace(/\\/g, '/'),
            name: entry.name,
            path: fullPath,
            relativePath: relativePath.replace(/\\/g, '/'),
            type: 'folder',
            children: children,
            expanded: false
          });
        }
      } else if (isMediaFile(entry.name)) {
        const stats = await getFileStats(fullPath);
        const fileType = getFileType(entry.name);

        result.push({
          id: relativePath.replace(/\\/g, '/'),
          name: entry.name,
          path: fullPath,
          relativePath: relativePath.replace(/\\/g, '/'),
          type: fileType,
          extension: path.extname(entry.name).toLowerCase(),
          size: stats.size,
          created: stats.created,
          modified: stats.modified,
          metadata: null // Will be populated by thumbnailGenerator
        });
      }
    }

    // Sort: folders first, then files alphabetically
    result.sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error.message);
  }

  return result;
}

function hasMediaInFolder(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.some(entry => {
      if (entry.name.startsWith('.')) return false;
      if (entry.isFile() && isMediaFile(entry.name)) return true;
      return false;
    });
  } catch {
    return false;
  }
}

function createWatcher(rootPath, onChange) {
  const watcher = chokidar.watch(rootPath, {
    ignored: /(^|[\/\\])\../, // Ignore hidden files
    persistent: true,
    ignoreInitial: true,
    depth: 10,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  const handleChange = async (eventType, filePath) => {
    if (isMediaFile(filePath) || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      onChange(eventType, filePath);
    }
  };

  watcher
    .on('add', (filePath) => handleChange('add', filePath))
    .on('unlink', (filePath) => handleChange('remove', filePath))
    .on('addDir', (filePath) => handleChange('addDir', filePath))
    .on('unlinkDir', (filePath) => handleChange('removeDir', filePath))
    .on('error', (error) => console.error('Watcher error:', error));

  return watcher;
}

module.exports = {
  scanDirectory,
  createWatcher,
  isMediaFile,
  getFileType,
  getFileStats,
  VIDEO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  AUDIO_EXTENSIONS,
  TEMPLATE_EXTENSIONS,
  ALL_MEDIA_EXTENSIONS
};

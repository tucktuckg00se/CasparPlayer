const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const mediaScanner = require('./mediaScanner');
const thumbnailGenerator = require('./thumbnailGenerator');
const oscService = require('./oscService');

let mainWindow;
let mediaWatcher = null;

// Configuration paths
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');
const workspacesPath = path.join(userDataPath, 'workspaces');
const macrosPath = path.join(userDataPath, 'macros');
const rundownsPath = path.join(userDataPath, 'rundowns');
const cachePath = path.join(userDataPath, 'cache', 'thumbnails');

// Ensure directories exist
[workspacesPath, macrosPath, rundownsPath, cachePath].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize thumbnail generator with cache directory
thumbnailGenerator.setCacheDirectory(cachePath);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false,
    frame: true,
    titleBarStyle: 'default'
  });

  // Load the app
  mainWindow.loadFile('public/index.html');

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers for config management
ipcMain.handle('config:load', async () => {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Error loading config:', error);
    return null;
  }
});

ipcMain.handle('config:save', async (event, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
});

// Workspace management
ipcMain.handle('workspace:save', async (event, name, data) => {
  try {
    const filePath = path.join(workspacesPath, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving workspace:', error);
    return false;
  }
});

ipcMain.handle('workspace:load', async (event, name) => {
  try {
    const filePath = path.join(workspacesPath, `${name}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Error loading workspace:', error);
    return null;
  }
});

ipcMain.handle('workspace:list', async () => {
  try {
    const files = fs.readdirSync(workspacesPath);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch (error) {
    console.error('Error listing workspaces:', error);
    return [];
  }
});

// Macro management
ipcMain.handle('macro:save', async (event, id, data) => {
  try {
    const filePath = path.join(macrosPath, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving macro:', error);
    return false;
  }
});

ipcMain.handle('macro:load', async (event, id) => {
  try {
    const filePath = path.join(macrosPath, `${id}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Error loading macro:', error);
    return null;
  }
});

ipcMain.handle('macro:list', async () => {
  try {
    const files = fs.readdirSync(macrosPath);
    const macros = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = fs.readFileSync(path.join(macrosPath, file), 'utf8');
        macros.push(JSON.parse(data));
      }
    }
    return macros;
  } catch (error) {
    console.error('Error listing macros:', error);
    return [];
  }
});

ipcMain.handle('macro:delete', async (event, id) => {
  try {
    const filePath = path.join(macrosPath, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting macro:', error);
    return false;
  }
});

// Provide paths to renderer
ipcMain.handle('app:getPaths', async () => {
  return {
    userData: userDataPath,
    workspaces: workspacesPath,
    macros: macrosPath,
    cache: cachePath
  };
});

// Media folder selection
ipcMain.handle('media:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Media Folder'
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  return result.filePaths[0];
});

// Scan media folder
ipcMain.handle('media:scanFolder', async (event, folderPath) => {
  try {
    const tree = await mediaScanner.scanDirectory(folderPath);
    return { success: true, tree };
  } catch (error) {
    console.error('Error scanning folder:', error);
    return { success: false, error: error.message };
  }
});

// Start watching media folder
ipcMain.handle('media:watchFolder', async (event, folderPath) => {
  // Stop existing watcher if any
  if (mediaWatcher) {
    mediaWatcher.close();
    mediaWatcher = null;
  }

  mediaWatcher = mediaScanner.createWatcher(folderPath, (eventType, filePath) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('media:changed', { eventType, filePath });
    }
  });

  return true;
});

// Stop watching media folder
ipcMain.handle('media:stopWatching', async () => {
  if (mediaWatcher) {
    mediaWatcher.close();
    mediaWatcher = null;
  }
  return true;
});

// Generate thumbnail
ipcMain.handle('media:generateThumbnail', async (event, filePath, fileType) => {
  try {
    const result = await thumbnailGenerator.generateThumbnail(filePath, fileType);
    return result;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return { thumbnail: null, metadata: null };
  }
});

// Get file metadata
ipcMain.handle('media:getMetadata', async (event, filePath, fileType) => {
  try {
    if (fileType === 'video') {
      return await thumbnailGenerator.getVideoMetadata(filePath);
    } else if (fileType === 'image') {
      return await thumbnailGenerator.getImageMetadata(filePath);
    }
    return null;
  } catch (error) {
    console.error('Error getting metadata:', error);
    return null;
  }
});

// Clear thumbnail cache
ipcMain.handle('media:clearCache', async () => {
  try {
    await thumbnailGenerator.clearThumbnailCache();
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
});

// OSC Server management
ipcMain.handle('osc:start', async (event, port) => {
  try {
    await oscService.start(port, (message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('osc:message', message);
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Error starting OSC server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('osc:stop', async () => {
  try {
    oscService.stop();
    return { success: true };
  } catch (error) {
    console.error('Error stopping OSC server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('osc:status', async () => {
  return { running: oscService.isRunning() };
});

// Rundown management
ipcMain.handle('rundown:save', async (event, name, data) => {
  try {
    const safeName = name.replace(/[^a-z0-9_-]/gi, '_');
    const filePath = path.join(rundownsPath, `${safeName}.json`);
    const rundownData = {
      ...data,
      name,
      savedAt: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(rundownData, null, 2));
    return { success: true, name: safeName };
  } catch (error) {
    console.error('Error saving rundown:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rundown:load', async (event, name) => {
  try {
    const safeName = name.replace(/[^a-z0-9_-]/gi, '_');
    const filePath = path.join(rundownsPath, `${safeName}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return { success: true, data: JSON.parse(data) };
    }
    return { success: false, error: 'Rundown not found' };
  } catch (error) {
    console.error('Error loading rundown:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rundown:list', async () => {
  try {
    const files = fs.readdirSync(rundownsPath);
    const rundowns = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const data = fs.readFileSync(path.join(rundownsPath, file), 'utf8');
          const rundown = JSON.parse(data);
          rundowns.push({
            id: file.replace('.json', ''),
            name: rundown.name || file.replace('.json', ''),
            savedAt: rundown.savedAt || null,
            channelCount: rundown.channels?.length || 0
          });
        } catch (e) {
          // Skip invalid files
        }
      }
    }
    return rundowns.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
  } catch (error) {
    console.error('Error listing rundowns:', error);
    return [];
  }
});

ipcMain.handle('rundown:delete', async (event, name) => {
  try {
    const safeName = name.replace(/[^a-z0-9_-]/gi, '_');
    const filePath = path.join(rundownsPath, `${safeName}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'Rundown not found' };
  } catch (error) {
    console.error('Error deleting rundown:', error);
    return { success: false, error: error.message };
  }
});
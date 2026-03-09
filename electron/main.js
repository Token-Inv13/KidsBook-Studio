const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const keytar = require('keytar');
const { startOpenAIService, stopOpenAIService } = require('./openai-service');

// Set user data path to Documents/KidsBookStudio
const userDataPath = path.join(app.getPath('documents'), 'KidsBookStudio');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
app.setPath('userData', userDataPath);

// Create Projects directory
const projectsPath = path.join(userDataPath, 'Projects');
if (!fs.existsSync(projectsPath)) {
  fs.mkdirSync(projectsPath, { recursive: true });
}

const store = new Store();
let mainWindow;
let openaiServicePort;

const SERVICE_NAME = 'KidsBookStudio';
const ACCOUNT_NAME = 'OpenAI_API_Key';

function normalizeAbsolutePath(targetPath) {
  if (typeof targetPath !== 'string' || !targetPath.trim()) {
    throw new Error('Invalid path');
  }

  if (targetPath.includes('\0')) {
    throw new Error('Invalid path');
  }

  const normalized = path.normalize(path.resolve(targetPath));
  if (!path.isAbsolute(normalized)) {
    throw new Error('Path must be absolute');
  }

  return normalized;
}

function validateDownloadUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('Invalid URL');
  }

  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Unsupported URL protocol');
  }
}

function createWindow() {
  const isDev = !app.isPackaged;
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  // Load the app
  const startURL = isDev
    ? (process.env.ELECTRON_START_URL || 'http://localhost:3000')
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startURL);
  
  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    openaiServicePort = await startOpenAIService();
    console.log(`OpenAI service started on port ${openaiServicePort}`);
  } catch (error) {
    console.error('Failed to start OpenAI service:', error);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await stopOpenAIService();
});

ipcMain.handle('store:get', (event, key) => {
  const value = store.get(key);
  console.log(`[IPC] store:get('${key}')`);
  return value;
});

ipcMain.handle('store:set', (event, key, value) => {
  console.log(`[IPC] store:set('${key}')`);
  store.set(key, value);
  return true;
});

ipcMain.handle('store:delete', (event, key) => {
  store.delete(key);
  return true;
});

ipcMain.handle('apikey:set', async (event, apiKey) => {
  try {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey);
    return { success: true };
  } catch (error) {
    console.error('Failed to store API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('apikey:get', async () => {
  try {
    const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    return { success: true, apiKey };
  } catch (error) {
    console.error('Failed to retrieve API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('apikey:delete', async () => {
  try {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('openai:port', () => {
  return openaiServicePort;
});

ipcMain.handle('app:getProjectsPath', () => {
  return projectsPath;
});

ipcMain.handle('app:getUserDataPath', () => {
  return userDataPath;
});

ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('file:save', async (event, options = {}) => {
  try {
    const { filename = 'export.pdf', data, filters = [{ name: 'Files', extensions: ['*'] }] } = options;

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: filename,
      filters
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    let fileBuffer;
    if (Buffer.isBuffer(data)) {
      fileBuffer = data;
    } else if (data instanceof ArrayBuffer) {
      fileBuffer = Buffer.from(data);
    } else if (ArrayBuffer.isView(data)) {
      fileBuffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    } else if (typeof data === 'string') {
      fileBuffer = Buffer.from(data, 'utf-8');
    } else {
      throw new Error('Unsupported file data type');
    }

    const savePath = normalizeAbsolutePath(result.filePath);
    await fs.promises.mkdir(path.dirname(savePath), { recursive: true });
    await fs.promises.writeFile(savePath, fileBuffer);

    return { success: true, canceled: false, path: savePath };
  } catch (error) {
    return { success: false, canceled: false, error: error.message };
  }
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    const safePath = normalizeAbsolutePath(filePath);
    const data = await fs.readFile(safePath, 'utf-8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  const fs = require('fs').promises;
  try {
    const safePath = normalizeAbsolutePath(filePath);
    if (typeof data !== 'string') {
      throw new Error('Only UTF-8 string payloads are supported');
    }
    await fs.writeFile(safePath, data, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:mkdir', async (event, dirPath) => {
  const fs = require('fs').promises;
  try {
    const safePath = normalizeAbsolutePath(dirPath);
    await fs.mkdir(safePath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:exists', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    const safePath = normalizeAbsolutePath(filePath);
    await fs.access(safePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:stat', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    const safePath = normalizeAbsolutePath(filePath);
    const stat = await fs.stat(safePath);
    return {
      success: true,
      size: stat.size,
      isFile: stat.isFile(),
      mtimeMs: stat.mtimeMs
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:downloadImage', async (event, url, savePath) => {
  const https = require('https');
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
  
  try {
    validateDownloadUrl(url);
    const safeSavePath = normalizeAbsolutePath(savePath);

    // Ensure directory exists
    const dir = path.dirname(safeSavePath);
    await fs.promises.mkdir(dir, { recursive: true });
    
    return await new Promise((resolve) => {
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          console.error('[Main] Download failed with status:', response.statusCode);
          resolve({ success: false, error: `HTTP ${response.statusCode}` });
          return;
        }
        
        const fileStream = fs.createWriteStream(safeSavePath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve({ success: true, path: safeSavePath });
        });
        
        fileStream.on('error', (err) => {
          fs.unlink(safeSavePath, () => {});
          resolve({ success: false, error: err.message });
        });
      }).on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readdir', async (event, dirPath) => {
  const fs = require('fs').promises;
  try {
    const safePath = normalizeAbsolutePath(dirPath);
    const files = await fs.readdir(safePath);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

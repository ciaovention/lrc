const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'LRC Editor',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../build/icon.png')
  });

  // Load the app
  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, '../dist/index.html'),
    protocol: 'file:',
    slashes: true
  });
  
  mainWindow.loadURL(startUrl);

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Create application menu
  createAppMenu();

  // Handle window being closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create the Application Menu
function createAppMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open LRC File',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-lrc');
          }
        },
        {
          label: 'Open Audio File',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            mainWindow.webContents.send('menu-open-audio');
          }
        },
        { type: 'separator' },
        {
          label: 'Save LRC File',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save-lrc');
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    
    // Player menu
    {
      label: 'Player',
      submenu: [
        {
          label: 'Play/Pause',
          accelerator: 'Space',
          click: () => {
            mainWindow.webContents.send('menu-play-pause');
          }
        },
        { type: 'separator' },
        {
          label: 'Add Lyric',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            mainWindow.webContents.send('menu-add-lyric');
          }
        }
      ]
    },
    
    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'About LRC Editor',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: 'About LRC Editor',
              message: 'LRC Editor',
              detail: 'A Vue.js based application for editing LRC files with timeline capabilities.\n\nVersion 1.0.0'
            });
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Set up IPC handlers for file operations
function setupIpcHandlers() {
  // Open file dialog for LRC files
  ipcMain.handle('open-lrc-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'LRC Files', extensions: ['lrc'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      return { filePath, content };
    }
    
    return null;
  });
  
  // Open file dialog for audio files
  ipcMain.handle('open-audio-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      return { filePath };
    }
    
    return null;
  });
  
  // Save LRC file dialog
  ipcMain.handle('save-lrc-file', async (event, content) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: 'LRC Files', extensions: ['lrc'] },
        { name: 'Text Files', extensions: ['txt'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, filePath: result.filePath };
    }
    
    return { success: false };
  });
}

// Initialize the app
app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();
  
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
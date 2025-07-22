const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // File operations
    openLrcFile: () => ipcRenderer.invoke('open-lrc-file'),
    openAudioFile: () => ipcRenderer.invoke('open-audio-file'),
    saveLrcFile: (content) => ipcRenderer.invoke('save-lrc-file', content),
    
    // Menu event listeners
    onMenuOpenLrc: (callback) => ipcRenderer.on('menu-open-lrc', callback),
    onMenuOpenAudio: (callback) => ipcRenderer.on('menu-open-audio', callback),
    onMenuSaveLrc: (callback) => ipcRenderer.on('menu-save-lrc', callback),
    onMenuPlayPause: (callback) => ipcRenderer.on('menu-play-pause', callback),
    onMenuAddLyric: (callback) => ipcRenderer.on('menu-add-lyric', callback),
    
    // Remove event listeners
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
);
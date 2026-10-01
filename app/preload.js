const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ch3', {
  listThemes: () => ipcRenderer.invoke('themes:list'),
  importLegacy: () => ipcRenderer.invoke('themes:importLegacy'),
  openThemesFolder: () => ipcRenderer.invoke('themes:openFolder'),
  exportText: (content, defaultName) => ipcRenderer.invoke('export:text', content, defaultName),
  speak: (text, lang) => ipcRenderer.invoke('speech:synthesize', text, true, lang),
  speakLine: (text, lang) => ipcRenderer.invoke('speech:synthesize', text, false, lang),
  speechWarmUp: (lang) => ipcRenderer.send('speech:warmUp', lang),
  setLang: (lang) => ipcRenderer.send('app:lang', lang),
  copy: (content) => ipcRenderer.invoke('clipboard:write', content),
  timerProgress: (value, mode) => ipcRenderer.send('timer:progress', value, mode),
  timerDone: (body) => ipcRenderer.send('timer:done', body),
  setMini: (on) => ipcRenderer.invoke('window:mini', on),
});

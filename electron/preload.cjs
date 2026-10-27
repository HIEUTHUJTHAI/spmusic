const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spmusicDesktop', {
  isDesktop: true,
  version: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdate: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('updates:event', handler);
    return () => ipcRenderer.removeListener('updates:event', handler);
  },
});

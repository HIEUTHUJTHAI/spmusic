const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spmusicDesktop', {
  isDesktop: true,
  version: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  listOlderVersions: () => ipcRenderer.invoke('rollback:versions'),
  downloadOlderVersion: (version) => ipcRenderer.invoke('rollback:download', version),
  installOlderVersion: (version) => ipcRenderer.invoke('rollback:install', version),
  onRollback: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('rollback:event', handler);
    return () => ipcRenderer.removeListener('rollback:event', handler);
  },
  onUpdate: (listener) => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('updates:event', handler);
    return () => ipcRenderer.removeListener('updates:event', handler);
  },
});

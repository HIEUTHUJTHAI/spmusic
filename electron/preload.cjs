const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spmusicDesktop', {
  isDesktop: true,
  getGlassOpacity: () => ipcRenderer.invoke('glass:get'),
  setGlassOpacity: (value) => ipcRenderer.invoke('glass:set', value),
  getYoutubeKeyConfigured: () => ipcRenderer.invoke('youtube-key:get'),
  setYoutubeKey: (value) => ipcRenderer.invoke('youtube-key:set', value),
  inboxPath: () => ipcRenderer.invoke('inbox:path'),
  openInbox: () => ipcRenderer.invoke('inbox:open'),
  readInboxChunk: (name, offset) => ipcRenderer.invoke('inbox:read', name, offset),
  onInboxFile: (listener) => {
    const handler = (_event, entry) => listener(entry);
    ipcRenderer.on('inbox:new', handler);
    return () => ipcRenderer.removeListener('inbox:new', handler);
  },
  setPlayerFullscreen: (enabled) => ipcRenderer.invoke('player:fullscreen', enabled),
  onPlayerFullscreen: (listener) => {
    const handler = (_event, enabled) => listener(enabled);
    ipcRenderer.on('player:fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('player:fullscreen-changed', handler);
  },
  version: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  getUpdateState: () => ipcRenderer.invoke('updates:state'),
  dismissUpdateNotice: (version, mode) => ipcRenderer.invoke('updates:dismiss', version, mode),
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

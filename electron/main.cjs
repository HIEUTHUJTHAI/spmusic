const { app, BrowserWindow, dialog, shell, ipcMain, net } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { listOlderVersions, prepareOlderVersion } = require('./rollback.cjs');

let backend;
let mainWindow;
let stopping = false;
let updateState = { status: 'idle', version: null, progress: 0, message: '' };
let rollbackBusy = false;
let rollbackReady = null;

app.setName('SPMusic');
const gotLock = app.requestSingleInstanceLock();
console.log('[SPMusic] Single-instance lock:', gotLock);
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(start).catch(async (error) => {
  console.error('[SPMusic] Startup failed:', error);
    await dialog.showMessageBox({
      type: 'error',
      title: 'Không mở được SPMusic',
      message: 'SPMusic chưa thể khởi động.',
      detail: error.message,
    });
    app.quit();
  });
}

async function start() {
  const dataDir = path.join(app.getPath('userData'), 'data');
  const serverModule = pathToFileURL(path.join(__dirname, '../server/src/desktop-server.js')).href;
  backend = await import(serverModule).then(({ startDesktopServer }) =>
    startDesktopServer({ dataDir }),
  );

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 760,
    minHeight: 600,
    title: 'SPMusic',
    backgroundColor: '#fff8fc',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  await mainWindow.loadURL(backend.url);
  configureUpdates();
  setTimeout(() => checkForUpdates(false), 2500);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function publishUpdate(payload) {
  updateState = { ...updateState, ...payload };
  mainWindow?.webContents.send('updates:event', updateState);
}

function publishRollback(payload) {
  mainWindow?.webContents.send('rollback:event', payload);
}

function configureUpdates() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () =>
    publishUpdate({ status: 'checking', message: 'Đang kiểm tra bản cập nhật…' }),
  );
  autoUpdater.on('update-available', (info) =>
    publishUpdate({
      status: 'available',
      version: info.version,
      message: `Có phiên bản SPMusic ${info.version} mới.`,
    }),
  );
  autoUpdater.on('update-not-available', () =>
    publishUpdate({ status: 'latest', message: 'Bạn đang dùng phiên bản mới nhất.' }),
  );
  autoUpdater.on('download-progress', (progress) =>
    publishUpdate({ status: 'downloading', progress: Math.round(progress.percent), message: 'Đang tải bản cập nhật…' }),
  );
  autoUpdater.on('update-downloaded', (info) =>
    publishUpdate({ status: 'downloaded', version: info.version, progress: 100, message: 'Bản cập nhật đã sẵn sàng.' }),
  );
  autoUpdater.on('error', (error) =>
    publishUpdate({ status: 'error', message: 'Chưa thể kiểm tra cập nhật lúc này.' }),
  );
}

async function checkForUpdates(interactive = true) {
  if (!app.isPackaged) {
    const result = { status: 'dev', message: 'Cập nhật chỉ hoạt động trong bản app đã đóng gói.' };
    if (interactive) publishUpdate(result);
    return result;
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const next = result?.updateInfo?.version
      ? { status: 'available', version: result.updateInfo.version, message: `Có phiên bản SPMusic ${result.updateInfo.version} mới.` }
      : updateState;
    if (interactive) publishUpdate(next);
    return next;
  } catch {
    const result = { status: 'error', message: 'Chưa thể kiểm tra cập nhật lúc này.' };
    if (interactive) publishUpdate(result);
    return result;
  }
}

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('updates:check', () => checkForUpdates(true));
ipcMain.handle('updates:download', async () => {
  try {
    publishUpdate({ status: 'downloading', progress: 0, message: 'Đang tải bản cập nhật…' });
    await autoUpdater.downloadUpdate();
    return updateState;
  } catch {
    publishUpdate({ status: 'error', message: 'Không tải được bản cập nhật.' });
    return updateState;
  }
});
ipcMain.handle('updates:install', () => {
  autoUpdater.quitAndInstall(false, true);
  return { status: 'installing' };
});
ipcMain.handle('rollback:versions', async () => {
  try {
    return { versions: await listOlderVersions(app.getVersion(), net.fetch) };
  } catch (error) {
    return { error: error.message };
  }
});
ipcMain.handle('rollback:download', async (_event, version) => {
  if (!app.isPackaged) return { error: 'Hãy mở bản SPMusic đã cài để dùng tính năng này.' };
  if (rollbackBusy) return { error: 'Đang tải một phiên bản khác.' };
  rollbackBusy = true;
  rollbackReady = null;
  publishRollback({ status: 'downloading', version, progress: 0 });
  try {
    const file = await prepareOlderVersion(version, app.getVersion(),
      path.join(app.getPath('userData'), 'rollback'), net.fetch,
      (progress) => publishRollback({ status: 'downloading', version, progress }));
    rollbackReady = { version, file };
    publishRollback({ status: 'ready', version, progress: 100 });
    return { status: 'ready', version };
  } catch (error) {
    publishRollback({ status: 'error', version, message: error.message });
    return { error: error.message };
  } finally {
    rollbackBusy = false;
  }
});
ipcMain.handle('rollback:install', async (_event, version) => {
  if (!rollbackReady || version !== rollbackReady.version || rollbackBusy)
    return { error: 'Hãy tải và kiểm tra phiên bản này trước.' };
  const error = await shell.openPath(rollbackReady.file);
  if (error) return { error: 'Không mở được bộ cài: ' + error };
  autoUpdater.autoInstallOnAppQuit = false;
  app.quit();
  return { status: 'installing' };
});

async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    await backend?.close();
  } finally {
    backend = null;
  }
}

app.on('before-quit', (event) => {
  if (!backend || stopping) return;
  event.preventDefault();
  stop().finally(() => app.quit());
});
app.on('window-all-closed', () => app.quit());

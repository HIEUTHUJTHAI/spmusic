import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const nodeDir = path.dirname(process.execPath);
const runtimeDir = path.join(root, '.runtime');
const environment = {
  ...process.env,
  PATH: nodeDir + path.delimiter + (process.env.PATH || ''),
  COREPACK_HOME: path.join(runtimeDir, 'corepack'),
  COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
  npm_config_cache: path.join(runtimeDir, 'npm-cache'),
};

async function exists(file) {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

function runNode(script, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env: environment,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Bước chuẩn bị dừng (${signal || code}). Xem thông báo phía trên.`));
    });
  });
}

function dependenciesReady() {
  try {
    for (const name of [
      'vite/package.json',
      'express',
      'dotenv',
      '@electric-sql/pglite',
      'react',
      'ffmpeg-static',
      'ffprobe-static',
      '@huggingface/transformers',
    ]) {
      require.resolve(name);
    }
    return existsSync(require('ffmpeg-static')) && existsSync(require('ffprobe-static').path);
  } catch {
    return false;
  }
}

async function installDependencies() {
  const npm = path.join(nodeDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const corepack = path.join(nodeDir, 'node_modules', 'corepack', 'dist', 'npm.js');
  const installer = (await exists(npm)) ? npm : (await exists(corepack)) ? corepack : null;
  if (!installer) {
    throw new Error(
      'Thiếu thư viện và bộ cài npm. Hãy cài Node.js kèm npm từ nodejs.org rồi mở lại file này.',
    );
  }
  console.log('Lần chạy đầu: đang cài thư viện từ npm. Cần có kết nối Internet.');
  const args = [(await exists(path.join(root, 'package-lock.json'))) ? 'ci' : 'install'];
  await runNode(installer, args);
}

async function alreadyRunning(url) {
  try {
    const response = await fetch(url + '/api/tracks', { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return false;
    const data = await response.json();
    return Array.isArray(data.tracks) && data.tracks.some((t) => t.id === 'demo-midnight');
  } catch {
    return false;
  }
}

function checkPort(port, host) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => {
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? `Cổng ${port} đang được ứng dụng khác sử dụng. Dừng ứng dụng đó hoặc đổi PORT trong server/.env.`
            : `Chưa thể mở cổng ${port}: ${error.message}`,
        ),
      );
    });
    probe.listen(port, host, () => probe.close(resolve));
  });
}

function openBrowser(url) {
  if (process.env.AURALIS_NO_BROWSER === '1') return;
  if (process.platform === 'win32') {
    // URL is constructed below from a fixed loopback address and validated numeric port.
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], {
      windowsHide: true,
      stdio: 'ignore',
    });
    child.once('error', () => console.log(`Mở trình duyệt và truy cập ${url}`));
    child.unref();
  }
}

async function main() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error(
      `Node.js hiện tại là ${process.versions.node}. SPMusic cần Node.js 22.12 trở lên.`,
    );
  }
  process.chdir(root);
  if (!dependenciesReady()) await installDependencies();
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: path.join(root, 'server', '.env') });
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT trong server/.env không hợp lệ.');
  const url = `http://${host === '::1' ? '[::1]' : '127.0.0.1'}:${port}`;
  if (await alreadyRunning(url)) {
    console.log(`SPMusic đã chạy tại ${url}`);
    openBrowser(url);
    return;
  }
  await checkPort(port, host);
  console.log('SPMusic — đang chuẩn bị giao diện...');
  const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
  await runNode(vite, ['build'], path.join(root, 'client'));

  // A second launcher may have finished starting while this one was building.
  if (await alreadyRunning(url)) {
    console.log(`SPMusic đã chạy tại ${url}`);
    openBrowser(url);
    return;
  }
  await checkPort(port, host);

  // Keep Express and PostgreSQL in this process so Ctrl+C closes the database cleanly.
  await import('../server/src/index.js');
  console.log(`\nỨng dụng: ${url}\nGiữ cửa sổ này mở trong lúc nghe nhạc. Nhấn Ctrl+C để dừng.\n`);
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await alreadyRunning(url)) {
      openBrowser(url);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.log(`Trình duyệt chưa tự mở. Bạn có thể truy cập ${url}`);
}

main().catch((error) => {
  console.error('\nKhông thể khởi chạy SPMusic:', error.message);
  process.exitCode = 1;
});

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fork } from 'node:child_process';
import dotenv from 'dotenv';
import { AI_MODEL } from '../server/src/lyrics-ai.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, 'server/.env') });
const dataDir = path.resolve(root, 'server', process.env.DATA_DIR || 'data');
console.log('Chuẩn bị Whisper cục bộ. Chỉ tải mô hình; không gửi nhạc hoặc lyrics.');
const child = fork(path.join(root, 'server/src/lyrics-ai-worker.js'), [], {
  execArgv: [],
  windowsHide: true,
  stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
});
let success = false;
child.on('message', (message) => {
  if (message.message) console.log(message.message);
  if (message.error) console.error(message.error);
  if (message.result?.ready) {
    success = true;
    console.log('AI đã sẵn sàng. Có thể căn lời ngay trên web.');
  }
});
child.on('error', (error) => console.error(error.message));
child.once('exit', () => {
  process.exitCode = success ? 0 : 1;
});
child.send({
  setupOnly: true,
  model: AI_MODEL,
  cacheDir: path.resolve(process.env.LYRICS_AI_CACHE || path.join(dataDir, 'ai-models')),
  offline: process.argv.includes('--offline'),
});

import { fork } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

const root = path.resolve('.');
const work = path.join(root, '.runtime', 'lyrics-transcription-qa');
await fs.mkdir(work, { recursive: true });
const worker = fork(path.join(root, 'server/src/lyrics-ai-worker.js'), [], { execArgv: [], windowsHide: true, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
let result;
worker.on('message', (message) => {
  if (message.message) console.log(message.message);
  if (message.error) console.error(message.error);
  if (message.result) result = message.result;
});
worker.on('exit', () => {
  const text = result?.lines?.map((line) => line.text).join(' ') || '';
  console.log('Recognized speech:', text);
  process.exitCode = /music/i.test(text) ? 0 : 1;
});
worker.send({ audioPath: path.join(work, 'speech.wav'), pcmPath: path.join(work, `recognition-${Date.now()}.f32`), lines: [], mode: 'transcribe', language: 'en', model: 'Xenova/whisper-small', cacheDir: path.join(root, '.runtime', 'whisper-small-qa'), offline: true });

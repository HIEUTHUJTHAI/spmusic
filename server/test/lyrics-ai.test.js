import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { plainLyrics, alignLyrics, lrcTime } from '../src/lyrics-alignment.js';
import { createLyricsAI } from '../src/lyrics-ai.js';

const chunks = (words, start = 0) =>
  words.split(' ').map((text, i) => ({ text, timestamp: [start + i, start + i + 0.8] }));

test('AI input preserves supplied lines and strips old LRC timestamps and metadata', () => {
  assert.deepEqual(plainLyrics('[ar:Demo]\n[00:12.50] Câu thứ nhất\n\nCâu thứ hai'), [
    'Câu thứ nhất',
    'Câu thứ hai',
  ]);
  for (const value of ['', 'one', '\0hello world', 'x'.repeat(33000), 'hi there\n'.repeat(201)])
    assert.throws(() => plainLyrics(value));
});
test('Vietnamese alignment ignores punctuation, case and accents, while preserving original text', () => {
  const result = alignLyrics(
    ['Đây là câu hát.', 'Mình cùng nghe nhé!'],
    [...chunks('day la cau hat', 12.5), ...chunks('minh cung nghe nhe', 22)],
    30,
  );
  assert.equal(result.matchedLines, 2);
  assert.equal(result.lines[0].start, 12.5);
  assert.equal(result.lines[1].start, 22);
  assert.match(result.lrc, /\[00:12.50\] Đây là câu hát\./);
});
test('repeated choruses use separate acoustic occurrences in chronological order', () => {
  const result = alignLyrics(
    ['Sing with me', 'Sing with me'],
    chunks('sing with me sing with me', 4),
    20,
  );
  assert.deepEqual(
    result.lines.map((line) => line.start),
    [4, 7],
  );
});
test('missing lines stay unresolved; silence and unrelated transcription never invent timing', () => {
  const result = alignLyrics(
    ['Hello my friend', 'Unmatched words nowhere'],
    chunks('hello my friend', 5),
    30,
  );
  assert.equal(result.lines[1].start, null);
  assert.equal(result.lrc, null);
  assert.throws(() => alignLyrics(['Hello my friend'], [], 30), /giọng hát/);
  assert.throws(
    () => alignLyrics(['Hello my friend'], chunks('completely different words'), 30),
    /Chưa ghép/,
  );
  assert.throws(() =>
    alignLyrics(['Hello my friend'], [{ text: 'hello', timestamp: [null, null] }], 30),
  );
});
test('LRC rounding carries into the next minute correctly', () => {
  assert.equal(lrcTime(59.999), '01:00.00');
});

test('AI jobs isolate owners, limit concurrency, support cancellation and remove temporary files', async () => {
  const root = path.resolve('test-temp-ai-');
  const workingDir = await fs.mkdtemp(root);
  let worker;
  const ai = createLyricsAI({
    dataDir: workingDir,
    spawnWorker: () => {
      worker = new EventEmitter();
      worker.stderr = new EventEmitter();
      worker.send = (input) => {
        worker.input = input;
      };
      worker.kill = () => worker.emit('close', null);
      return worker;
    },
  });
  const job = await ai.start({
    ownerId: 'alice',
    content: 'hello my friend',
    language: 'en',
    audioPath: 'private.wav',
    workingDir,
  });
  assert.equal(worker.input.lines[0], 'hello my friend');
  assert.throws(() => ai.status(job.id, 'bob'), /Không tìm thấy/);
  assert.throws(() => ai.cancel(job.id, 'bob'), /Không tìm thấy/);
  await assert.rejects(
    ai.start({ ownerId: 'bob', content: 'another song', workingDir }),
    /đang xử lý/,
  );
  worker.emit('message', { stage: 'transcribing', message: 'Working', progress: 50 });
  assert.equal(ai.status(job.id, 'alice').progress, 50);
  assert.equal(ai.cancel(job.id, 'alice').status, 'cancelled');
  for (let attempt = 0; attempt < 20; attempt++) {
    if (!(await fs.stat(workingDir).catch(() => null))) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await assert.rejects(fs.access(workingDir));
});

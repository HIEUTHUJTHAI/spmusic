import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createYoutubeImporter, youtubeVideoUrl } from '../src/youtube.js';

const id = 'AbCdEfGh123';
const url = `https://www.youtube.com/watch?v=${id}`;

test('YouTube URLs accept one video and reject alternate hosts and playlists', () => {
  for (const candidate of [
    url, `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/shorts/${id}`,
    `https://music.youtube.com/watch?v=${id}&list=abc`,
  ]) assert.deepEqual(youtubeVideoUrl(candidate), { id, url });
  for (const candidate of [
    'http://www.youtube.com/watch?v=AbCdEfGh123',
    'https://www.youtube.com.evil.test/watch?v=AbCdEfGh123',
    'https://www.youtube.com/playlist?list=abc',
    'https://www.youtube.com/watch?v=invalid',
    'https://www.youtube.com:8443/watch?v=AbCdEfGh123',
    'https://127.0.0.1/watch?v=AbCdEfGh123',
  ]) assert.throws(() => youtubeVideoUrl(candidate));
});

test('YouTube import saves an owned MP3 once and hides jobs from other users', async () => {
  const uploadsDir = await fs.mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-youtube-'));
  await Promise.all(['temp', 'audio'].map((folder) => fs.mkdir(path.join(uploadsDir, folder))));
  const rows = [];
  let downloads = 0;
  const db = { async query(sql, values) {
    if (sql.startsWith('SELECT')) return { rows: rows.filter((row) =>
      row.owner_id === values[0] && row.source_key === values[1]) };
    if (sql.startsWith('INSERT')) {
      const row = {
        id: values[0], owner_id: values[1], title: values[2], artist: values[3],
        duration: values[6], audio_file: values[7], audio_format: values[8],
        source_key: values[11], source_info: values[12],
      };
      rows.push(row);
      return { rows: [row] };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  } };
  const service = createYoutubeImporter({
    db, uploadsDir, trackView: (row) => row,
    inspect: async () => ({ id, duration: 92, title: 'Own Song', uploader: 'My Channel' }),
    download: async (_url, directory, _signal, onProgress) => {
      downloads++;
      onProgress(50);
      const file = path.join(directory, 'audio.mp3');
      await fs.writeFile(file, 'fake mp3');
      return file;
    },
    prepare: async () => ({ ext: '.mp3', format: 'MP3', duration: 92, sampleRate: 44100, bitDepth: null }),
  });
  const settled = async (job) => {
    for (let i = 0; i < 100; i++) {
      const current = service.status(job.id, 'owner-a');
      if (['completed', 'failed', 'cancelled'].includes(current.status)) return current;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('Job did not settle');
  };
  try {
    assert.throws(() => service.start('owner-a', { url, licensed: false }));
    const first = service.start('owner-a', { url, licensed: true });
    assert.throws(() => service.status(first.id, 'owner-b'));
    assert.throws(() => service.cancel(first.id, 'owner-b'));
    const done = await settled(first);
    assert.equal(done.status, 'completed', done.message);
    assert.equal(done.track.title, 'Own Song');
    assert.equal(done.track.owner_id, 'owner-a');
    assert.equal(rows.length, 1);
    assert.equal(await fs.readFile(path.join(uploadsDir, 'audio', rows[0].audio_file), 'utf8'), 'fake mp3');
    const second = await settled(service.start('owner-a', { url, licensed: true }));
    assert.equal(second.existing, true);
    assert.equal(downloads, 1);
  } finally {
    await service.close();
    await fs.rm(uploadsDir, { recursive: true, force: true });
  }
});

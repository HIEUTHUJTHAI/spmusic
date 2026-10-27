import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once, EventEmitter } from 'node:events';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { MAX_AUDIO_BYTES, validateAudioFile } from '../src/audio.js';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { validateLrc, validateCover } from '../src/validation.js';
import { createLyricsAI } from '../src/lyrics-ai.js';

const execute = promisify(execFile);
const audioTool = (args) =>
  execute(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', ...args], {
    windowsHide: true,
    encoding: 'buffer',
    maxBuffer: 8 * 1024 * 1024,
  });

test('audio size boundary and supported extensions are explicit', () => {
  for (const originalname of ['a.FLAC', 'a.m4a', 'a.wav', 'a.mp3']) {
    assert.ok(validateAudioFile({ originalname, size: MAX_AUDIO_BYTES }));
    assert.throws(() => validateAudioFile({ originalname, size: MAX_AUDIO_BYTES + 1 }));
    assert.throws(() => validateAudioFile({ originalname, size: 0 }));
  }
  assert.throws(() => validateAudioFile({ originalname: 'a.exe', size: 10 }));
});

function wav() {
  const bytes = Buffer.alloc(44 + 8000 * 2);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(bytes.length - 44, 40);
  return bytes;
}
const demo = {
  id: 'demo-1',
  title: 'Original demo',
  artist: 'Auralis',
  album: 'Test',
  genre: 'Ambient',
  duration: 1,
  audioUrl: '/demo/demo-1.wav',
  coverUrl: '/covers/demo.svg',
  hasLyrics: true,
};
const validLyrics =
  '[ar:Auralis]\n[offset:100]\n[00:00.00]Một dòng mẫu\n[00:00.50][00:00.75]Dòng thứ hai';
const validCover = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOBsAAAAASUVORK5CYII=',
  'base64',
);
function uploadForm({ audio = wav(), filename = 'sample.wav', lyrics = validLyrics, cover } = {}) {
  const body = new FormData();
  body.set('title', 'Bản nhạc riêng');
  body.set('artist', 'Nghệ sĩ riêng');
  body.set('album', 'Album của tôi');
  body.set('genre', 'Ambient');
  if (audio) body.set('audio', new Blob([audio]), filename);
  if (lyrics !== null) body.set('lyrics', new Blob([lyrics]), 'sample.lrc');
  if (cover) body.set('cover', new Blob([cover]), 'cover.png');
  return body;
}
function coverForm(bytes = validCover, name = 'cover.png') {
  const body = new FormData();
  body.set('cover', new Blob([bytes]), name);
  return body;
}

test('LRC validation accepts timestamps, repeated stamps and offset; rejects corrupt and untimed data', () => {
  assert.equal(validateLrc(Buffer.from(validLyrics)), validLyrics);
  for (const value of [
    'plain lyrics',
    '[00:99.00]bad seconds',
    '[ar:Only metadata]',
    '[00:01.00]\u0000bad',
  ])
    assert.throws(() => validateLrc(Buffer.from(value)));
  assert.throws(() => validateLrc(Buffer.from([0xff, 0xfe, 0xff])));
  assert.throws(() => validateLrc(Buffer.alloc(256 * 1024 + 1, 65)));
});

test('cover validation rejects truncated image containers and excessive dimensions', () => {
  const cover = (buffer) => ({ originalname: 'cover.png', size: buffer.length, buffer });
  assert.equal(validateCover(cover(validCover)), '.png');
  assert.throws(() => validateCover(cover(validCover.subarray(0, 24))));
  const hugeDimensions = Buffer.from(validCover);
  hugeDimensions.writeUInt32BE(100000, 16);
  assert.throws(() => validateCover(cover(hugeDimensions)));
  assert.throws(() =>
    validateCover({
      originalname: 'cover.jpg',
      size: 4,
      buffer: Buffer.from([255, 216, 255, 217]),
    }),
  );
  const fakeWebp = Buffer.from('RIFF0000WEBPVP8 ');
  assert.throws(() =>
    validateCover({ originalname: 'cover.webp', size: fakeWebp.length, buffer: fakeWebp }),
  );
});

test('API integration: auth, ownership, uploads, media range, playlists, history, lyrics and persistence', async (t) => {
  // A workspace-local temp directory also works in restricted Windows profiles,
  // where OS temp may reject PostgreSQL's atomic WAL file renames.
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const tempPrefix = path.join(serverRoot, 'test-temp-');
  const dataDir = await fs.mkdtemp(tempPrefix);
  const publicDir = path.join(dataDir, 'public');
  await fs.mkdir(path.join(publicDir, 'demo'), { recursive: true });
  await fs.writeFile(path.join(publicDir, 'demo/demo-1.lrc'), validLyrics);
  await fs.writeFile(path.join(publicDir, 'demo/demo-1.wav'), wav());
  let db = await createDatabase({ dataDir, databaseUrl: '' });
  // API tests exercise the real job lifecycle with deterministic worker events.
  // The actual Whisper model is tested separately with locally generated speech.
  let aiWorker;
  const lyricsAI = createLyricsAI({
    dataDir,
    spawnWorker: () => {
      aiWorker = new EventEmitter();
      aiWorker.stderr = new EventEmitter();
      aiWorker.send = (input) => {
        aiWorker.input = input;
      };
      aiWorker.kill = () => aiWorker.emit('close', null);
      return aiWorker;
    },
  });
  const app = await createApp({ db, dataDir, publicDir, demos: [demo], lyricsAI });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let aliceCookie, bobCookie, trackId, playlistId;
  const request = async (url, { method = 'GET', cookie, body, headers = {} } = {}) => {
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const response = await fetch(base + url, { method, headers, body });
    const type = response.headers.get('content-type') || '';
    const content = type.includes('application/json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return {
      response,
      status: response.status,
      body: content,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    };
  };
  try {
    await t.test('guest can browse only samples and must sign in for changes', async () => {
      assert.equal((await request('/api/auth/me')).body.user, null);
      const tracks = await request('/api/tracks');
      assert.equal(tracks.body.tracks.length, 1);
      assert.equal(tracks.body.tracks[0].isDemo, true);
      for (const url of ['/api/playlists', '/api/history'])
        assert.equal((await request(url)).status, 401);
      assert.equal((await request('/api/tracks', { method: 'POST', body: {} })).status, 401);
      assert.equal(
        (
          await request('/api/auth/register', {
            method: 'POST',
            body: { name: 'A', email: 'bad', password: '12345678' },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request('/api/auth/register', {
            method: 'POST',
            body: { name: 'A', email: 'a@test.local', password: 'short' },
          })
        ).status,
        400,
      );
      const denied = await request('/api/auth/register', {
        method: 'POST',
        headers: { Origin: 'https://untrusted.example' },
        body: { name: 'A', email: 'a@test.local', password: '12345678' },
      });
      assert.equal(denied.status, 403);
    });
    await t.test('accounts use private cookies and duplicate/bad login errors', async () => {
      const alice = await request('/api/auth/register', {
        method: 'POST',
        body: { name: 'Alice', email: 'alice@test.local', password: 'AlicePassword1' },
      });
      assert.equal(alice.status, 201);
      aliceCookie = alice.cookie;
      assert.ok(alice.response.headers.get('set-cookie').includes('HttpOnly'));
      assert.equal(alice.body.user.password_hash, undefined);
      assert.equal(
        (
          await request('/api/auth/register', {
            method: 'POST',
            body: { name: 'Alice', email: 'ALICE@test.local', password: 'AlicePassword1' },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request('/api/auth/login', {
            method: 'POST',
            body: { email: 'alice@test.local', password: 'WrongPassword1' },
          })
        ).status,
        401,
      );
      const bob = await request('/api/auth/register', {
        method: 'POST',
        body: { name: 'Bob', email: 'bob@test.local', password: 'BobPassword12' },
      });
      assert.equal(bob.status, 201);
      bobCookie = bob.cookie;
      assert.equal(
        (await request('/api/auth/me', { cookie: aliceCookie })).body.user.name,
        'Alice',
      );
    });
    await t.test('invalid uploads leave no files; WAV upload writes separate folders', async () => {
      for (const form of [
        uploadForm({ audio: Buffer.from('fake mp3'), filename: 'bad.mp3' }),
        uploadForm({ audio: wav(), filename: 'bad.exe' }),
        uploadForm({ lyrics: 'untimed lyrics' }),
        uploadForm({ cover: Buffer.from('<svg/>') }),
      ]) {
        assert.equal(
          (await request('/api/tracks', { method: 'POST', cookie: aliceCookie, body: form }))
            .status,
          400,
        );
      }
      assert.deepEqual(await fs.readdir(path.join(dataDir, 'uploads/audio')), []);
      const created = await request('/api/tracks', {
        method: 'POST',
        cookie: aliceCookie,
        body: uploadForm({ cover: validCover }),
      });
      assert.equal(created.status, 201);
      trackId = created.body.track.id;
      assert.equal(created.body.track.hasLyrics, true);
      assert.equal(created.body.track.duration, 1);
      assert.equal(created.body.track.audio_file, undefined);
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/audio'))).length, 1);
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/covers'))).length, 1);
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/lyrics'))).length, 1);
      const oversized = uploadForm({ lyrics: '[00:00.00]' + 'a'.repeat(256 * 1024) });
      assert.equal(
        (await request('/api/tracks', { method: 'POST', cookie: aliceCookie, body: oversized }))
          .status,
        400,
      );
    });
    await t.test('owners can replace and remove track covers without leaving old files', async () => {
      const url = `/api/tracks/${trackId}/cover`;
      assert.equal((await request(url, { method: 'PUT', cookie: bobCookie, body: coverForm() })).status, 404);
      assert.equal((await request(url, { method: 'PUT', cookie: aliceCookie, body: coverForm(Buffer.from('bad')) })).status, 400);
      const first = await request(url, { method: 'PUT', cookie: aliceCookie, body: coverForm() });
      assert.equal(first.status, 200);
      const second = await request(url, { method: 'PUT', cookie: aliceCookie, body: coverForm() });
      assert.notEqual(second.body.track.coverUrl, first.body.track.coverUrl);
      assert.deepEqual((await request(second.body.track.coverUrl, { cookie: aliceCookie })).body, validCover);
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/covers'))).length, 1);
      assert.equal((await request(url, { method: 'DELETE', cookie: bobCookie })).status, 404);
      const removed = await request(url, { method: 'DELETE', cookie: aliceCookie });
      assert.equal(removed.body.track.coverUrl, '/covers/fallback.svg');
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/covers'))).length, 0);
      assert.equal((await request(url, { method: 'PUT', cookie: aliceCookie, body: coverForm() })).status, 200);
    });
    await t.test(
      'AI routes protect owners and return reviewable drafts for existing and new audio',
      async () => {
        assert.equal(
          (
            await request(`/api/tracks/${trackId}/lyrics/align`, {
              method: 'POST',
              cookie: bobCookie,
              body: { content: 'Hello my friend', language: 'en' },
            })
          ).status,
          404,
        );
        assert.equal((await request('/api/lyrics/align', { method: 'POST' })).status, 401);
        const started = await request(`/api/tracks/${trackId}/lyrics/align`, {
          method: 'POST',
          cookie: aliceCookie,
          body: { content: 'Hello my friend', language: 'en' },
        });
        assert.equal(started.status, 202, JSON.stringify(started.body));
        const id = started.body.job.id;
        assert.equal((await request(`/api/lyrics/align/${id}`, { cookie: bobCookie })).status, 404);
        assert.equal(
          (await request(`/api/lyrics/align/${id}`, { method: 'DELETE', cookie: bobCookie }))
            .status,
          404,
        );
        const result = {
          lines: [{ text: 'Hello my friend', start: 0.2, confidence: 100 }],
          duration: 1,
          matchedLines: 1,
          totalLines: 1,
          lrc: '[00:00.20] Hello my friend',
        };
        aiWorker.emit('message', { result });
        aiWorker.emit('close', 0);
        assert.equal(
          (await request(`/api/lyrics/align/${id}`, { cookie: aliceCookie })).body.job.status,
          'completed',
        );
        assert.equal(
          (await request(`/api/tracks/${trackId}/lyrics`, { cookie: aliceCookie })).body.content,
          validLyrics,
          'AI must not overwrite saved lyrics before the user applies and saves',
        );
        const form = new FormData();
        form.set('audio', new Blob([wav()]), 'new.wav');
        form.set('content', 'Hello my friend');
        form.set('language', 'en');
        const uploaded = await request('/api/lyrics/align', {
          method: 'POST',
          cookie: aliceCookie,
          body: form,
        });
        assert.equal(uploaded.status, 202, JSON.stringify(uploaded.body));
        assert.ok(aiWorker.input.audioPath.includes('ai-upload-'));
        assert.equal(
          (
            await request(`/api/lyrics/align/${uploaded.body.job.id}`, {
              method: 'DELETE',
              cookie: aliceCookie,
            })
          ).body.job.status,
          'cancelled',
        );
        assert.equal((await db.query('SELECT COUNT(*) AS count FROM tracks')).rows[0].count, 1);
        for (
          let i = 0;
          i < 20 && (await fs.readdir(path.join(dataDir, 'uploads/temp'))).length;
          i++
        )
          await new Promise((resolve) => setTimeout(resolve, 20));
        assert.deepEqual(await fs.readdir(path.join(dataDir, 'uploads/temp')), []);
      },
    );
    await t.test(
      'MP3 silence uploads, streams unchanged and deletes; truncated MPEG/ID3 headers fail',
      async () => {
        const mp3 = await fs.readFile(new URL('./fixtures/silence.mp3', import.meta.url));
        const created = await request('/api/tracks', {
          method: 'POST',
          cookie: aliceCookie,
          body: uploadForm({ audio: mp3, filename: 'silence.MP3', lyrics: null }),
        });
        assert.equal(created.status, 201);
        assert.equal(created.body.track.hasLyrics, false);
        const id = created.body.track.id;
        const media = await request(`/api/media/${id}/audio`, { cookie: aliceCookie });
        assert.equal(media.status, 200);
        assert.deepEqual(media.body, mp3);
        assert.equal(
          (await request(`/api/tracks/${id}`, { method: 'DELETE', cookie: aliceCookie })).status,
          200,
        );
        for (const invalid of [
          mp3.subarray(0, 4),
          Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00'),
        ]) {
          assert.equal(
            (
              await request('/api/tracks', {
                method: 'POST',
                cookie: aliceCookie,
                body: uploadForm({ audio: invalid, filename: 'bad.mp3', lyrics: null }),
              })
            ).status,
            400,
          );
        }
      },
    );
    await t.test(
      'FLAC and ALAC preserve 24-bit/96-kHz PCM, private playback, seeking and cleanup',
      async () => {
        const source = path.join(dataDir, 'original-24bit.wav');
        await audioTool([
          '-f',
          'lavfi',
          '-i',
          'aevalsrc=0.13*sin(2*PI*523.25*t):s=96000:d=1.25',
          '-c:a',
          'pcm_s24le',
          source,
        ]);
        const pcm = async (file) =>
          (
            await audioTool([
              '-i',
              file,
              '-map',
              '0:a:0',
              '-c:a',
              'pcm_s32le',
              '-f',
              's32le',
              'pipe:1',
            ])
          ).stdout;
        const originalPcm = await pcm(source);
        for (const [extension, codec] of [
          ['flac', 'flac'],
          ['m4a', 'alac'],
        ]) {
          const fixture = path.join(dataDir, `lossless.${extension}`);
          await audioTool(['-i', source, '-c:a', codec, fixture]);
          const bytes = await fs.readFile(fixture);
          const result = await request('/api/tracks', {
            method: 'POST',
            cookie: aliceCookie,
            body: uploadForm({ audio: bytes, filename: `Nhạc riêng.${extension.toUpperCase()}` }),
          });
          assert.equal(result.status, 201, JSON.stringify(result.body));
          const track = result.body.track;
          assert.equal(track.isLossless, true);
          assert.equal(track.sampleRate, 96000);
          assert.equal(track.bitDepth, 24);
          assert.equal(track.duration, 1.25);
          assert.equal(track.audioFormat, codec.toUpperCase());
          const stored = (await db.query('SELECT * FROM tracks WHERE id=$1', [track.id])).rows[0];
          assert.deepEqual(
            await fs.readFile(path.join(dataDir, 'uploads/audio', stored.audio_file)),
            bytes,
          );
          const media = await request(track.audioUrl, { cookie: aliceCookie });
          assert.equal(media.status, 200);
          assert.match(media.response.headers.get('content-type'), /audio\/flac/);
          const playback = path.join(dataDir, `returned-${extension}.flac`);
          await fs.writeFile(playback, media.body);
          assert.deepEqual(
            await pcm(playback),
            originalPcm,
            'Decoded PCM must match byte-for-byte',
          );
          const range = await request(track.audioUrl, {
            cookie: aliceCookie,
            headers: { Range: 'bytes=100-199' },
          });
          assert.equal(range.status, 206);
          assert.deepEqual(range.body, media.body.subarray(100, 200));
          assert.equal((await request(track.audioUrl, { cookie: bobCookie })).status, 404);
          assert.equal((await request(track.audioUrl)).status, 401);
          assert.equal(
            (await request(`/api/tracks/${track.id}/lyrics`, { cookie: aliceCookie })).body.content,
            validLyrics,
          );
          assert.equal(
            (await request(`/api/tracks/${track.id}`, { method: 'DELETE', cookie: aliceCookie }))
              .status,
            200,
          );
          await assert.rejects(fs.access(path.join(dataDir, 'uploads/audio', stored.audio_file)));
          if (stored.playback_file)
            await assert.rejects(
              fs.access(path.join(dataDir, 'uploads/playback', stored.playback_file)),
            );
        }
        const aac = path.join(dataDir, 'lossy.m4a');
        await audioTool(['-i', source, '-c:a', 'aac', aac]);
        const flac = await fs.readFile(path.join(dataDir, 'lossless.flac'));
        for (const [audio, filename] of [
          [await fs.readFile(aac), 'aac.m4a'],
          [wav(), 'renamed.flac'],
          [flac.subarray(0, flac.length - 500), 'truncated.flac'],
          [Buffer.from('fLaC'), 'fake.flac'],
        ]) {
          const result = await request('/api/tracks', {
            method: 'POST',
            cookie: aliceCookie,
            body: uploadForm({ audio, filename, lyrics: null }),
          });
          assert.equal(result.status, 400, filename);
        }
        assert.deepEqual(await fs.readdir(path.join(dataDir, 'uploads/temp')), []);
        assert.deepEqual(await fs.readdir(path.join(dataDir, 'uploads/playback')), []);
      },
    );
    await t.test(
      'oversized audio, cover and dedicated LRC uploads fail without leaving files',
      async () => {
        const before = await Promise.all(
          ['audio', 'covers', 'lyrics'].map((folder) =>
            fs.readdir(path.join(dataDir, 'uploads', folder)),
          ),
        );
        // Stream the oversized body instead of allocating multiple 250-MB copies.
        async function* oversizedBody() {
          yield Buffer.from(
            '--auralis-limit\r\nContent-Disposition: form-data; name="audio"; filename="large.flac"\r\nContent-Type: audio/flac\r\n\r\n',
          );
          const chunk = Buffer.alloc(1024 * 1024);
          for (let i = 0; i < 250; i++) yield chunk;
          yield Buffer.from('x\r\n--auralis-limit--\r\n');
        }
        const tooLarge = await fetch(base + '/api/tracks', {
          method: 'POST',
          duplex: 'half',
          headers: {
            Cookie: aliceCookie,
            'Content-Type': 'multipart/form-data; boundary=auralis-limit',
          },
          body: oversizedBody(),
        });
        assert.equal(tooLarge.status, 400);
        assert.match((await tooLarge.json()).error, /250 MB/);
        const hugeCover = Buffer.alloc(5 * 1024 * 1024 + 1);
        validCover.copy(hugeCover);
        assert.equal(
          (
            await request('/api/tracks', {
              method: 'POST',
              cookie: aliceCookie,
              body: uploadForm({ cover: hugeCover, lyrics: null }),
            })
          ).status,
          400,
        );
        const hugeLrc = new FormData();
        hugeLrc.set('lyrics', new Blob(['[00:00.00]' + 'a'.repeat(256 * 1024)]), 'huge.lrc');
        assert.equal(
          (
            await request(`/api/tracks/${trackId}/lyrics`, {
              method: 'PUT',
              cookie: aliceCookie,
              body: hugeLrc,
            })
          ).status,
          400,
        );
        const after = await Promise.all(
          ['audio', 'covers', 'lyrics'].map((folder) =>
            fs.readdir(path.join(dataDir, 'uploads', folder)),
          ),
        );
        assert.deepEqual(after, before);
      },
    );
    await t.test('private tracks and media are owner scoped, including range seeking', async () => {
      assert.equal((await request('/api/tracks', { cookie: aliceCookie })).body.tracks.length, 2);
      assert.equal((await request('/api/tracks', { cookie: bobCookie })).body.tracks.length, 1);
      assert.equal((await request(`/api/media/${trackId}/audio`)).status, 401);
      assert.equal(
        (await request(`/api/media/${trackId}/audio`, { cookie: bobCookie })).status,
        404,
      );
      assert.equal(
        (await request(`/api/media/${trackId}/cover`, { cookie: bobCookie })).status,
        404,
      );
      assert.equal(
        (await request(`/api/media/${trackId}/cover`, { cookie: aliceCookie })).status,
        200,
      );
      const range = await request(`/api/media/${trackId}/audio`, {
        cookie: aliceCookie,
        headers: { Range: 'bytes=0-15' },
      });
      assert.equal(range.status, 206);
      assert.equal(range.body.length, 16);
      assert.equal(range.body.toString('ascii', 0, 4), 'RIFF');
      assert.equal(
        (
          await request(`/api/tracks/${trackId}`, {
            method: 'PATCH',
            cookie: bobCookie,
            body: { title: 'stolen' },
          })
        ).status,
        404,
      );
      assert.equal(
        (await request(`/api/tracks/${trackId}`, { method: 'DELETE', cookie: bobCookie })).status,
        404,
      );
      const edited = await request(`/api/tracks/${trackId}`, {
        method: 'PATCH',
        cookie: aliceCookie,
        body: { title: 'Đã đổi tên' },
      });
      assert.equal(edited.body.track.title, 'Đã đổi tên');
      assert.equal(
        (await request('/api/tracks?q=%C4%90%C3%A3', { cookie: aliceCookie })).body.tracks.length,
        1,
      );
    });
    await t.test('LRC read, replace, delete and bad format are enforced per owner', async () => {
      assert.equal((await request('/api/tracks/demo-1/lyrics')).body.content, validLyrics);
      assert.equal(
        (await request(`/api/tracks/${trackId}/lyrics`, { cookie: bobCookie })).status,
        404,
      );
      assert.equal(
        (
          await request(`/api/tracks/${trackId}/lyrics`, {
            method: 'PUT',
            cookie: bobCookie,
            body: { content: '[00:01.00]stolen' },
          })
        ).status,
        404,
      );
      assert.equal(
        (await request(`/api/tracks/${trackId}/lyrics`, { method: 'DELETE', cookie: bobCookie }))
          .status,
        404,
      );
      assert.equal(
        (
          await request(`/api/tracks/${trackId}/lyrics`, {
            method: 'PUT',
            cookie: aliceCookie,
            body: { content: 'invalid' },
          })
        ).status,
        400,
      );
      const updated = await request(`/api/tracks/${trackId}/lyrics`, {
        method: 'PUT',
        cookie: aliceCookie,
        body: { content: '[00:00.00]Lời mới\n[00:00.50]Dòng mới' },
      });
      assert.equal(updated.status, 200);
      assert.ok(updated.body.content.includes('Lời mới'));
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/lyrics'))).length, 1);
      assert.equal(
        (await request(`/api/tracks/${trackId}/lyrics`, { method: 'DELETE', cookie: aliceCookie }))
          .status,
        200,
      );
      assert.equal(
        (await request(`/api/tracks/${trackId}/lyrics`, { cookie: aliceCookie })).body.content,
        '',
      );
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/lyrics'))).length, 0);
    });
    await t.test('playlists reject foreign tracks, support edit and isolate accounts', async () => {
      const created = await request('/api/playlists', {
        method: 'POST',
        cookie: aliceCookie,
        body: { name: 'Thư giãn', description: 'Mô tả', trackIds: [demo.id, trackId] },
      });
      assert.equal(created.status, 201);
      playlistId = created.body.playlist.id;
      assert.deepEqual(created.body.playlist.trackIds, [demo.id, trackId]);
      assert.equal(
        (
          await request('/api/playlists', {
            method: 'POST',
            cookie: bobCookie,
            body: { name: 'Foreign', trackIds: [trackId] },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(`/api/playlists/${playlistId}`, {
            method: 'PATCH',
            cookie: bobCookie,
            body: { name: 'stolen' },
          })
        ).status,
        404,
      );
      assert.equal(
        (await request(`/api/playlists/${playlistId}`, { method: 'DELETE', cookie: bobCookie }))
          .status,
        404,
      );
      assert.deepEqual((await request('/api/playlists', { cookie: bobCookie })).body.playlists, []);
      const changed = await request(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        cookie: aliceCookie,
        body: { name: 'Đêm yên', trackIds: [trackId, demo.id, trackId] },
      });
      assert.equal(changed.body.playlist.name, 'Đêm yên');
      assert.equal(changed.body.playlist.trackIds.length, 2);
    });
    await t.test('playlist cover is private and cleaned up when playlist is deleted', async () => {
      const url = `/api/playlists/${playlistId}/cover`;
      assert.equal((await request(url, { method: 'PUT', cookie: bobCookie, body: coverForm() })).status, 404);
      assert.equal((await request(url, { method: 'PUT', cookie: aliceCookie, body: coverForm(Buffer.from('bad')) })).status, 400);
      const saved = await request(url, { method: 'PUT', cookie: aliceCookie, body: coverForm() });
      assert.equal(saved.status, 200);
      assert.ok(saved.body.playlist.coverUrl.includes('/cover?v='));
      assert.equal((await request(url, { cookie: bobCookie })).status, 404);
      assert.deepEqual((await request(saved.body.playlist.coverUrl, { cookie: aliceCookie })).body, validCover);
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/playlist-covers'))).length, 1);
      const removed = await request(url, { method: 'DELETE', cookie: aliceCookie });
      assert.equal(removed.body.playlist.coverUrl, null);
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/playlist-covers'))).length, 0);
      assert.equal((await request(url, { method: 'PUT', cookie: aliceCookie, body: coverForm() })).status, 200);
    });
    await t.test(
      'Origin guard rejects cross-site changes while accepting the actual local server origin',
      async () => {
        const blocked = await request(`/api/playlists/${playlistId}`, {
          method: 'PATCH',
          cookie: aliceCookie,
          headers: { Origin: 'https://untrusted.example' },
          body: { name: 'Cross-site edit' },
        });
        assert.equal(blocked.status, 403);
        assert.equal(
          (await request('/api/playlists', { cookie: aliceCookie })).body.playlists[0].name,
          'Đêm yên',
        );
        const sameOrigin = await request(`/api/playlists/${playlistId}`, {
          method: 'PATCH',
          cookie: aliceCookie,
          headers: { Origin: base },
          body: { description: 'Same-origin request' },
        });
        assert.equal(sameOrigin.status, 200);
        assert.equal(sameOrigin.body.playlist.description, 'Same-origin request');
        assert.equal(
          (await request(`/api/tracks/${demo.id}`, { method: 'DELETE', cookie: aliceCookie }))
            .status,
          404,
        );
      },
    );
    await t.test('recent history is persistent, private and deduplicated', async () => {
      assert.equal(
        (await request('/api/history', { method: 'POST', cookie: bobCookie, body: { trackId } }))
          .status,
        400,
      );
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await request('/api/history', {
              method: 'POST',
              cookie: aliceCookie,
              body: { trackId },
            })
          ).status,
          201,
        );
      const history = await request('/api/history', { cookie: aliceCookie });
      assert.equal(history.body.history.length, 1);
      assert.equal(history.body.history[0].trackId, trackId);
      assert.equal((await request('/api/history', { cookie: bobCookie })).body.history.length, 0);
    });
    await t.test(
      'deleting a track removes references and files; logout invalidates session',
      async () => {
        assert.equal(
          (await request(`/api/tracks/${trackId}`, { method: 'DELETE', cookie: aliceCookie }))
            .status,
          200,
        );
        assert.equal(
          (await request('/api/history', { cookie: aliceCookie })).body.history.length,
          0,
        );
        assert.deepEqual(
          (await request('/api/playlists', { cookie: aliceCookie })).body.playlists[0].trackIds,
          [demo.id],
        );
        assert.equal((await fs.readdir(path.join(dataDir, 'uploads/audio'))).length, 0);
        assert.equal((await fs.readdir(path.join(dataDir, 'uploads/covers'))).length, 0);
        assert.equal(
          (await request(`/api/playlists/${playlistId}`, { method: 'DELETE', cookie: aliceCookie }))
            .status,
          200,
        );
        assert.equal((await fs.readdir(path.join(dataDir, 'uploads/playlist-covers'))).length, 0);
        assert.equal(
          (await request('/api/auth/logout', { method: 'POST', cookie: aliceCookie })).status,
          200,
        );
        assert.equal((await request('/api/auth/me', { cookie: aliceCookie })).body.user, null);
        const login = await request('/api/auth/login', {
          method: 'POST',
          body: { email: 'alice@test.local', password: 'AlicePassword1' },
        });
        assert.equal(login.status, 200);
        assert.equal(login.body.user.name, 'Alice');
        aliceCookie = login.cookie;
      },
    );
    await t.test('expired session cookies lose access to private account data', async () => {
      await db.query(
        'UPDATE sessions SET expires_at=$1 WHERE user_id=(SELECT id FROM users WHERE email=$2)',
        [new Date(Date.now() - 1000), 'alice@test.local'],
      );
      assert.equal((await request('/api/auth/me', { cookie: aliceCookie })).body.user, null);
      assert.equal((await request('/api/playlists', { cookie: aliceCookie })).status, 401);
    });
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    db = await createDatabase({ dataDir, databaseUrl: '' });
    assert.equal(Number((await db.query('SELECT COUNT(*) AS total FROM users')).rows[0].total), 2);
  } finally {
    lyricsAI.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await db.close();
    if (!dataDir.startsWith(tempPrefix)) throw new Error('Unexpected temporary directory.');
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

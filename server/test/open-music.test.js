import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { prepareAudio, MAX_AUDIO_BYTES } from '../src/audio.js';
import {
  archiveTracks,
  createOpenSources,
  openLicense,
  plain,
  qualityCompare,
} from '../src/open-music-sources.js';
import { publicAddress, sourceURL } from '../src/open-music-network.js';
import { downloadAudio } from '../src/open-music.js';

const license = 'https://creativecommons.org/licenses/by/4.0/';
test('open licenses reject ambiguous, restricted and spoofed URLs', () => {
  for (const value of [
    license,
    'http://creativecommons.org/licenses/by-sa/3.0',
    'https://creativecommons.org/publicdomain/zero/1.0/',
  ])
    assert.ok(openLicense(value));
  for (const value of [
    undefined,
    '',
    'CC BY 4.0',
    'https://creativecommons.org.evil.test/licenses/by/4.0/',
    'https://creativecommons.org/licenses/by-nc/4.0/',
    'https://creativecommons.org/licenses/by-nd/4.0/',
    'https://user@creativecommons.org/licenses/by/4.0/',
    'https://creativecommons.org/licenses/by/4.0/anything',
  ])
    assert.equal(openLicense(value), null);
  assert.equal(plain('<a href="javascript:alert(1)">Artist &amp; friend</a>'), 'Artist & friend');
});
test('downloads allow only trusted HTTPS paths and public IPs', () => {
  for (const u of [
    'https://archive.org/download/item/a.flac',
    'https://ia800100.us.archive.org/12/items/item/a.mp3',
    'https://upload.wikimedia.org/wikipedia/commons/a/ab/a.wav',
  ])
    assert.ok(sourceURL(u, 'audio'));
  for (const u of [
    'http://archive.org/download/a/b',
    'https://archive.org.evil.test/download/a/b',
    'https://127.0.0.1/download/a/b',
    'https://archive.org:3001/download/a/b',
    'https://user:pass@archive.org/download/a/b',
    'https://archive.org/metadata/a',
    'https://upload.wikimedia.org/anything',
  ])
    assert.throws(() => sourceURL(u, 'audio'));
  for (const ip of [
    '127.0.0.1',
    '10.0.0.2',
    '172.16.1.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    'not-an-ip',
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('8.8.8.8'), true);
});
test('quality selection keeps different tracks separate and prefers original lossless over lossy derivatives', () => {
  const data = {
    metadata: { mediatype: 'audio', licenseurl: license, creator: 'Artist', title: 'Album' },
    files: [
      { name: 'song.wav', source: 'original', size: '1000', format: 'WAVE' },
      {
        name: 'song.flac',
        source: 'derivative',
        original: 'song.wav',
        size: '800',
        format: 'Flac',
      },
      {
        name: 'song.mp3',
        source: 'derivative',
        original: 'song.wav',
        size: '400',
        format: '320Kbps MP3',
      },
      { name: 'other.mp3', source: 'original', size: '400', format: '128Kbps MP3' },
      { name: 'large.flac', source: 'original', size: MAX_AUDIO_BYTES + 1 },
      { name: '../bad.flac', size: 100 },
      { name: 'private.flac', size: 100, private: 'true' },
      { name: 'aac.m4a', size: 100, format: 'AAC' },
    ],
  };
  const tracks = archiveTracks('test-item', data);
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].format, 'WAV');
  assert.equal(tracks[0].alternatives, 3);
  assert.equal(tracks[1].bitrate, 128);
  assert.ok(
    qualityCompare(
      { lossless: false, bitrate: 320 },
      { lossless: true, bitDepth: 16, sampleRate: 44100 },
    ) > 0,
  );
  assert.ok(
    qualityCompare(
      { lossless: true, bitDepth: 16, sampleRate: 44100 },
      { lossless: true, bitDepth: 24, sampleRate: 96000 },
    ) > 0,
  );
  assert.deepEqual(
    archiveTracks('test-item', {
      ...data,
      metadata: { ...data.metadata, licenseurl: 'all rights reserved' },
    }),
    [],
  );
  assert.deepEqual(
    archiveTracks('test-item', {
      ...data,
      metadata: { ...data.metadata, 'access-restricted-item': 'true' },
    }),
    [],
  );
});
test('source search validates inputs and returns partial results when one provider is unavailable', async () => {
  let observed;
  const sources = createOpenSources({
    json: async (url) => {
      const u = new URL(url);
      if (u.hostname === 'commons.wikimedia.org') throw new Error('offline');
      observed = u;
      return {
        response: {
          numFound: 1,
          docs: [{ identifier: 'demo', title: 'Demo', creator: 'Artist', licenseurl: license }],
        },
      };
    },
  });
  const result = await sources.search('piano OR jazz');
  assert.equal(result.items.length, 1);
  assert.equal(result.warnings.length, 1);
  assert.ok(observed.searchParams.get('q').includes('"piano" AND "OR" AND "jazz"'));
  for (const args of [['x'], ['piano', 'bad'], ['piano', 'all', 0]])
    await assert.rejects(sources.search(...args));
  await assert.rejects(sources.tracks('archive', '../anything'));
  await assert.rejects(sources.tracks('commons', 'https://bad'));
});
test('Commons rejects missing license and external download hosts while keeping attribution as text', async () => {
  const page = {
    pageid: 12,
    title: 'File:Original.ogg',
    imageinfo: [
      {
        size: 50,
        url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Original.ogg',
        extmetadata: { Artist: { value: '<b>Artist</b>' }, LicenseUrl: { value: license } },
      },
    ],
  };
  let current = page;
  const source = createOpenSources({ json: async () => ({ query: { pages: [current] } }) });
  const [track] = await source.tracks('commons', '12');
  assert.equal(track.credit, 'Artist');
  assert.equal(track.lossless, false);
  current = { ...page, imageinfo: [{ ...page.imageinfo[0], url: 'https://localhost/a.ogg' }] };
  assert.deepEqual(await source.tracks('commons', '12'), []);
  current = { ...page, imageinfo: [{ ...page.imageinfo[0], extmetadata: {} }] };
  assert.deepEqual(await source.tracks('commons', '12'), []);
});

test('import APIs and download lifecycle persist media and credits, isolate owners, deduplicate and clean failures', async (t) => {
  const prefix = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-import-');
  const dataDir = await fs.mkdtemp(prefix);
  let db = await createDatabase({ dataDir, databaseUrl: '' });
  const bytes = Buffer.alloc(44 + 16000);
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
  bytes.writeUInt32LE(16000, 40);
  let mode = 'normal',
    downloads = 0;
  const sources = {
    search: async () => ({ items: [], warnings: [], more: false }),
    tracks: async (_s, id) =>
      mode === 'license-revoked'
        ? []
        : [
            {
              source: 'archive',
              itemId: id,
              key: 'original',
              file: 'original.wav',
              title: 'Open music',
              artist: 'Artist',
              album: 'Album',
              format: 'WAV',
              size: bytes.length,
              credit: 'Original artist',
              license: { name: 'CC BY 4.0', url: license },
              sourceUrl: 'https://archive.org/details/demo',
              downloadUrl: 'https://archive.org/download/demo/original.wav',
            },
          ],
  };
  const app = await createApp({
    db,
    dataDir,
    demos: [],
    openMusicOptions: {
      sources,
      download: async (track, dest, signal, progress) => {
        downloads++;
        await fs.writeFile(dest, bytes);
        progress(bytes.length, bytes.length);
        if (mode === 'slow')
          await new Promise((resolve, reject) => {
            if (signal.aborted) return reject(signal.reason);
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          });
        if (mode === 'broken') throw new Error('broken');
        return bytes.length;
      },
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(url, cookie, method = 'GET', body) {
    const r = await fetch(base + url, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      body: r.headers.get('content-type')?.includes('application/json')
        ? await r.json()
        : Buffer.from(await r.arrayBuffer()),
      cookie: r.headers.get('set-cookie')?.split(';')[0],
    };
  }
  const alice = await request('/auth/register', null, 'POST', {
      name: 'Alice',
      email: 'imports-a@test.local',
      password: 'PasswordTest1',
    }),
    bob = await request('/auth/register', null, 'POST', {
      name: 'Bob',
      email: 'imports-b@test.local',
      password: 'PasswordTest2',
    });
  const payload = { source: 'archive', itemId: 'demo', key: 'original' };
  async function finish(id) {
    for (let i = 0; i < 100; i++) {
      const j = (await request('/open-music/jobs/' + id, alice.cookie)).body.job;
      if (['completed', 'failed', 'cancelled'].includes(j.status)) return j;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('Import did not finish');
  }
  let saved;
  try {
    await t.test(
      'private routes and successful import with provenance and duplicate avoidance',
      async () => {
        assert.equal((await request('/open-music/search?q=piano')).status, 401);
        assert.equal((await request('/open-music/jobs', null, 'POST', payload)).status, 401);
        const started = await request('/open-music/jobs', alice.cookie, 'POST', payload);
        assert.equal(started.status, 202);
        assert.equal(
          (await request('/open-music/jobs/' + started.body.job.id, bob.cookie)).status,
          404,
        );
        assert.equal(
          (await request('/open-music/jobs/' + started.body.job.id, bob.cookie, 'DELETE')).status,
          404,
        );
        saved = await finish(started.body.job.id);
        assert.equal(saved.status, 'completed', saved.message);
        assert.equal(saved.track.sourceInfo.credit, 'Original artist');
        assert.equal(saved.track.isLossless, true);
        assert.deepEqual(
          (await request('/media/' + saved.track.id + '/audio', alice.cookie)).body,
          bytes,
        );
        assert.equal(
          (await request('/media/' + saved.track.id + '/audio', bob.cookie)).status,
          404,
        );
        const duplicate = await request('/open-music/jobs', alice.cookie, 'POST', payload);
        const result = await finish(duplicate.body.job.id);
        assert.equal(result.existing, true);
        assert.equal(result.track.id, saved.track.id);
        assert.equal(downloads, 1);
        assert.equal((await request('/tracks', bob.cookie)).body.tracks.length, 0);
      },
    );
    await t.test(
      'file download rejects oversized headers, partial responses and cancellation',
      async () => {
        function stream(chunks, headers = {}) {
          const r = Readable.from(chunks);
          r.headers = headers;
          return r;
        }
        const target = path.join(dataDir, 'partial.wav');
        await assert.rejects(
          downloadAudio(
            { size: 3, downloadUrl: 'ignored' },
            target,
            new AbortController().signal,
            () => {},
            async () => stream([Buffer.from('x')], { 'content-length': '3' }),
          ),
        );
        await fs.unlink(target).catch(() => {});
        await assert.rejects(
          downloadAudio(
            {},
            target,
            new AbortController().signal,
            () => {},
            async () => stream([], { 'content-length': String(MAX_AUDIO_BYTES + 1) }),
          ),
        );
        const c = new AbortController();
        c.abort();
        await assert.rejects(
          downloadAudio(
            {},
            target,
            c.signal,
            () => {},
            async () => stream([bytes]),
          ),
        );
        await fs.unlink(target).catch(() => {});
      },
    );
    await t.test(
      'changed licenses and interrupted downloads cannot create partial library entries',
      async () => {
        for (const nextMode of ['license-revoked', 'broken']) {
          mode = nextMode;
          const started = await request('/open-music/jobs', alice.cookie, 'POST', {
            ...payload,
            itemId: nextMode,
          });
          const done = await finish(started.body.job.id);
          assert.equal(done.status, 'failed');
          for (let i = 0; i < 100 && app.locals.openMusic.active(alice.body.user.id); i++)
            await new Promise((r) => setTimeout(r, 10));
          assert.equal((await fs.readdir(path.join(dataDir, 'uploads/temp'))).length, 0);
          assert.equal((await request('/tracks', alice.cookie)).body.tracks.length, 1);
        }
      },
    );
    await t.test('cancellation and server shutdown clean temporary files', async () => {
      mode = 'slow';
      const slow = await request('/open-music/jobs', alice.cookie, 'POST', {
        ...payload,
        itemId: 'slow',
      });
      assert.equal((await request('/open-music/jobs', alice.cookie, 'POST', payload)).status, 409);
      await request('/open-music/jobs/' + slow.body.job.id, alice.cookie, 'DELETE');
      await app.locals.openMusic.close();
      assert.equal((await finish(slow.body.job.id)).status, 'cancelled');
      assert.equal((await fs.readdir(path.join(dataDir, 'uploads/temp'))).length, 0);
      assert.equal((await request('/tracks', alice.cookie)).body.tracks.length, 1);
    });
    await t.test('OGG and Opus are validated without falsely marking them lossless', async () => {
      const wav = path.join(dataDir, 'sample.wav');
      await fs.writeFile(wav, bytes);
      for (const [ext, codec] of [
        ['ogg', 'libvorbis'],
        ['opus', 'libopus'],
      ]) {
        const file = path.join(dataDir, 'sample.' + ext);
        await promisify(execFile)(
          ffmpeg,
          ['-hide_banner', '-loglevel', 'error', '-i', wav, '-c:a', codec, file],
          { windowsHide: true },
        );
        const info = await prepareAudio(
          { path: file, originalname: 'sample.' + ext, size: (await fs.stat(file)).size },
          dataDir,
        );
        assert.equal(info.format, ext === 'ogg' ? 'OGG' : 'OPUS');
        assert.equal(info.playbackPath, null);
      }
    });
    await new Promise((r) => server.close(r));
    await db.close();
    db = await createDatabase({ dataDir, databaseUrl: '' });
    assert.equal(
      (await db.query('SELECT source_info FROM tracks WHERE id=$1', [saved.track.id])).rows[0]
        .source_info.license.url,
      license,
    );
  } finally {
    await app.locals.openMusic.close();
    app.locals.lyricsAI.close();
    if (server.listening) await new Promise((r) => server.close(r));
    await db.close();
    if (!dataDir.startsWith(prefix)) throw new Error('Unexpected temp path');
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

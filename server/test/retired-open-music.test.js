import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

test('open music import is gone while previously imported tracks retain attribution', async () => {
  const prefix = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-retired-open-music-');
  const dataDir = await fs.mkdtemp(prefix);
  const db = await createDatabase({ dataDir, databaseUrl: '' });
  const app = await createApp({ db, dataDir, demos: [] });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const registered = await fetch(base + '/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Listener', email: 'retired@test.local', password: 'TestPass123' }),
    });
    assert.equal(registered.status, 201);
    const user = (await registered.json()).user;
    const cookie = registered.headers.get('set-cookie').split(';')[0];
    const sourceInfo = { title: 'Existing recording', providerName: 'Archive', sourceUrl: 'https://example.org/audio' };
    await db.query(
      `INSERT INTO tracks(id,owner_id,title,artist,album,genre,duration,audio_file,source_info)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      ['legacy-track', user.id, 'Existing recording', 'Artist', '', '', 10, 'old.wav', JSON.stringify(sourceInfo)],
    );
    const list = await fetch(base + '/tracks', { headers: { Cookie: cookie } });
    assert.equal(list.status, 200);
    assert.deepEqual((await list.json()).tracks[0].sourceInfo, sourceInfo);
    assert.equal((await fetch(base + '/open-music/search?q=test', { headers: { Cookie: cookie } })).status, 404);
    assert.equal((await fetch(base + '/youtube/jobs/active', { headers: { Cookie: cookie } })).status, 200);
  } finally {
    app.locals.lyricsAI.close();
    await app.locals.youtube.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await db.close();
    if (!dataDir.startsWith(prefix)) throw new Error('Unexpected test path');
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

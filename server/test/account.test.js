import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

test('account settings: private avatars, preferences, password changes and session revocation', async (t) => {
  const prefix = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-account-');
  const dataDir = await fs.mkdtemp(prefix);
  let db = await createDatabase({ dataDir, databaseUrl: '' });
  const app = await createApp({ db, dataDir, demos: [] });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOBsAAAAASUVORK5CYII=',
    'base64',
  );
  async function request(url, cookie, method = 'GET', body, extra = {}) {
    const headers = { ...extra };
    if (cookie) headers.Cookie = cookie;
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch(base + '/api' + url, { method, body, headers });
    const data = res.headers.get('content-type')?.includes('application/json')
      ? await res.json()
      : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const form = (bytes = png, name = 'avatar.png') => {
    const data = new FormData();
    data.set('avatar', new Blob([bytes]), name);
    return data;
  };
  try {
    const alice = await request('/auth/register', null, 'POST', {
      name: 'Alice',
      email: 'account-a@test.local',
      password: 'OriginalPass1',
    });
    const bob = await request('/auth/register', null, 'POST', {
      name: 'Bob',
      email: 'account-b@test.local',
      password: 'OriginalPass2',
    });
    assert.equal(alice.status, 201);
    assert.equal(bob.status, 201);
    assert.equal(alice.data.user.theme, 'pink');
    await t.test('account routes require authentication and reject foreign origins', async () => {
      for (const [url, method, body] of [
        ['/account/avatar', 'GET'],
        ['/account/avatar', 'PUT', form()],
        ['/account/avatar', 'DELETE'],
        ['/account/preferences', 'PATCH', { theme: 'mint' }],
        [
          '/account/password',
          'PUT',
          { currentPassword: 'OriginalPass1', newPassword: 'ChangedPass1' },
        ],
      ]) {
        assert.equal((await request(url, null, method, body)).status, 401);
      }
      assert.equal(
        (
          await request(
            '/account/preferences',
            alice.cookie,
            'PATCH',
            { theme: 'mint' },
            { Origin: 'https://untrusted.example' },
          )
        ).status,
        403,
      );
    });
    await t.test(
      'avatar upload validates files, isolates users, replaces and removes files',
      async () => {
        assert.equal(
          (
            await request(
              '/account/avatar',
              alice.cookie,
              'PUT',
              form(Buffer.from('<svg/>'), 'bad.svg'),
            )
          ).status,
          400,
        );
        assert.equal(
          (await request('/account/avatar', alice.cookie, 'PUT', form(Buffer.from('not png'))))
            .status,
          400,
        );
        assert.equal(
          (
            await request(
              '/account/avatar',
              alice.cookie,
              'PUT',
              form(Buffer.alloc(5 * 1024 * 1024 + 1)),
            )
          ).status,
          400,
        );
        const uploaded = await request('/account/avatar', alice.cookie, 'PUT', form());
        assert.equal(uploaded.status, 200);
        assert.ok(uploaded.data.user.avatarUrl);
        assert.equal(uploaded.data.user.password_hash, undefined);
        assert.equal(uploaded.data.user.avatar_file, undefined);
        assert.deepEqual((await request('/account/avatar', alice.cookie)).data, png);
        assert.equal((await request('/account/avatar', bob.cookie)).status, 404);
        // A copied URL cannot expose another account's image.
        assert.equal(
          (await request(uploaded.data.user.avatarUrl.slice(4), bob.cookie)).status,
          404,
        );
        const replacement = await request('/account/avatar', alice.cookie, 'PUT', form());
        assert.notEqual(replacement.data.user.avatarUrl, uploaded.data.user.avatarUrl);
        assert.equal((await fs.readdir(path.join(dataDir, 'uploads/avatars'))).length, 1);
        assert.equal(
          (await request('/account/avatar', alice.cookie, 'DELETE')).data.user.avatarUrl,
          null,
        );
        assert.equal((await fs.readdir(path.join(dataDir, 'uploads/avatars'))).length, 0);
        await request('/account/avatar', alice.cookie, 'PUT', form());
      },
    );
    await t.test('theme is validated and stored per account', async () => {
      assert.equal(
        (await request('/account/preferences', alice.cookie, 'PATCH', { theme: 'invalid' })).status,
        400,
      );
      for (const theme of ['dark', 'lavender', 'pink', 'mint']) {
        const result = await request('/account/preferences', alice.cookie, 'PATCH', { theme });
        assert.equal(result.status, 200);
        assert.equal(result.data.user.theme, theme);
      }
      const palette = {
        accent: '#123456', background: '#f8f8f8', surface: '#ffffff', text: '#202020',
      };
      assert.equal((await request('/account/preferences', alice.cookie, 'PATCH', {
        theme: 'custom', customTheme: { ...palette, accent: 'invalid' },
      })).status, 400);
      const custom = await request('/account/preferences', alice.cookie, 'PATCH', {
        theme: 'custom', customTheme: palette,
      });
      assert.equal(custom.status, 200);
      assert.deepEqual(custom.data.user.customTheme, palette);
      assert.deepEqual((await request('/auth/me', alice.cookie)).data.user.customTheme, palette);
      await request('/account/preferences', alice.cookie, 'PATCH', { theme: 'mint' });
      assert.equal((await request('/auth/me', alice.cookie)).data.user.theme, 'mint');
      assert.equal((await request('/auth/me', bob.cookie)).data.user.theme, 'pink');
    });
    await t.test(
      'password change verifies current password and revokes other sessions only',
      async () => {
        const other = await request('/auth/login', null, 'POST', {
          email: 'account-a@test.local',
          password: 'OriginalPass1',
        });
        for (const body of [
          { currentPassword: 'WrongPass1', newPassword: 'ChangedPass1' },
          { currentPassword: 'OriginalPass1', newPassword: 'short' },
          { currentPassword: 'OriginalPass1', newPassword: 'OriginalPass1' },
          { currentPassword: {}, newPassword: 'ChangedPass1' },
        ])
          assert.equal((await request('/account/password', alice.cookie, 'PUT', body)).status, 400);
        assert.equal(
          (
            await request('/account/password', alice.cookie, 'PUT', {
              currentPassword: 'OriginalPass1',
              newPassword: 'ChangedPass1',
            })
          ).status,
          200,
        );
        assert.equal((await request('/auth/me', other.cookie)).data.user, null);
        assert.equal((await request('/auth/me', alice.cookie)).data.user.name, 'Alice');
        assert.equal((await request('/auth/me', bob.cookie)).data.user.name, 'Bob');
        assert.equal(
          (
            await request('/auth/login', null, 'POST', {
              email: 'account-a@test.local',
              password: 'OriginalPass1',
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request('/auth/login', null, 'POST', {
              email: 'account-a@test.local',
              password: 'ChangedPass1',
            })
          ).status,
          200,
        );
        assert.equal((await request('/auth/logout', alice.cookie, 'POST')).status, 200);
        assert.equal((await request('/account/avatar', alice.cookie)).status, 401);
      },
    );
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    db = await createDatabase({ dataDir, databaseUrl: '' });
    const stored = (
      await db.query('SELECT theme, custom_theme, avatar_file FROM users WHERE id=$1', [alice.data.user.id])
    ).rows[0];
    assert.equal(stored.theme, 'mint');
    assert.deepEqual(stored.custom_theme, {
      accent: '#123456', background: '#f8f8f8', surface: '#ffffff', text: '#202020',
    });
    assert.ok(stored.avatar_file);
    assert.deepEqual(
      await fs.readFile(path.join(dataDir, 'uploads/avatars', stored.avatar_file)),
      png,
    );
  } finally {
    app.locals.lyricsAI.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await db.close();
    if (!dataDir.startsWith(prefix)) throw new Error('Unexpected test path');
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

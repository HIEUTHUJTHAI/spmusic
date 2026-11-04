const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { readGlassPreference, writeGlassPreference, validOpacity } = require('./glass-preferences.cjs');

async function preferenceFile(t) {
  const root = path.resolve(__dirname, '../server');
  const dir = await fs.mkdtemp(path.join(root, 'test-temp-glass-pref-'));
  t.after(async () => {
    assert.equal(path.dirname(dir), root);
    assert.ok(path.basename(dir).startsWith('test-temp-glass-pref-'));
    await fs.rm(dir, { recursive: true, force: true });
  });
  return path.join(dir, 'nested', 'glass-preferences.json');
}

test('glass tint persists across independent reads and overwrites at both limits', async (t) => {
  const file = await preferenceFile(t);
  assert.equal(await readGlassPreference(file), null);
  for (const value of [0.62, 0.15, 0.95]) {
    await writeGlassPreference(file, value);
    assert.equal(await readGlassPreference(file), value);
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { opacity: value });
  }
  await assert.rejects(fs.access(`${file}.tmp`), { code: 'ENOENT' });
});

test('missing, malformed and invalid persisted preferences fall back to null', async (t) => {
  const file = await preferenceFile(t);
  await fs.mkdir(path.dirname(file), { recursive: true });
  for (const content of ['{broken', 'null', '{}', '[]', '{"opacity":0}', '{"opacity":1}', '{"opacity":"0.62"}']) {
    await fs.writeFile(file, content, 'utf8');
    assert.equal(await readGlassPreference(file), null, content);
  }
});

test('invalid new values reject without replacing the previously saved preference', async (t) => {
  const file = await preferenceFile(t);
  await writeGlassPreference(file, 0.5);
  for (const value of [undefined, null, '', '0.62', {}, [], NaN, Infinity, -Infinity, 0.149, 0.951]) {
    assert.equal(validOpacity(value), false);
    await assert.rejects(writeGlassPreference(file, value), /không hợp lệ/);
    assert.equal(await readGlassPreference(file), 0.5);
  }
});

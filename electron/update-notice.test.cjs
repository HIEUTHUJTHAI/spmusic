const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { readIgnoredVersion, saveIgnoredVersion, shouldShowNotice } = require('./update-notice.cjs');

test('dismissal persists for one version while later releases still appear', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'spmusic-update-notice-'));
  try {
    const file = path.join(dir, 'preferences.json');
    assert.equal(await readIgnoredVersion(file), null);
    await saveIgnoredVersion(file, '2.0.0-beta.2');
    assert.equal(await readIgnoredVersion(file), '2.0.0-beta.2');
    const current = { status: 'available', version: '2.0.0-beta.2' };
    assert.equal(shouldShowNotice(current, '2.0.0-beta.2', null), false);
    assert.equal(shouldShowNotice(current, null, '2.0.0-beta.2'), false);
    assert.equal(shouldShowNotice({ status: 'available', version: '2.0.0-beta.3' },
      '2.0.0-beta.2', null), true);
    assert.equal(shouldShowNotice({ status: 'latest', version: '2.0.0-beta.3' },
      null, null), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { listOlderVersions, prepareOlderVersion } = require('./rollback.cjs');

const api = 'https://api.github.com/repos/HIEUTHUJTHAI/spmusic';
const asset = 'https://github.com/HIEUTHUJTHAI/spmusic/releases/download/v1.0.4/';
const filename = 'SPMusic-1.0.4-x64.exe';
const bytes = Buffer.from('test installer content');
const checksum = createHash('sha512').update(bytes).digest('base64');
const release = {
  tag_name: 'v1.0.4', draft: false, prerelease: false,
  assets: [
    { name: filename, size: bytes.length, browser_download_url: asset + filename },
    { name: 'latest.yml', browser_download_url: asset + 'latest.yml' },
  ],
};
const metadata = `version: 1.0.4\npath: ${filename}\nsha512: ${checksum}\n`;

test('lists only installable stable releases below the running version', async () => {
  const fetcher = async () => Response.json([
    { ...release, tag_name: 'v1.5.0' },
    { ...release, tag_name: 'v1.0.3', prerelease: true },
    { ...release, tag_name: 'v1.0.2', assets: [] },
    release,
  ]);
  assert.deepEqual(await listOlderVersions('1.5.0', fetcher), [{ version: '1.0.4' }]);
});

test('verifies checksum before making an older installer available', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'spmusic-rollback-test-'));
  const fetcher = async (url) => {
    if (url === api + '/releases/tags/v1.0.4') return Response.json(release);
    if (url === asset + 'latest.yml') return new Response(metadata);
    if (url === asset + filename)
      return new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
    throw new Error('Unexpected URL');
  };
  try {
    const installer = await prepareOlderVersion('1.0.4', '1.5.0', directory, fetcher);
    assert.equal((await fs.readFile(installer)).toString(), bytes.toString());
    await assert.rejects(prepareOlderVersion('1.5.0', '1.5.0', directory, fetcher),
      /không hợp lệ/);
  } finally {
    assert.equal(path.dirname(directory), os.tmpdir());
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('rejects a download when the published checksum does not match', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'spmusic-rollback-test-'));
  const fetcher = async (url) => {
    if (url === api + '/releases/tags/v1.0.4') return Response.json(release);
    if (url === asset + 'latest.yml') return new Response(metadata);
    if (url === asset + filename)
      return new Response(Buffer.from('corrupted installer'),
        { headers: { 'content-length': String(bytes.length) } });
    throw new Error('Unexpected URL');
  };
  try {
    await assert.rejects(prepareOlderVersion('1.0.4', '1.5.0', directory, fetcher),
      /không khớp/);
    assert.equal((await fs.readdir(directory)).length, 0);
  } finally {
    assert.equal(path.dirname(directory), os.tmpdir());
    await fs.rm(directory, { recursive: true, force: true });
  }
});

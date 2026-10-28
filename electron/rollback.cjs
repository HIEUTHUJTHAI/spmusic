const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const repo = 'HIEUTHUJTHAI/spmusic';
const maxBytes = 600 * 1024 * 1024;
const versionPattern = /^\d+\.\d+\.\d+$/;

function compareVersions(left, right) {
  const a = left.split('.').map(Number);
  const b = right.split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function installerName(version) {
  return `SPMusic-${version}-x64.exe`;
}

function selectRelease(release, currentVersion) {
  const version = release.tag_name?.replace(/^v/, '');
  if (!versionPattern.test(version) || compareVersions(version, currentVersion) >= 0 ||
    release.draft || release.prerelease) return null;
  const installer = release.assets?.find((asset) => asset.name === installerName(version));
  const metadata = release.assets?.find((asset) => asset.name === 'latest.yml');
  if (!installer || !metadata || installer.size <= 0 || installer.size > maxBytes) return null;
  return { version, installer, metadata };
}

async function checkedFetch(fetcher, url) {
  const response = await fetcher(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error('Không kết nối được GitHub Releases.');
  return response;
}

async function listOlderVersions(currentVersion, fetcher) {
  const response = await checkedFetch(fetcher,
    `https://api.github.com/repos/${repo}/releases?per_page=50`);
  const releases = await response.json();
  if (!Array.isArray(releases)) throw new Error('Danh sách phiên bản không hợp lệ.');
  return releases.map((release) => selectRelease(release, currentVersion))
    .filter(Boolean)
    .sort((a, b) => compareVersions(b.version, a.version))
    .map(({ version }) => ({ version }));
}

function checksumFromMetadata(text, version) {
  const filename = installerName(version);
  const pathLine = text.match(/^path:\s*(\S+)\s*$/m);
  const checksum = text.match(/^sha512:\s*([A-Za-z0-9+/=]+)\s*$/m);
  if (!pathLine || pathLine[1] !== filename || !checksum ||
    Buffer.from(checksum[1], 'base64').length !== 64)
    throw new Error('Không xác minh được bộ cài phiên bản cũ.');
  return checksum[1];
}

async function hashFile(file) {
  const hash = createHash('sha512');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('base64');
}

async function prepareOlderVersion(version, currentVersion, dataDir, fetcher, onProgress = () => {}) {
  if (!versionPattern.test(version) || compareVersions(version, currentVersion) >= 0)
    throw new Error('Phiên bản được chọn không hợp lệ.');
  const response = await checkedFetch(fetcher,
    `https://api.github.com/repos/${repo}/releases/tags/v${version}`);
  const release = selectRelease(await response.json(), currentVersion);
  if (!release || release.version !== version) throw new Error('Không tìm thấy bộ cài phiên bản này.');
  const metadataResponse = await checkedFetch(fetcher, release.metadata.browser_download_url);
  const expectedHash = checksumFromMetadata(await metadataResponse.text(), version);
  await fsp.mkdir(dataDir, { recursive: true });
  const destination = path.join(dataDir, installerName(version));
  try {
    if (await hashFile(destination) === expectedHash) return destination;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const installerResponse = await checkedFetch(fetcher, release.installer.browser_download_url);
  const length = Number(installerResponse.headers.get('content-length'));
  if (!installerResponse.body || (Number.isFinite(length) && length > maxBytes))
    throw new Error('Bộ cài vượt giới hạn tải xuống.');
  const partial = path.join(dataDir, `.${installerName(version)}.${randomUUID()}.partial`);
  let received = 0;
  const hash = createHash('sha512');
  const meter = new Transform({
    transform(chunk, _encoding, done) {
      received += chunk.length;
      if (received > maxBytes) return done(new Error('Bộ cài vượt giới hạn tải xuống.'));
      hash.update(chunk);
      if (length > 0) onProgress(Math.min(99, Math.round(received / length * 100)));
      done(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(installerResponse.body), meter,
      fs.createWriteStream(partial, { flags: 'wx' }));
    if (received !== release.installer.size || hash.digest('base64') !== expectedHash)
      throw new Error('Bộ cài tải về không khớp mã kiểm tra.');
    await fsp.rm(destination, { force: true });
    await fsp.rename(partial, destination);
    onProgress(100);
    return destination;
  } finally {
    await fsp.rm(partial, { force: true });
  }
}

module.exports = { compareVersions, listOlderVersions, prepareOlderVersion, checksumFromMetadata };

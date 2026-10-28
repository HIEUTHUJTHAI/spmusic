const fs = require('node:fs/promises');
const path = require('node:path');

async function readIgnoredVersion(file) {
  try {
    const data = JSON.parse(await fs.readFile(file, 'utf8'));
    return typeof data.ignoredVersion === 'string' ? data.ignoredVersion : null;
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function saveIgnoredVersion(file, version) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ ignoredVersion: version }), 'utf8');
}

function shouldShowNotice(update, ignoredVersion, delayedVersion) {
  return Boolean(update.version &&
    ['available', 'downloading', 'downloaded', 'error'].includes(update.status) &&
    update.version !== ignoredVersion && update.version !== delayedVersion);
}

module.exports = { readIgnoredVersion, saveIgnoredVersion, shouldShowNotice };

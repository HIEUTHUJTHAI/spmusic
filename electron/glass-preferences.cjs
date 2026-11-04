const fs = require('node:fs/promises');
const path = require('node:path');
function validOpacity(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.15 && value <= 0.95;
}
async function readGlassPreference(file) {
  try {
    const { opacity } = JSON.parse(await fs.readFile(file, 'utf8'));
    return validOpacity(opacity) ? opacity : null;
  } catch { return null; }
}
async function writeGlassPreference(file, opacity) {
  if (!validOpacity(opacity)) throw new Error('Mức kính không hợp lệ.');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(`${file}.tmp`, JSON.stringify({ opacity }), 'utf8');
  await fs.rename(`${file}.tmp`, file);
}
module.exports = { readGlassPreference, writeGlassPreference, validOpacity };

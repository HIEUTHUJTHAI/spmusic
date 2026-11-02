const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { shell } = require('electron');

const extensions = new Set(['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.oga', '.opus']);
const inbox = path.join(appDocuments(), 'SPMusic Inbox');
function appDocuments() { return path.join(os.homedir(), 'Documents'); }
const entries = new Map();
let timer;

function startInbox(send) {
  fs.mkdirSync(inbox, { recursive: true });
  async function scan() {
    let names;
    try { names = await fs.promises.readdir(inbox); } catch { return; }
    for (const name of names) {
      if (!extensions.has(path.extname(name).toLowerCase())) continue;
      const file = path.join(inbox, name);
      try {
        const stat = await fs.promises.lstat(file);
        if (!stat.isFile() || stat.size < 1 || stat.size > 250 * 1024 * 1024) continue;
        const key = `${stat.size}:${stat.mtimeMs}`;
        const previous = entries.get(name);
        if (!previous || previous.key !== key) entries.set(name, { key, stable: 0, announced: false });
        else if (!previous.announced && ++previous.stable >= 2) {
          previous.announced = true;
          send({ name, size: stat.size });
        }
      } catch { /* File may still be copying. */ }
    }
    for (const name of entries.keys()) if (!names.includes(name)) entries.delete(name);
  }
  timer = setInterval(scan, 1500);
  scan();
  return () => clearInterval(timer);
}

async function readInboxChunk(name, offset) {
  if (typeof name !== 'string' || path.basename(name) !== name || !extensions.has(path.extname(name).toLowerCase()) ||
      !Number.isSafeInteger(offset) || offset < 0) throw new Error('File không hợp lệ.');
  const file = path.join(inbox, name);
  const stat = await fs.promises.lstat(file);
  if (!stat.isFile() || stat.size > 250 * 1024 * 1024 || offset > stat.size) throw new Error('File quá lớn hoặc không hợp lệ.');
  const length = Math.min(2 * 1024 * 1024, stat.size - offset);
  const handle = await fs.promises.open(file, 'r');
  try {
    const data = Buffer.alloc(length);
    const { bytesRead } = await handle.read(data, 0, length, offset);
    return { data: data.subarray(0, bytesRead).toString('base64'), size: stat.size };
  } finally { await handle.close(); }
}

module.exports = { inbox, startInbox, readInboxChunk, openInbox: () => shell.openPath(inbox) };

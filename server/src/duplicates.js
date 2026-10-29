import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { ApiError } from './validation.js';

export async function audioHash(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function rejectDuplicate(db, uploadsDir, ownerId, title, hash, excludeId = null) {
  const { rows } = await db.query('SELECT id,title,audio_file,audio_hash FROM tracks WHERE owner_id=$1', [ownerId]);
  const normalized = title.trim().normalize('NFC').toLocaleLowerCase('vi');
  if (rows.some((row) => row.id !== excludeId && row.title.trim().normalize('NFC').toLocaleLowerCase('vi') === normalized))
    throw new ApiError(409, `Bài “${title}” đã có trong thư viện. Hãy đổi tên hoặc sửa bài hiện có.`);
  if (!hash) return;
  for (const row of rows) {
    if (row.id === excludeId) continue;
    if (row.audio_hash === hash) throw new ApiError(409, 'File nhạc này đã có trong thư viện.');
    if (row.audio_hash) continue;
    try {
      if (await audioHash(path.join(uploadsDir, 'audio', row.audio_file)) === hash)
        throw new ApiError(409, 'File nhạc này đã có trong thư viện.');
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError, validateCover } from './validation.js';

export const safeUser = (row) =>
  row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_file
          ? `/api/account/avatar?v=${encodeURIComponent(row.avatar_file)}`
          : null,
        theme: row.theme || 'pink',
      }
    : null;

export function accountRoutes(
  app,
  { db, uploadsDir, requireAuth, authRate, hashPassword, verifyPassword, digest },
) {
  const directory = path.join(uploadsDir, 'avatars');
  const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
      fields: 0,
      parts: 1,
    },
  }).single('avatar');
  const removeFile = (name) =>
    name ? fs.unlink(path.join(directory, name)).catch(() => {}) : Promise.resolve();

  app.get('/api/account/avatar', requireAuth, (req, res) => {
    if (!req.user.avatar_file) throw new ApiError(404, 'Bạn chưa có ảnh đại diện.');
    res.sendFile(path.join(directory, req.user.avatar_file));
  });
  async function replaceAvatar(userId, file) {
    // Lock before replacing so concurrent requests clean up the actual previous file.
    const { rows } = await db.query(
      `WITH previous AS (
      SELECT id, avatar_file FROM users WHERE id=$1 FOR UPDATE
    ) UPDATE users u SET avatar_file=$2 FROM previous p WHERE u.id=p.id
      RETURNING u.*, p.avatar_file AS old_avatar`,
      [userId, file],
    );
    await removeFile(rows[0].old_avatar);
    return safeUser(rows[0]);
  }
  app.put('/api/account/avatar', requireAuth, authRate, uploadAvatar, async (req, res) => {
    if (!req.file) throw new ApiError(400, 'Hãy chọn ảnh đại diện JPG, PNG hoặc WebP.');
    let ext;
    try {
      ext = validateCover(req.file);
    } catch (error) {
      throw new ApiError(400, error.message.replaceAll('Ảnh bìa', 'Ảnh đại diện'));
    }
    const filename = randomUUID() + ext;
    await fs.writeFile(path.join(directory, filename), req.file.buffer, { flag: 'wx' });
    let user;
    try {
      user = await replaceAvatar(req.user.id, filename);
    } catch (error) {
      await removeFile(filename);
      throw error;
    }
    res.json({ user });
  });
  app.delete('/api/account/avatar', requireAuth, async (req, res) => {
    res.json({ user: await replaceAvatar(req.user.id, null) });
  });
  app.patch('/api/account/preferences', requireAuth, async (req, res) => {
    if (!['pink', 'lavender', 'mint', 'dark'].includes(req.body.theme))
      throw new ApiError(400, 'Màu giao diện không hợp lệ.');
    const { rows } = await db.query('UPDATE users SET theme=$1 WHERE id=$2 RETURNING *', [
      req.body.theme,
      req.user.id,
    ]);
    res.json({ user: safeUser(rows[0]) });
  });
  app.put('/api/account/password', requireAuth, authRate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || currentPassword.length > 128 || !currentPassword)
      throw new ApiError(400, 'Hãy nhập mật khẩu hiện tại.');
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128)
      throw new ApiError(400, 'Mật khẩu mới cần có 8–128 ký tự.');
    if (currentPassword === newPassword)
      throw new ApiError(400, 'Mật khẩu mới phải khác mật khẩu hiện tại.');
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const previous = rows[0].password_hash;
    if (!(await verifyPassword(currentPassword, previous)))
      throw new ApiError(400, 'Mật khẩu hiện tại chưa đúng.');
    // Change password and revoke other sessions atomically; keep this browser signed in.
    const changed = await db.query(
      `WITH changed AS (
      UPDATE users SET password_hash=$1 WHERE id=$2 AND password_hash=$3 RETURNING id
    ), revoked AS (
      DELETE FROM sessions WHERE user_id IN (SELECT id FROM changed) AND token_hash<>$4
    ) SELECT id FROM changed`,
      [await hashPassword(newPassword), req.user.id, previous, digest(req.cookies.auralis_session)],
    );
    if (!changed.rows.length) throw new ApiError(409, 'Mật khẩu vừa thay đổi. Vui lòng thử lại.');
    res.json({ ok: true });
  });
}

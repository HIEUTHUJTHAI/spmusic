import express from 'express';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, text, validateCover, validateLrc } from './validation.js';
import { MAX_AUDIO_BYTES, prepareAudio } from './audio.js';
import { createLyricsAI } from './lyrics-ai.js';
import { plainLyrics } from './lyrics-alignment.js';
import { accountRoutes, safeUser } from './account.js';
import { createOpenMusic, openMusicRoutes } from './open-music.js';
import { createYoutubeImporter, youtubeRoutes } from './youtube.js';

const scrypt = promisify(scryptCallback);
const here = path.dirname(fileURLToPath(import.meta.url));
const defaultPublic = path.resolve(here, '../../client/public');
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const trackView = (row) => ({
  id: row.id,
  title: row.title,
  artist: row.artist,
  album: row.album,
  genre: row.genre,
  duration: Number(row.duration),
  ownerId: row.owner_id,
  isDemo: false,
  audioUrl: `/api/media/${row.id}/audio`,
  coverUrl: row.cover_file
    ? `/api/media/${row.id}/cover?v=${encodeURIComponent(row.cover_file)}`
    : '/covers/fallback.svg',
  hasLyrics: Boolean(row.lyrics_file),
  audioFormat: row.audio_format || '',
  sampleRate: row.sample_rate || null,
  bitDepth: row.bit_depth || null,
  isLossless: ['FLAC', 'ALAC', 'WAV'].includes(row.audio_format),
  sourceInfo: row.source_info || null,
});
const playlistView = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  trackIds: row.track_ids,
  coverUrl: row.cover_file
    ? `/api/playlists/${row.id}/cover?v=${encodeURIComponent(row.cover_file)}`
    : null,
  createdAt: row.created_at,
});

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}

export async function createApp({
  db,
  dataDir,
  publicDir = defaultPublic,
  demos,
  cookieSecure = process.env.COOKIE_SECURE === 'true',
  lyricsAI,
  openMusicOptions,
  youtubeOptions,
} = {}) {
  if (!db || !dataDir) throw new Error('Database and dataDir are required.');
  const app = express();
  app.disable('x-powered-by');
  const uploadsDir = path.join(dataDir, 'uploads');
  const ai = lyricsAI || createLyricsAI({ dataDir });
  app.locals.lyricsAI = ai;
  for (const folder of ['audio', 'covers', 'playlist-covers', 'lyrics', 'playback', 'temp', 'avatars'])
    await fs.mkdir(path.join(uploadsDir, folder), { recursive: true });
  const demoTracks = demos ?? [];
  const demosById = new Map(
    demoTracks.map((track) => [track.id, { ...track, isDemo: true, ownerId: null }]),
  );
  const allowedOrigins = new Set(
    (
      process.env.CLIENT_ORIGIN ||
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3001,http://127.0.0.1:3001'
    )
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  );
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    const origin = req.headers.origin;
    const originAllowed =
      origin && (allowedOrigins.has(origin) || origin === `${req.protocol}://${req.get('host')}`);
    if (originAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    }
    if (!['GET', 'HEAD'].includes(req.method) && origin && !originAllowed)
      return next(new ApiError(403, 'Nguồn yêu cầu không được cho phép.'));
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '300kb' }));
  app.use((req, res, next) => {
    req.body ??= {};
    next();
  });
  app.use(cookieParser());
  const rateBuckets = new Map();
  const authRate = (req, res, next) => {
    const now = Date.now(),
      key = req.ip;
    if (rateBuckets.size > 2000)
      for (const [ip, b] of rateBuckets) if (b.until < now) rateBuckets.delete(ip);
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.until < now)
      rateBuckets.set(key, { count: 1, until: now + 10 * 60 * 1000 });
    else if (++bucket.count > 30)
      return next(new ApiError(429, 'Quá nhiều lần đăng nhập. Vui lòng thử lại sau 10 phút.'));
    next();
  };
  app.use('/api', async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.cookies.auralis_session;
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
      const { rows } = await db.query(
        'SELECT u.id,u.name,u.email,u.avatar_file,u.theme,u.custom_theme FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>CURRENT_TIMESTAMP',
        [digest(token)],
      );
      req.user = rows[0] || null;
    }
    next();
  });
  const requireAuth = (req, res, next) =>
    req.user ? next() : next(new ApiError(401, 'Vui lòng đăng nhập để tiếp tục.'));
  const sessionCookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure,
    path: '/',
    maxAge: SESSION_MS,
  };
  async function newSession(req, res, user) {
    if (req.cookies.auralis_session)
      await db.query('DELETE FROM sessions WHERE token_hash=$1', [
        digest(req.cookies.auralis_session),
      ]);
    const token = randomBytes(32).toString('hex');
    await db.query('DELETE FROM sessions WHERE expires_at<CURRENT_TIMESTAMP');
    await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [
      digest(token),
      user.id,
      new Date(Date.now() + SESSION_MS),
    ]);
    res.cookie('auralis_session', token, sessionCookie);
  }
  const credentials = (body) => {
    const email = text(body.email, 'Email', 254, true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ApiError(400, 'Địa chỉ email không hợp lệ.');
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128)
      throw new ApiError(400, 'Mật khẩu cần có 8–128 ký tự.');
    return { email, password: body.password };
  };
  app.get('/api/health', (req, res) => res.json({ status: 'ok', database: db.engine }));
  app.get('/api/auth/me', (req, res) => res.json({ user: safeUser(req.user) }));
  app.post('/api/auth/register', authRate, async (req, res) => {
    const { email, password } = credentials(req.body);
    const name = text(req.body.name, 'Tên hiển thị', 80, true);
    const user = { id: randomUUID(), name, email };
    try {
      await db.query('INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)', [
        user.id,
        name,
        email,
        await hashPassword(password),
      ]);
    } catch (error) {
      if (error.code === '23505') throw new ApiError(409, 'Email này đã được đăng ký.');
      throw error;
    }
    await newSession(req, res, user);
    res.status(201).json({ user: safeUser(user) });
  });
  app.post('/api/auth/login', authRate, async (req, res) => {
    const { email, password } = credentials(req.body);
    const { rows } = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows[0]) {
      await scrypt(password, 'auralis-dummy-auth-salt', 64);
      throw new ApiError(401, 'Email hoặc mật khẩu chưa đúng.');
    }
    if (!(await verifyPassword(password, rows[0].password_hash)))
      throw new ApiError(401, 'Email hoặc mật khẩu chưa đúng.');
    await newSession(req, res, rows[0]);
    res.json({ user: safeUser(rows[0]) });
  });
  app.post('/api/auth/logout', async (req, res) => {
    if (req.cookies.auralis_session)
      await db.query('DELETE FROM sessions WHERE token_hash=$1', [
        digest(req.cookies.auralis_session),
      ]);
    res.clearCookie('auralis_session', { ...sessionCookie, maxAge: undefined });
    res.json({ ok: true });
  });
  accountRoutes(app, {
    db,
    uploadsDir,
    requireAuth,
    authRate,
    hashPassword,
    verifyPassword,
    digest,
  });
  const openMusic = createOpenMusic({ db, uploadsDir, trackView, ...openMusicOptions });
  app.locals.openMusic = openMusic;
  openMusicRoutes(app, { service: openMusic, requireAuth });
  const youtube = createYoutubeImporter({ db, uploadsDir, trackView, ...youtubeOptions });
  app.locals.youtube = youtube;
  youtubeRoutes(app, { service: youtube, requireAuth });
  const multipart = multer({
    storage: multer.diskStorage({
      destination: (req, file, done) => done(null, req.uploadDir),
      filename: (req, file, done) => done(null, randomUUID()),
    }),
    limits: { fileSize: MAX_AUDIO_BYTES, files: 3, fields: 8, parts: 12, fieldSize: 256 * 1024 },
  });
  const trackUpload = multipart.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'lyrics', maxCount: 1 },
  ]);
  const lyricsUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 256 * 1024, files: 1, fields: 1, parts: 2 },
  }).single('lyrics');
  const coverUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  }).single('cover');
  async function ownTrack(req) {
    const { rows } = await db.query('SELECT * FROM tracks WHERE id=$1 AND owner_id=$2', [
      req.params.id,
      req.user.id,
    ]);
    if (!rows[0]) throw new ApiError(404, 'Không tìm thấy bài hát của bạn.');
    return rows[0];
  }
  async function readableTrack(req) {
    if (demosById.has(req.params.id)) return demosById.get(req.params.id);
    if (!req.user) throw new ApiError(401, 'Vui lòng đăng nhập để nghe nhạc riêng.');
    return ownTrack(req);
  }
  const unlink = (file) => (file ? fs.unlink(file).catch(() => {}) : Promise.resolve());
  async function replaceCover(table, folder, id, ownerId, file) {
    const ext = validateCover(file);
    const filename = ext ? `${randomUUID()}${ext}` : null;
    const directory = path.join(uploadsDir, folder);
    if (filename) await fs.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' });
    let row;
    try {
      const { rows } = await db.query(
        `WITH previous AS (
          SELECT id,cover_file FROM ${table} WHERE id=$2 AND owner_id=$3 FOR UPDATE
        ) UPDATE ${table} item SET cover_file=$1 FROM previous p WHERE item.id=p.id
          RETURNING item.*,p.cover_file AS old_cover`,
        [filename, id, ownerId],
      );
      row = rows[0];
      if (!row) throw new ApiError(404, 'Không tìm thấy mục trong thư viện của bạn.');
    } catch (error) {
      if (filename) await unlink(path.join(directory, filename));
      throw error;
    }
    if (row.old_cover) await unlink(path.join(directory, row.old_cover));
    return row;
  }
  function sendAIJob(req, res, job) {
    if (res.destroyed) {
      ai.cancel(job.id, req.user.id);
      return;
    }
    res.once('close', () => {
      if (!res.writableFinished) ai.cancel(job.id, req.user.id);
    });
    res.status(202).json({ job });
  }
  app.get('/api/lyrics/align/:id', requireAuth, (req, res) => {
    res.json({ job: ai.status(req.params.id, req.user.id) });
  });
  app.delete('/api/lyrics/align/:id', requireAuth, (req, res) => {
    res.json({ job: ai.cancel(req.params.id, req.user.id) });
  });
  app.post('/api/tracks/:id/lyrics/align', requireAuth, async (req, res) => {
    const track = await ownTrack(req);
    if (Number(track.duration) > 900)
      throw new ApiError(400, 'AI hiện hỗ trợ bài hát tối đa 15 phút.');
    plainLyrics(req.body.content);
    const workingDir = await fs.mkdtemp(path.join(uploadsDir, 'temp', 'ai-'));
    try {
      const job = await ai.start({
        ownerId: req.user.id,
        content: req.body.content,
        language: req.body.language,
        audioPath: path.join(uploadsDir, 'audio', track.audio_file),
        workingDir,
      });
      sendAIJob(req, res, job);
    } catch (error) {
      await fs.rm(workingDir, { recursive: true, force: true });
      throw error;
    }
  });
  const aiUpload = multipart.single('audio');
  app.post('/api/lyrics/align', requireAuth, async (req, res) => {
    if (activeUploads >= 2) throw new ApiError(429, 'Đang nhận file nhạc. Vui lòng thử lại sau.');
    activeUploads++;
    let handedOff = false;
    try {
      req.uploadDir = await fs.mkdtemp(path.join(uploadsDir, 'temp', 'ai-upload-'));
      await new Promise((resolve, reject) =>
        aiUpload(req, res, (error) => (error ? reject(error) : resolve())),
      );
      plainLyrics(req.body.content);
      const audioInfo = await prepareAudio(req.file, req.uploadDir);
      if (audioInfo.duration > 900)
        throw new ApiError(400, 'AI hiện hỗ trợ bài hát tối đa 15 phút.');
      const job = await ai.start({
        ownerId: req.user.id,
        content: req.body.content,
        language: req.body.language,
        audioPath: req.file.path,
        workingDir: req.uploadDir,
      });
      handedOff = true;
      sendAIJob(req, res, job);
    } finally {
      activeUploads--;
      if (req.uploadDir && !handedOff)
        await fs.rm(req.uploadDir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
  app.get('/api/tracks', async (req, res) => {
    const mine = req.user
      ? (
          await db.query('SELECT * FROM tracks WHERE owner_id=$1 ORDER BY created_at DESC', [
            req.user.id,
          ])
        ).rows.map(trackView)
      : [];
    const tracks = [...demosById.values(), ...mine];
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLocaleLowerCase('vi') : '';
    res.json({
      tracks: query
        ? tracks.filter((t) =>
            `${t.title} ${t.artist} ${t.album}`.toLocaleLowerCase('vi').includes(query),
          )
        : tracks,
    });
  });
  let activeUploads = 0;
  app.post('/api/tracks', requireAuth, async (req, res) => {
    if (activeUploads >= 2)
      throw new ApiError(429, 'Đang xử lý hai lượt tải nhạc. Vui lòng thử lại sau.');
    activeUploads++;
    try {
      req.uploadDir = await fs.mkdtemp(path.join(uploadsDir, 'temp', 'upload-'));
      await new Promise((resolve, reject) =>
        trackUpload(req, res, (error) => (error ? reject(error) : resolve())),
      );
      await saveUploadedTrack(req, res);
    } finally {
      activeUploads--;
      if (req.uploadDir)
        await fs.rm(req.uploadDir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
  async function saveUploadedTrack(req, res) {
    const audio = req.files?.audio?.[0],
      cover = req.files?.cover?.[0],
      lyrics = req.files?.lyrics?.[0];
    const title = text(req.body.title, 'Tên bài hát', 160, true),
      artist = text(req.body.artist, 'Nghệ sĩ', 120, true);
    const album = text(req.body.album, 'Album', 160),
      genre = text(req.body.genre, 'Thể loại', 80);
    // Small auxiliary files are read only after their individual size checks.
    if (cover) {
      if (cover.size > 5 * 1024 * 1024) throw new ApiError(400, 'Ảnh bìa tối đa 5 MB.');
      cover.buffer = await fs.readFile(cover.path);
    }
    if (lyrics) {
      if (lyrics.size > 256 * 1024) throw new ApiError(400, 'File LRC tối đa 256 KB.');
      lyrics.buffer = await fs.readFile(lyrics.path);
    }
    const coverExt = validateCover(cover);
    if (lyrics && path.extname(lyrics.originalname).toLowerCase() !== '.lrc')
      throw new ApiError(400, 'Lyrics phải là file .lrc.');
    const lrc = lyrics ? validateLrc(lyrics.buffer) : null;
    const audioInfo = await prepareAudio(audio, req.uploadDir);
    const id = randomUUID(),
      audioFile = `${id}${audioInfo.ext}`,
      playbackFile = audioInfo.playbackPath ? `${id}.flac` : null,
      coverFile = coverExt ? `${id}${coverExt}` : null,
      lyricsFile = lrc ? `${id}.lrc` : null;
    const createdFiles = [];
    try {
      const save = async (folder, name, data) => {
        const dest = path.join(uploadsDir, folder, name);
        await fs.writeFile(dest, data, { flag: 'wx' });
        createdFiles.push(dest);
      };
      const move = async (source, folder, name) => {
        const dest = path.join(uploadsDir, folder, name);
        await fs.rename(source, dest);
        createdFiles.push(dest);
      };
      await move(audio.path, 'audio', audioFile);
      if (playbackFile) await move(audioInfo.playbackPath, 'playback', playbackFile);
      if (coverFile) await save('covers', coverFile, cover.buffer);
      if (lyricsFile) await save('lyrics', lyricsFile, lrc);
      const { rows } = await db.query(
        'INSERT INTO tracks(id,owner_id,title,artist,album,genre,duration,audio_file,cover_file,lyrics_file,playback_file,audio_format,sample_rate,bit_depth) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
        [
          id,
          req.user.id,
          title,
          artist,
          album,
          genre,
          audioInfo.duration,
          audioFile,
          coverFile,
          lyricsFile,
          playbackFile,
          audioInfo.format,
          audioInfo.sampleRate,
          audioInfo.bitDepth,
        ],
      );
      res.status(201).json({ track: trackView(rows[0]) });
    } catch (error) {
      await Promise.all(createdFiles.map(unlink));
      throw error;
    }
  }
  app.patch('/api/tracks/:id', requireAuth, async (req, res) => {
    const current = await ownTrack(req);
    const title =
      req.body.title === undefined ? current.title : text(req.body.title, 'Tên bài hát', 160, true);
    const artist =
      req.body.artist === undefined ? current.artist : text(req.body.artist, 'Nghệ sĩ', 120, true);
    const album = req.body.album === undefined ? current.album : text(req.body.album, 'Album', 160);
    const genre =
      req.body.genre === undefined ? current.genre : text(req.body.genre, 'Thể loại', 80);
    const { rows } = await db.query(
      'UPDATE tracks SET title=$1,artist=$2,album=$3,genre=$4 WHERE id=$5 AND owner_id=$6 RETURNING *',
      [title, artist, album, genre, current.id, req.user.id],
    );
    res.json({ track: trackView(rows[0]) });
  });
  app.put('/api/tracks/:id/cover', requireAuth, async (req, res, next) => {
    await ownTrack(req);
    next();
  }, coverUpload, async (req, res) => {
    if (!req.file) throw new ApiError(400, 'Hãy chọn ảnh bìa JPG, PNG hoặc WebP.');
    const row = await replaceCover('tracks', 'covers', req.params.id, req.user.id, req.file);
    res.json({ track: trackView(row) });
  });
  app.delete('/api/tracks/:id/cover', requireAuth, async (req, res) => {
    const row = await replaceCover('tracks', 'covers', req.params.id, req.user.id, null);
    res.json({ track: trackView(row) });
  });
  app.delete('/api/tracks/:id', requireAuth, async (req, res) => {
    const current = await ownTrack(req);
    await db.query('UPDATE playlists SET track_ids=array_remove(track_ids,$1) WHERE owner_id=$2', [
      current.id,
      req.user.id,
    ]);
    await db.query('DELETE FROM listening_history WHERE track_id=$1 AND owner_id=$2', [
      current.id,
      req.user.id,
    ]);
    await db.query('DELETE FROM tracks WHERE id=$1 AND owner_id=$2', [current.id, req.user.id]);
    await Promise.all([
      unlink(path.join(uploadsDir, 'audio', current.audio_file)),
      current.playback_file && unlink(path.join(uploadsDir, 'playback', current.playback_file)),
      current.cover_file && unlink(path.join(uploadsDir, 'covers', current.cover_file)),
      current.lyrics_file && unlink(path.join(uploadsDir, 'lyrics', current.lyrics_file)),
    ]);
    res.json({ ok: true });
  });
  app.get('/api/tracks/:id/lyrics', async (req, res) => {
    const track = await readableTrack(req);
    if (track.isDemo) {
      if (!track.hasLyrics) return res.json({ content: '' });
      try {
        return res.json({
          content: await fs.readFile(path.join(publicDir, 'demo', `${track.id}.lrc`), 'utf8'),
        });
      } catch (error) {
        if (error.code === 'ENOENT') return res.json({ content: '' });
        throw error;
      }
    }
    res.json({
      content: track.lyrics_file
        ? await fs.readFile(path.join(uploadsDir, 'lyrics', track.lyrics_file), 'utf8')
        : '',
    });
  });
  app.put(
    '/api/tracks/:id/lyrics',
    requireAuth,
    async (req, res, next) => {
      await ownTrack(req);
      next();
    },
    (req, res, next) => (req.is('multipart/form-data') ? lyricsUpload(req, res, next) : next()),
    async (req, res) => {
      const track = await ownTrack(req);
      if (req.file && path.extname(req.file.originalname).toLowerCase() !== '.lrc')
        throw new ApiError(400, 'Lyrics phải là file .lrc.');
      if (!req.file && typeof req.body?.content !== 'string')
        throw new ApiError(400, 'Hãy chọn file LRC hoặc nhập nội dung lời hát.');
      const content = validateLrc(req.file?.buffer ?? Buffer.from(req.body.content, 'utf8'));
      const filename = `${track.id}-${randomUUID()}.lrc`,
        filepath = path.join(uploadsDir, 'lyrics', filename);
      await fs.writeFile(filepath, content, { flag: 'wx' });
      try {
        await db.query('UPDATE tracks SET lyrics_file=$1 WHERE id=$2 AND owner_id=$3', [
          filename,
          track.id,
          req.user.id,
        ]);
      } catch (error) {
        await unlink(filepath);
        throw error;
      }
      if (track.lyrics_file) await unlink(path.join(uploadsDir, 'lyrics', track.lyrics_file));
      res.json({ content, track: trackView({ ...track, lyrics_file: filename }) });
    },
  );
  app.delete('/api/tracks/:id/lyrics', requireAuth, async (req, res) => {
    const track = await ownTrack(req);
    await db.query('UPDATE tracks SET lyrics_file=NULL WHERE id=$1 AND owner_id=$2', [
      track.id,
      req.user.id,
    ]);
    if (track.lyrics_file) await unlink(path.join(uploadsDir, 'lyrics', track.lyrics_file));
    res.json({ ok: true, track: trackView({ ...track, lyrics_file: null }) });
  });
  app.get('/api/media/:id/:kind', async (req, res) => {
    if (!['audio', 'cover'].includes(req.params.kind))
      throw new ApiError(404, 'Không tìm thấy file.');
    const track = await readableTrack(req);
    if (track.isDemo) {
      const relative = req.params.kind === 'audio' ? track.audioUrl : track.coverUrl;
      const file = path.resolve(publicDir, `.${relative}`);
      if (!file.startsWith(path.resolve(publicDir) + path.sep))
        throw new ApiError(404, 'Không tìm thấy file.');
      return res.sendFile(file);
    }
    const name =
      req.params.kind === 'audio' ? track.playback_file || track.audio_file : track.cover_file;
    if (!name) throw new ApiError(404, 'Bài hát chưa có ảnh bìa.');
    const folder =
      req.params.kind === 'audio' ? (track.playback_file ? 'playback' : 'audio') : 'covers';
    if (req.params.kind === 'audio' && name.endsWith('.flac')) res.type('audio/flac');
    res.sendFile(path.join(uploadsDir, folder, name));
  });
  async function validateTrackIds(ids, userId) {
    if (
      !Array.isArray(ids) ||
      ids.length > 1000 ||
      ids.some((id) => typeof id !== 'string' || id.length > 80)
    )
      throw new ApiError(400, 'Danh sách bài hát không hợp lệ (tối đa 1000 bài).');
    const unique = [...new Set(ids)];
    const ownIds = (await db.query('SELECT id FROM tracks WHERE owner_id=$1', [userId])).rows.map(
      (t) => t.id,
    );
    const allowed = new Set([...demosById.keys(), ...ownIds]);
    if (unique.some((id) => !allowed.has(id)))
      throw new ApiError(400, 'Playlist chứa bài hát không có trong thư viện của bạn.');
    return unique;
  }
  app.get('/api/playlists', requireAuth, async (req, res) =>
    res.json({
      playlists: (
        await db.query('SELECT * FROM playlists WHERE owner_id=$1 ORDER BY created_at DESC', [
          req.user.id,
        ])
      ).rows.map(playlistView),
    }),
  );
  app.get('/api/playlists/:id/cover', requireAuth, async (req, res) => {
    const { rows } = await db.query(
      'SELECT cover_file FROM playlists WHERE id=$1 AND owner_id=$2',
      [req.params.id, req.user.id],
    );
    if (!rows[0]?.cover_file) throw new ApiError(404, 'Playlist chưa có ảnh bìa.');
    res.sendFile(path.join(uploadsDir, 'playlist-covers', rows[0].cover_file));
  });
  app.post('/api/playlists', requireAuth, async (req, res) => {
    const name = text(req.body.name, 'Tên playlist', 100, true),
      description = text(req.body.description, 'Mô tả', 500);
    const ids =
      req.body.trackIds === undefined ? [] : await validateTrackIds(req.body.trackIds, req.user.id);
    const { rows } = await db.query(
      'INSERT INTO playlists(id,owner_id,name,description,track_ids) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [randomUUID(), req.user.id, name, description, ids],
    );
    res.status(201).json({ playlist: playlistView(rows[0]) });
  });
  app.patch('/api/playlists/:id', requireAuth, async (req, res) => {
    const current = (
      await db.query('SELECT * FROM playlists WHERE id=$1 AND owner_id=$2', [
        req.params.id,
        req.user.id,
      ])
    ).rows[0];
    if (!current) throw new ApiError(404, 'Không tìm thấy playlist của bạn.');
    const name =
      req.body.name === undefined ? current.name : text(req.body.name, 'Tên playlist', 100, true);
    const description =
      req.body.description === undefined
        ? current.description
        : text(req.body.description, 'Mô tả', 500);
    const ids =
      req.body.trackIds === undefined
        ? current.track_ids
        : await validateTrackIds(req.body.trackIds, req.user.id);
    const { rows } = await db.query(
      'UPDATE playlists SET name=$1,description=$2,track_ids=$3 WHERE id=$4 AND owner_id=$5 RETURNING *',
      [name, description, ids, current.id, req.user.id],
    );
    res.json({ playlist: playlistView(rows[0]) });
  });
  app.put('/api/playlists/:id/cover', requireAuth, coverUpload, async (req, res) => {
    if (!req.file) throw new ApiError(400, 'Hãy chọn ảnh bìa JPG, PNG hoặc WebP.');
    const row = await replaceCover('playlists', 'playlist-covers', req.params.id, req.user.id, req.file);
    res.json({ playlist: playlistView(row) });
  });
  app.delete('/api/playlists/:id/cover', requireAuth, async (req, res) => {
    const row = await replaceCover('playlists', 'playlist-covers', req.params.id, req.user.id, null);
    res.json({ playlist: playlistView(row) });
  });
  app.delete('/api/playlists/:id', requireAuth, async (req, res) => {
    const { rows } = await db.query(
      'DELETE FROM playlists WHERE id=$1 AND owner_id=$2 RETURNING cover_file',
      [req.params.id, req.user.id],
    );
    if (!rows[0]) throw new ApiError(404, 'Không tìm thấy playlist của bạn.');
    if (rows[0].cover_file)
      await unlink(path.join(uploadsDir, 'playlist-covers', rows[0].cover_file));
    res.json({ ok: true });
  });
  app.get('/api/history', requireAuth, async (req, res) => {
    const { rows } = await db.query(
      'SELECT track_id,played_at FROM listening_history WHERE owner_id=$1 ORDER BY played_at DESC LIMIT 50',
      [req.user.id],
    );
    res.json({ history: rows.map((row) => ({ trackId: row.track_id, playedAt: row.played_at })) });
  });
  app.post('/api/history', requireAuth, async (req, res) => {
    const ids = await validateTrackIds([req.body.trackId], req.user.id);
    await db.query(
      'INSERT INTO listening_history(owner_id,track_id) VALUES($1,$2) ON CONFLICT(owner_id,track_id) DO UPDATE SET played_at=CURRENT_TIMESTAMP',
      [req.user.id, ids[0]],
    );
    res.status(201).json({ ok: true });
  });
  app.use('/api', (req, res, next) => next(new ApiError(404, 'API không tồn tại.')));
  // Development files live in client/public; production can serve the Vite build.
  const clientDist = path.resolve(here, '../../client/dist');
  try {
    await fs.access(path.join(clientDist, 'index.html'));
    app.use(express.static(clientDist));
    app.get(/.*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  } catch {
    /* Vite serves the frontend during development. */
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError)
      return res.status(400).json({
        error:
          error.code === 'LIMIT_FILE_SIZE'
            ? 'File vượt giới hạn: nhạc 250 MB, ảnh 5 MB, LRC 256 KB.'
            : 'Biểu mẫu tải file không hợp lệ hoặc có quá nhiều file.',
      });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ error: 'Nội dung yêu cầu vượt quá dung lượng cho phép.' });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ.' });
    if (error.code === 'ENOENT')
      return res.status(404).json({ error: 'Không tìm thấy file trên máy chủ.' });
    if (!error.status || error.status >= 500) console.error('[SPMusic]', error.message);
    res
      .status(error.status || 500)
      .json({ error: error.status ? error.message : 'Máy chủ gặp lỗi. Vui lòng thử lại.' });
  });
  return app;
}

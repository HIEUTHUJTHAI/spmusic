import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ApiError, text } from './validation.js';
import { youtubeVideoUrl, resolveYoutubeAudio } from './youtube.js';

export function safeStreamUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.googlevideo.com') || url.port || url.username || url.password)
    throw new ApiError(502, 'Nguồn phát YouTube không hợp lệ.');
  return url.href;
}

export function onlineRoutes(app, { db, requireAuth, trackView, resolve = resolveYoutubeAudio, request = fetch }) {
  const cache = new Map();
  async function source(id, signal, refresh = false) {
    const stored = cache.get(id);
    if (!refresh && stored && stored.until > Date.now()) return stored.url;
    const metadata = await resolve(`https://www.youtube.com/watch?v=${id}`, signal);
    const url = safeStreamUrl(metadata.url);
    const expires = Number(new URL(url).searchParams.get('expire')) * 1000;
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(id, { url, duration: Number(metadata.duration) || 0, until: Math.min(Date.now() + 10 * 60000, expires ? expires - 60000 : Infinity) });
    return url;
  }
  app.post('/api/tracks/online', requireAuth, async (req, res) => {
    const video = youtubeVideoUrl(req.body.url);
    const key = JSON.stringify(['youtube', video.id]);
    const previous = await db.query('SELECT * FROM tracks WHERE owner_id=$1 AND source_key=$2', [req.user.id, key]);
    if (previous.rows[0]) return res.json({ track: trackView(previous.rows[0]), existing: true });
    const title = text(req.body.title, 'Tên bài hát', 200, true);
    const artist = text(req.body.artist, 'Nghệ sĩ', 200, true);
    const titles = await db.query('SELECT title FROM tracks WHERE owner_id=$1', [req.user.id]);
    const normalized = value => value.trim().normalize('NFC').toLocaleLowerCase('vi');
    if (titles.rows.some(row => normalized(row.title) === normalized(title)))
      throw new ApiError(409, 'Bài trùng tên đã có trong thư viện. Hãy nghe bản hiện có.');
    const info = { provider: 'youtube', online: true, videoId: video.id, url: video.url };
    const result = await db.query(`INSERT INTO tracks(id,owner_id,title,artist,audio_file,audio_format,source_key,source_info)
      VALUES($1,$2,$3,$4,$5,'ONLINE',$6,$7) ON CONFLICT(owner_id,source_key) WHERE source_key IS NOT NULL
      DO UPDATE SET source_key=excluded.source_key RETURNING *`,
    [randomUUID(), req.user.id, title, artist, `online-${video.id}`, key, JSON.stringify(info)]);
    res.status(201).json({ track: trackView(result.rows[0]) });
  });
  return {
    async stream(req, res, track) {
      const id = track.source_info?.videoId;
      if (!/^[\w-]{11}$/.test(id || '')) throw new ApiError(422, 'Bài online thiếu mã video.');
      const controller = new AbortController();
      const close = () => controller.abort();
      res.once('close', close);
      const timer = setTimeout(close, 100000);
      try {
        const range = req.headers.range;
        if (range && !/^bytes=\d*-\d*$/.test(range)) throw new ApiError(416, 'Khoảng phát không hợp lệ.');
        let response;
        for (let attempt = 0; attempt < 2; attempt++) {
          const url = await source(id, controller.signal, attempt > 0);
          response = await request(url, { headers: range ? { Range: range } : {}, signal: controller.signal, redirect: 'error' });
          if (![401, 403, 410].includes(response.status)) break;
          await response.body?.cancel();
        }
        clearTimeout(timer);
        if (![200, 206].includes(response.status)) throw new ApiError(502, 'Nguồn online không phát được lúc này. Hãy thử lại hoặc mở trên YouTube.');
        if (track.id && cache.get(id)?.duration > 0 && !Number(track.duration))
          await db.query('UPDATE tracks SET duration=$1 WHERE id=$2', [cache.get(id).duration, track.id]);
        res.status(response.status);
        for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
          if (response.headers.get(header)) res.setHeader(header, response.headers.get(header));
        }
        res.setHeader('Cache-Control', 'private, no-store');
        await pipeline(Readable.fromWeb(response.body), res);
      } finally { clearTimeout(timer); res.off('close', close); controller.abort(); }
    },
  };
}

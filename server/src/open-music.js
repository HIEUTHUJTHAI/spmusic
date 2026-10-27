import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ApiError } from './validation.js';
import { MAX_AUDIO_BYTES, prepareAudio } from './audio.js';
import { createOpenSources, providers } from './open-music-sources.js';
import { remoteStream } from './open-music-network.js';

export async function downloadAudio(track, destination, signal, onProgress, stream = remoteStream) {
  const response = await stream(track.downloadUrl, { kind: 'audio', signal });
  const declared = Number(response.headers['content-length']);
  if (declared > MAX_AUDIO_BYTES) {
    response.destroy();
    throw new ApiError(400, 'Bản nhạc vượt quá 250 MB.');
  }
  let received = 0;
  const counter = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      if (received > MAX_AUDIO_BYTES)
        return callback(new ApiError(400, 'Bản nhạc vượt quá 250 MB.'));
      onProgress(received, declared || track.size || 0);
      callback(null, chunk);
    },
  });
  await pipeline(response, counter, createWriteStream(destination, { flags: 'wx' }), { signal });
  if (
    !received ||
    (declared > 0 && received !== declared) ||
    (track.size > 0 && received !== track.size)
  )
    throw new ApiError(502, 'File tải về chưa đầy đủ hoặc vừa thay đổi. Hãy tìm lại bài hát.');
  return received;
}

export function createOpenMusic({
  db,
  uploadsDir,
  trackView,
  sources = createOpenSources(),
  download = downloadAudio,
  prepare = prepareAudio,
}) {
  const jobs = new Map();
  let active = null,
    closing = false;
  const publicJob = (j) => ({
    id: j.id,
    status: j.status,
    message: j.message,
    progress: j.progress,
    received: j.received,
    total: j.total,
    track: j.track || null,
    existing: !!j.existing,
  });
  function owned(id, ownerId) {
    const j = jobs.get(id);
    if (!j || j.ownerId !== ownerId)
      throw new ApiError(404, 'Không tìm thấy lượt tải nhạc của bạn.');
    return j;
  }
  async function run(job, input) {
    let directory,
      created = [];
    const signal = AbortSignal.any([job.controller.signal, AbortSignal.timeout(10 * 60 * 1000)]);
    try {
      const tracks = await sources.tracks(input.source, input.itemId, signal);
      signal.throwIfAborted();
      const selected = tracks.find((t) => t.key === input.key);
      if (!selected)
        throw new ApiError(400, 'Nguồn không còn bản nhạc có giấy phép và định dạng phù hợp.');
      const sourceKey = JSON.stringify([input.source, input.itemId, input.key]);
      const prior = await db.query('SELECT * FROM tracks WHERE owner_id=$1 AND source_key=$2', [
        job.ownerId,
        sourceKey,
      ]);
      if (prior.rows.length) {
        job.track = trackView(prior.rows[0]);
        job.existing = true;
        job.status = 'completed';
        job.progress = 100;
        job.message = 'Bài hát đã có trong thư viện.';
        return;
      }
      signal.throwIfAborted();
      directory = await fs.mkdtemp(path.join(uploadsDir, 'temp', 'internet-'));
      const file = path.join(directory, 'download' + path.extname(selected.file).toLowerCase());
      job.status = 'downloading';
      job.message = `Đang tải ${selected.format} từ ${providers[selected.source]}…`;
      const size = await download(selected, file, signal, (received, total) => {
        job.received = received;
        job.total = total;
        job.progress = total ? Math.min(89, Math.floor((received / total) * 89)) : 0;
      });
      signal.throwIfAborted();
      job.status = 'processing';
      job.progress = 90;
      job.message = 'Đang kiểm tra toàn bộ file âm thanh…';
      const info = await prepare({ path: file, originalname: selected.file, size }, directory);
      signal.throwIfAborted();
      job.status = 'saving';
      job.progress = 97;
      job.message = 'Đang lưu vào thư viện…';
      const id = randomUUID(),
        audioFile = id + info.ext,
        playbackFile = info.playbackPath ? id + '.flac' : null;
      const provenance = {
        provider: selected.source,
        providerName: providers[selected.source],
        itemId: selected.itemId,
        title: selected.title,
        artist: selected.artist,
        credit: selected.credit,
        sourceUrl: selected.sourceUrl,
        license: selected.license,
        file: selected.file,
        format: info.format,
        downloadedAt: new Date().toISOString(),
      };
      await fs.rename(file, path.join(uploadsDir, 'audio', audioFile));
      created.push(path.join(uploadsDir, 'audio', audioFile));
      if (playbackFile) {
        await fs.rename(info.playbackPath, path.join(uploadsDir, 'playback', playbackFile));
        created.push(path.join(uploadsDir, 'playback', playbackFile));
      }
      const { rows } = await db.query(
        'INSERT INTO tracks(id,owner_id,title,artist,album,genre,duration,audio_file,playback_file,audio_format,sample_rate,bit_depth,source_key,source_info) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',
        [
          id,
          job.ownerId,
          selected.title,
          selected.artist,
          selected.album,
          '',
          info.duration,
          audioFile,
          playbackFile,
          info.format,
          info.sampleRate,
          info.bitDepth,
          sourceKey,
          JSON.stringify(provenance),
        ],
      );
      created = [];
      job.track = trackView(rows[0]);
      job.status = 'completed';
      job.progress = 100;
      job.message = 'Đã thêm nhạc vào thư viện.';
    } catch (error) {
      job.status = job.controller.signal.aborted ? 'cancelled' : 'failed';
      job.message =
        job.status === 'cancelled'
          ? 'Đã hủy tải nhạc.'
          : signal.aborted
            ? 'Tải quá lâu. Hãy thử lại với bản nhạc khác.'
            : error.status
              ? error.message
              : 'Không tải được nhạc. Hãy kiểm tra kết nối và thử lại.';
    } finally {
      await Promise.all(created.map((file) => fs.unlink(file).catch(() => {})));
      if (directory)
        await fs.rm(directory, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
      job.finishedAt = Date.now();
      if (active === job) active = null;
    }
  }
  return {
    sources,
    start(ownerId, input) {
      if (closing) throw new ApiError(503, 'Máy chủ đang đóng.');
      if (active)
        throw new ApiError(409, 'Đang tải một bài nhạc. Hãy đợi hoàn tất hoặc hủy lượt hiện tại.');
      if (
        !input ||
        !Object.hasOwn(providers, input.source) ||
        typeof input.itemId !== 'string' ||
        input.itemId.length > 200 ||
        typeof input.key !== 'string' ||
        !input.key ||
        input.key.length > 600
      )
        throw new ApiError(400, 'Bản nhạc được chọn không hợp lệ.');
      for (const [id, j] of jobs)
        if (j.finishedAt && (Date.now() - j.finishedAt > 30 * 60 * 1000 || jobs.size >= 100))
          jobs.delete(id);
      const job = {
        id: randomUUID(),
        ownerId,
        controller: new AbortController(),
        status: 'resolving',
        progress: 0,
        received: 0,
        total: 0,
        message: 'Đang kiểm tra giấy phép và chọn bản chất lượng tốt nhất…',
      };
      jobs.set(job.id, job);
      active = job;
      job.promise = run(job, input);
      return publicJob(job);
    },
    status(id, ownerId) {
      return publicJob(owned(id, ownerId));
    },
    active(ownerId) {
      return active?.ownerId === ownerId ? publicJob(active) : null;
    },
    cancel(id, ownerId) {
      const job = owned(id, ownerId);
      if (job.status === 'saving')
        throw new ApiError(409, 'Bài hát đang được lưu. Vui lòng đợi hoàn tất.');
      if (!job.finishedAt) {
        job.controller.abort();
        job.status = 'cancelled';
        job.message = 'Đang hủy và dọn file tạm…';
      }
      return publicJob(job);
    },
    async close() {
      closing = true;
      for (const j of jobs.values())
        if (!j.finishedAt && j.status !== 'saving') j.controller.abort();
      await Promise.all([...jobs.values()].map((j) => j.promise));
    },
  };
}

export function openMusicRoutes(app, { service, requireAuth }) {
  const reads = new Map();
  const limit = (req, res, next) => {
    const now = Date.now(),
      key = req.user.id;
    for (const [id, b] of reads) if (b.until < now) reads.delete(id);
    const b = reads.get(key) || { count: 0, until: now + 60000 };
    reads.set(key, b);
    if (++b.count > 30)
      return next(new ApiError(429, 'Bạn tìm kiếm quá nhanh. Vui lòng đợi một phút.'));
    next();
  };
  const publicTrack = ({ downloadUrl, ...track }) => track;
  app.get('/api/open-music/search', requireAuth, limit, async (req, res) =>
    res.json(
      await service.sources.search(
        req.query.q,
        req.query.source || 'all',
        Number(req.query.page || 1),
      ),
    ),
  );
  app.get('/api/open-music/tracks', requireAuth, limit, async (req, res) =>
    res.json({
      tracks: (await service.sources.tracks(req.query.source, req.query.id)).map(publicTrack),
    }),
  );
  app.get('/api/open-music/jobs/active', requireAuth, (req, res) =>
    res.json({ job: service.active(req.user.id) }),
  );
  app.post('/api/open-music/jobs', requireAuth, (req, res) =>
    res.status(202).json({ job: service.start(req.user.id, req.body) }),
  );
  app.get('/api/open-music/jobs/:id', requireAuth, (req, res) =>
    res.json({ job: service.status(req.params.id, req.user.id) }),
  );
  app.delete('/api/open-music/jobs/:id', requireAuth, (req, res) =>
    res.json({ job: service.cancel(req.params.id, req.user.id) }),
  );
}

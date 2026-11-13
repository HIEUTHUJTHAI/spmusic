import fs from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ffmpeg from 'ffmpeg-static';
import { ApiError } from './validation.js';
import { MAX_AUDIO_BYTES, prepareAudio } from './audio.js';
import { audioHash, rejectDuplicate } from './duplicates.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const localTools = path.resolve(here, '../../tools/vendor');
const packagedTools = process.resourcesPath && path.join(process.resourcesPath, 'tools');
const tool = (name) => {
  if (process.env.SPMUSIC_TOOLS_DIR) return path.join(process.env.SPMUSIC_TOOLS_DIR, name);
  return packagedTools && existsSync(path.join(packagedTools, name))
    ? path.join(packagedTools, name)
    : path.join(localTools, name);
};

// yt-dlp is a separate process and cannot see Electron's virtual app.asar paths.
export function youtubeFfmpegPath(resourcesPath = process.resourcesPath) {
  const unpacked = resourcesPath && path.join(
    resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
  );
  return unpacked && existsSync(unpacked) ? unpacked : ffmpeg;
}

export function youtubeVideoUrl(input) {
  if (typeof input !== 'string' || input.length > 600) throw new ApiError(400, 'Link YouTube không hợp lệ.');
  let url;
  try { url = new URL(input.trim()); } catch { throw new ApiError(400, 'Link YouTube không hợp lệ.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw new ApiError(400, 'Chỉ nhận link YouTube HTTPS công khai.');
  const host = url.hostname.toLowerCase();
  let id;
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    id = url.pathname.match(/^\/([a-zA-Z0-9_-]{11})\/?$/)?.[1];
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{11})\/?$/)?.[1];
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(id || ''))
    throw new ApiError(400, 'Hãy dán link của một video YouTube, không phải playlist hoặc trang khác.');
  return { id, url: `https://www.youtube.com/watch?v=${id}` };
}

function runDownloader(args, signal, timeout, onProgress) {
  const binary = tool(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (process.platform === 'win32' && !existsSync(binary))
    throw new ApiError(503, 'Thiếu bộ tải YouTube. Hãy cài lại SPMusic.');
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', settled = false, timedOut = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => child.kill();
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeout);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (stdout.length > 4 * 1024 * 1024) child.kill();
      const matches = stdout.matchAll(/\[download\]\s+([\d.]+)%/g);
      for (const match of matches) onProgress?.(Number(match[1]));
      if (onProgress && stdout.length > 8192) stdout = stdout.slice(-4096);
    });
    child.stderr.on('data', (data) => { stderr = (stderr + data.toString()).slice(-8192); });
    child.once('error', () => finish(new ApiError(503, 'Không chạy được bộ tải YouTube. Hãy cài lại SPMusic.')));
    child.once('close', (code) => {
      if (signal?.aborted) return finish(new ApiError(499, 'Đã hủy tải video.'));
      if (timedOut) return finish(new ApiError(504, 'YouTube phản hồi quá lâu. Hãy thử lại.'));
      if (code !== 0) return finish(new ApiError(400,
        /ffmpeg.*(?:not found|does not exist)|ffprobe.*not found/i.test(stderr)
          ? 'Không tìm thấy FFmpeg trong bản app. Hãy cài bản SPMusic mới nhất.'
          : /HTTP Error 403|Forbidden/i.test(stderr)
          ? 'YouTube từ chối tải âm thanh của video này (403). Hãy thử lại sau.'
          : /Sign in|login|cookies|private|unavailable|not available/i.test(stderr)
          ? 'Video riêng tư, bị giới hạn hoặc không thể truy cập. Hãy chọn video công khai khác.'
          : 'Không thể lấy âm thanh từ video này. Hãy kiểm tra link và kết nối mạng.'));
      finish(null, stdout);
    });
  });
}

const baseArgs = () => [
  '--ignore-config', '--no-plugin-dirs', '--no-cache-dir', '--no-playlist',
  '--socket-timeout', '20', '--retries', '2', '--extractor-retries', '2',
  '--js-runtimes', `node:${tool(process.platform === 'win32' ? 'node.exe' : 'node')}`,
];
export async function resolveYoutubeAudio(url, signal) {
  const video = youtubeVideoUrl(url);
  const output = await runDownloader([...baseArgs(), '--dump-single-json', '--skip-download', '--quiet',
    '--format', 'bestaudio[protocol=https]', video.url], signal, 90000);
  const metadata = JSON.parse(output.trim());
  if (metadata.id !== video.id || metadata.is_live || !metadata.url)
    throw new ApiError(422, 'Không có nguồn phát trực tuyến phù hợp cho video này.');
  return metadata;
}
const clean = (value, max, fallback) =>
  String(value || fallback).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) || fallback;

export function createYoutubeImporter({ db, uploadsDir, trackView, inspect, download, prepare = prepareAudio }) {
  const jobs = new Map();
  let active = null, closing = false;
  const publicJob = (j) => ({
    id: j.id, status: j.status, progress: j.progress, message: j.message,
    track: j.track || null, existing: !!j.existing,
  });
  const owned = (id, ownerId) => {
    const job = jobs.get(id);
    if (!job || job.ownerId !== ownerId) throw new ApiError(404, 'Không tìm thấy lượt tải của bạn.');
    return job;
  };
  const inspectVideo = inspect || (async (url, signal) => {
    const output = await runDownloader([...baseArgs(), '--dump-single-json', '--skip-download', '--quiet', url], signal, 90000);
    try { return JSON.parse(output.trim()); }
    catch { throw new ApiError(502, 'Không đọc được thông tin video YouTube.'); }
  });
  const directAudio = async (url, directory, signal, onProgress) => {
    const metadata = await resolveYoutubeAudio(url, signal);
    const source = new URL(metadata.url);
    if (source.protocol !== 'https:' || !source.hostname.endsWith('.googlevideo.com') || source.port || source.username || source.password)
      throw new ApiError(502, 'Nguồn âm thanh không hợp lệ.');
    const response = await fetch(source.href, { signal, redirect: 'error' });
    if (!response.ok || !response.body) throw new ApiError(502, 'YouTube chưa cho tải nguồn này. Hãy thử lại sau.');
    const total = Number(response.headers.get('content-length'));
    if (total > MAX_AUDIO_BYTES) { await response.body.cancel(); throw new ApiError(413, 'Nguồn nhạc vượt giới hạn 250 MB.'); }
    const input = path.join(directory, 'source.audio');
    let bytes = 0;
    const limit = new Transform({ transform(chunk, encoding, callback) {
      bytes += chunk.length;
      if (bytes > MAX_AUDIO_BYTES) return callback(new ApiError(413, 'Nguồn nhạc vượt giới hạn 250 MB.'));
      if (total > 0) onProgress?.(Math.min(95, bytes / total * 95));
      callback(null, chunk);
    } });
    await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(input, { flags: 'wx' }), { signal });
    const output = path.join(directory, 'audio.mp3');
    await promisify(execFile)(youtubeFfmpegPath(), ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', input,
      '-vn', '-codec:a', 'libmp3lame', '-q:a', '0', output], { windowsHide: true, signal, timeout: 15 * 60000, maxBuffer: 1024 * 1024 });
    onProgress?.(100);
    return output;
  };
  const downloadAudio = download || (async (url, directory, signal, onProgress) => {
    try {
      await runDownloader([...baseArgs(), '--newline', '--format', 'bestaudio', '--extract-audio',
        '--audio-format', 'mp3', '--audio-quality', '0', '--max-filesize', '250M',
        '--ffmpeg-location', youtubeFfmpegPath(), '--output', path.join(directory, 'primary.%(ext)s'), url],
        signal, 12 * 60000, onProgress);
      const file = path.join(directory, 'primary.mp3');
      await fs.access(file);
      return file;
    } catch (primaryError) {
      signal.throwIfAborted();
      try { return await directAudio(url, directory, signal, onProgress); }
      catch (fallbackError) {
        signal.throwIfAborted();
        if (fallbackError.status === 413) throw fallbackError;
        throw new ApiError(502, 'Không tải được âm thanh sau khi thử hai cách. Nguồn có thể tạm lỗi hoặc bị giới hạn. Hãy thử lại sau.');
      }
    }
  });

  async function run(job, video) {
    let directory, savedFile, savedCover;
    const signal = AbortSignal.any([job.controller.signal, AbortSignal.timeout(16 * 60 * 1000)]);
    try {
      const metadata = await inspectVideo(video.url, signal);
      signal.throwIfAborted();
      if (metadata.id !== video.id || !Number.isFinite(Number(metadata.duration)) ||
          Number(metadata.duration) <= 0 || Number(metadata.duration) > 3 * 60 * 60 ||
          metadata.is_live || metadata.live_status === 'is_live')
        throw new ApiError(400, 'Chỉ hỗ trợ video thường, tối đa 3 giờ.');
      const sourceKey = JSON.stringify(['youtube', video.id]);
      const previous = await db.query('SELECT * FROM tracks WHERE owner_id=$1 AND source_key=$2', [job.ownerId, sourceKey]);
      const onlineTrack = previous.rows[0]?.source_info?.online ? previous.rows[0] : null;
      if (previous.rows[0] && !onlineTrack) {
        job.track = trackView(previous.rows[0]);
        job.existing = true;
        job.status = 'completed'; job.progress = 100;
        job.message = 'Video này đã có trong thư viện.';
        return;
      }
      const title = clean(metadata.title, 160, video.id);
      await rejectDuplicate(db, uploadsDir, job.ownerId, onlineTrack?.title || title, null, onlineTrack?.id);
      directory = await fs.mkdtemp(path.join(uploadsDir, 'temp', 'youtube-'));
      job.status = 'downloading'; job.progress = 10;
      job.message = 'Đang tải âm thanh chất lượng cao nhất có sẵn…';
      const file = await downloadAudio(video.url, directory, signal, (percent) => {
        if (Number.isFinite(percent)) job.progress = Math.min(85, 10 + Math.floor(percent * 0.75));
      });
      signal.throwIfAborted();
      const size = (await fs.stat(file)).size;
      if (!size || size > MAX_AUDIO_BYTES) throw new ApiError(400, 'Bản MP3 vượt giới hạn 250 MB.');
      job.status = 'processing'; job.progress = 90;
      job.message = 'Đang kiểm tra file MP3…';
      const info = await prepare({ path: file, originalname: 'youtube.mp3', size }, directory);
      const hash = await audioHash(file);
      await rejectDuplicate(db, uploadsDir, job.ownerId, onlineTrack?.title || title, hash, onlineTrack?.id);
      signal.throwIfAborted();
      const id = onlineTrack?.id || randomUUID(), audioFile = `${id}${info.ext}`;
      let coverFile = null;
      try {
        if (onlineTrack?.cover_file) throw new Error('keep custom cover');
        const response = await fetch(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`, { signal: AbortSignal.timeout(8000), redirect: 'error' });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg')) throw new Error('thumbnail unavailable');
        const chunks = []; let bytes = 0;
        for await (const chunk of response.body) { bytes += chunk.length; if (bytes > 5 * 1024 * 1024) throw new Error('thumbnail too large'); chunks.push(chunk); }
        const image = Buffer.concat(chunks);
        if (image.length < 3 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) throw new Error('invalid image');
        coverFile = `${id}.jpg`;
        savedCover = path.join(uploadsDir, 'covers', coverFile);
        await fs.writeFile(savedCover, image);
      } catch { if (savedCover) await fs.unlink(savedCover).catch(() => {}); savedCover = null; coverFile = null; }
      const provenance = {
        provider: 'youtube', providerName: 'YouTube', itemId: video.id,
        title,
        artist: clean(metadata.artist || metadata.uploader || metadata.channel, 120, 'Không rõ nghệ sĩ'),
        sourceUrl: video.url, format: info.format, downloadedAt: new Date().toISOString(),
      };
      job.status = 'saving'; job.progress = 97;
      job.message = 'Đang lưu vào thư viện…';
      savedFile = path.join(uploadsDir, 'audio', audioFile);
      await fs.rename(file, savedFile);
      const { rows } = onlineTrack ? await db.query(
        `UPDATE tracks SET duration=$1,audio_file=$2,audio_format=$3,sample_rate=$4,bit_depth=$5,
          source_info=$6,audio_hash=$7,cover_file=COALESCE(cover_file,$8)
          WHERE id=$9 AND owner_id=$10 AND source_info->>'online'='true' RETURNING *`,
        [info.duration,audioFile,info.format,info.sampleRate,info.bitDepth,JSON.stringify(provenance),hash,coverFile,id,job.ownerId],
      ) : await db.query(
        'INSERT INTO tracks(id,owner_id,title,artist,album,genre,duration,audio_file,audio_format,sample_rate,bit_depth,source_key,source_info,audio_hash,cover_file) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *',
        [id, job.ownerId, provenance.title, provenance.artist, '', '', info.duration, audioFile,
          info.format, info.sampleRate, info.bitDepth, sourceKey, JSON.stringify(provenance), hash, coverFile],
      );
      if (!rows[0]) throw new ApiError(409, 'Bài online đã bị xóa hoặc thay đổi trong lúc tải.');
      if (savedCover && rows[0].cover_file !== coverFile) await fs.unlink(savedCover).catch(() => {});
      savedFile = null;
      savedCover = null;
      job.track = trackView(rows[0]);
      job.status = 'completed'; job.progress = 100;
      job.message = 'Đã lưu bản offline vào thư viện.';
    } catch (error) {
      job.status = job.controller.signal.aborted ? 'cancelled' : 'failed';
      job.message = job.status === 'cancelled' ? 'Đã hủy tải nhạc.' :
        error.status ? error.message : 'Không thể tải video. Hãy kiểm tra kết nối và thử lại.';
    } finally {
      if (savedFile) await fs.unlink(savedFile).catch(() => {});
      if (savedCover) await fs.unlink(savedCover).catch(() => {});
      if (directory) await fs.rm(directory, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
      job.finishedAt = Date.now();
      if (active === job) active = null;
    }
  }

  return {
    start(ownerId, input) {
      if (closing) throw new ApiError(503, 'Máy chủ đang đóng.');
      if (active) throw new ApiError(409, 'Đang tải một video. Hãy đợi hoặc hủy lượt hiện tại.');
      if (input?.licensed !== true) throw new ApiError(400, 'Hãy xác nhận bạn có quyền tải video này.');
      const video = youtubeVideoUrl(input.url);
      for (const [id, job] of jobs)
        if (job.finishedAt && Date.now() - job.finishedAt > 30 * 60 * 1000) jobs.delete(id);
      const job = {
        id: randomUUID(), ownerId, controller: new AbortController(),
        status: 'inspecting', progress: 3, message: 'Đang đọc thông tin video…',
      };
      jobs.set(job.id, job); active = job;
      job.promise = run(job, video);
      return publicJob(job);
    },
    status(id, ownerId) { return publicJob(owned(id, ownerId)); },
    active(ownerId) { return active?.ownerId === ownerId ? publicJob(active) : null; },
    cancel(id, ownerId) {
      const job = owned(id, ownerId);
      if (job.status === 'saving') throw new ApiError(409, 'Bài hát đang được lưu. Vui lòng đợi.');
      if (!job.finishedAt) { job.controller.abort(); job.status = 'cancelled'; job.message = 'Đang hủy tải…'; }
      return publicJob(job);
    },
    async close() {
      closing = true;
      for (const job of jobs.values()) if (!job.finishedAt && job.status !== 'saving') job.controller.abort();
      await Promise.all([...jobs.values()].map((job) => job.promise));
    },
  };
}

export function youtubeRoutes(app, { service, requireAuth }) {
  app.get('/api/youtube/jobs/active', requireAuth, (req, res) =>
    res.json({ job: service.active(req.user.id) }));
  app.post('/api/youtube/jobs', requireAuth, (req, res) =>
    res.status(202).json({ job: service.start(req.user.id, req.body) }));
  app.get('/api/youtube/jobs/:id', requireAuth, (req, res) =>
    res.json({ job: service.status(req.params.id, req.user.id) }));
  app.delete('/api/youtube/jobs/:id', requireAuth, (req, res) =>
    res.json({ job: service.cancel(req.params.id, req.user.id) }));
}

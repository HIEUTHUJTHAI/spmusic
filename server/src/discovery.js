import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { ApiError } from './validation.js';

const MAX_BYTES = 50 * 1024 * 1024;
const FORMATS = new Map([['.flac', 'FLAC'], ['.wav', 'WAV'], ['.mp3', 'MP3'], ['.ogg', 'OGG'], ['.opus', 'Opus']]);
const LICENSE = /^https?:\/\/creativecommons\.org\/(?:licenses\/[a-z-]+\/\d(?:\.\d)?|publicdomain\/(?:zero|mark)\/\d(?:\.\d)?)(?:\/|$)/i;
const identifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const clean = (value, fallback = '') => String(Array.isArray(value) ? value[0] : value || fallback).trim().slice(0, 160);

async function archiveJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'SPMusic/2.2 discovery' } });
  if (!response.ok) throw new ApiError(502, 'Nguồn nhạc chưa phản hồi. Hãy thử lại sau.');
  return response.json();
}

async function itemFiles(identifier) {
  if (!identifierPattern.test(identifier)) throw new ApiError(400, 'Nguồn nhạc không hợp lệ.');
  const data = await archiveJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  const licenseUrl = clean(data.metadata?.licenseurl);
  if (!LICENSE.test(licenseUrl)) return null;
  const files = (data.files || []).filter((file) => {
    const ext = path.extname(file.name || '').toLowerCase();
    return FORMATS.has(ext) && Number(file.size) > 0 && Number(file.size) <= MAX_BYTES;
  });
  // Prefer lossless originals when they fit the local import limit.
  const rank = (file) => ['.flac', '.wav', '.mp3', '.ogg', '.opus'].indexOf(path.extname(file.name).toLowerCase()) * 2 +
    (file.source === 'original' ? 0 : 1);
  files.sort((a, b) => rank(a) - rank(b));
  return { data, licenseUrl, files };
}

export async function archiveSelection(identifier, filename) {
  const entry = await itemFiles(identifier);
  const file = entry?.files.find((candidate) => candidate.name === filename);
  if (!file) throw new ApiError(400, 'Nguồn nhạc hoặc giấy phép không còn hợp lệ.');
  return {
    sourceKey: JSON.stringify(['internet-archive', identifier, filename]),
    sourceInfo: {
      provider: 'internet-archive', providerName: 'Internet Archive',
      title: clean(entry.data.metadata?.title, filename),
      artist: clean(entry.data.metadata?.creator, 'Không rõ nghệ sĩ'),
      sourceUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
      license: { name: 'Creative Commons', url: entry.licenseUrl },
      format: FORMATS.get(path.extname(filename).toLowerCase()),
      downloadedAt: new Date().toISOString(),
    },
  };
}

export function discoveryRoutes(app) {
  app.get('/api/discover/youtube', async (req, res) => {
    const query = clean(req.query.q).trim();
    if (query.length < 2) return res.json({ results: [], configured: Boolean(process.env.YOUTUBE_API_KEY) });
    if (!process.env.YOUTUBE_API_KEY)
      return res.json({ results: [], configured: false });
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '8');
    url.searchParams.set('safeSearch', 'moderate');
    url.searchParams.set('q', query.slice(0, 120));
    url.searchParams.set('key', process.env.YOUTUBE_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = data.error?.errors?.[0]?.reason;
      const message = response.status === 403
        ? (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded'
          ? 'YouTube API đã hết hạn mức tìm kiếm hôm nay.'
          : 'YouTube API từ chối yêu cầu. Kiểm tra API key và trạng thái YouTube Data API v3.')
        : 'YouTube chưa trả kết quả. Hãy kiểm tra kết nối và thử lại.';
      throw new ApiError(502, message);
    }
    res.json({ configured: true, results: (data.items || []).map((item) => {
      const id = item.id?.videoId;
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id || '')) return null;
      const snippet = item.snippet || {};
      return {
        id, title: clean(snippet.title, 'Video YouTube'),
        artist: clean(snippet.channelTitle, 'YouTube'),
        thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
        sourceUrl: `https://www.youtube.com/watch?v=${id}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        provider: 'YouTube',
      };
    }).filter(Boolean) });
  });

  app.get('/api/discover/search', async (req, res) => {
    const query = clean(req.query.q).replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (query.length < 2) return res.json({ results: [] });
    const search = new URL('https://archive.org/advancedsearch.php');
    search.searchParams.set('q', `mediatype:audio AND collection:netlabels AND licenseurl:* AND title:(${query.split(' ').slice(0, 8).join(' ')})`);
    for (const field of ['identifier', 'title', 'creator']) search.searchParams.append('fl[]', field);
    search.searchParams.set('rows', '14');
    search.searchParams.set('output', 'json');
    const data = await archiveJson(search);
    const docs = (data.response?.docs || []).filter((item) => identifierPattern.test(item.identifier || ''));
    const inspected = await Promise.all(docs.map(async (item) => {
      try {
        const entry = await itemFiles(item.identifier);
        if (!entry?.files.length) return null;
        const file = entry.files[0];
        const filename = file.name;
        const audioUrl = `/api/discover/audio/${encodeURIComponent(item.identifier)}/${encodeURIComponent(filename)}`;
        const songName = path.posix.basename(filename, path.extname(filename)).replace(/_/g, ' ');
        return {
          id: item.identifier, filename, title: clean(songName, filename), album: clean(item.title),
          artist: clean(item.creator, 'Không rõ nghệ sĩ'), format: FORMATS.get(path.extname(filename).toLowerCase()),
          bytes: Number(file.size), licenseUrl: entry.licenseUrl,
          sourceUrl: `https://archive.org/details/${encodeURIComponent(item.identifier)}`,
          audioUrl, provider: 'Internet Archive',
        };
      } catch { return null; }
    }));
    res.json({ results: inspected.filter(Boolean).slice(0, 8) });
  });

  app.get('/api/discover/audio/:identifier/:filename', async (req, res) => {
    const { identifier, filename } = req.params;
    const entry = await itemFiles(identifier);
    const file = entry?.files.find((candidate) => candidate.name === filename);
    if (!file) throw new ApiError(404, 'File này không còn được phép tải.');
    const url = `https://archive.org/download/${encodeURIComponent(identifier)}/${filename.split('/').map(encodeURIComponent).join('/')}`;
    const upstream = await fetch(url, { signal: AbortSignal.timeout(120000), headers: { 'User-Agent': 'SPMusic/2.2 discovery' } });
    if (!upstream.ok || !upstream.body) throw new ApiError(502, 'Không thể lấy file từ nguồn nhạc.');
    const size = Number(upstream.headers.get('content-length') || file.size);
    if (size > MAX_BYTES) throw new ApiError(413, 'File nguồn vượt giới hạn 50 MB.');
    const mime = { '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.opus': 'audio/ogg' };
    res.setHeader('Content-Type', mime[path.extname(filename).toLowerCase()]);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    let transferred = 0;
    const limit = new Transform({ transform(chunk, _, callback) {
      transferred += chunk.length;
      callback(transferred > MAX_BYTES ? new Error('File quá lớn') : null, chunk);
    } });
    try { await pipeline(Readable.fromWeb(upstream.body), limit, res); }
    catch { if (!res.destroyed) res.destroy(); }
  });
}

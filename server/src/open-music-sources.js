import path from 'node:path';
import { ApiError } from './validation.js';
import { MAX_AUDIO_BYTES } from './audio.js';
import { remoteJSON, sourceURL } from './open-music-network.js';

export const providers = { archive: 'Internet Archive', commons: 'Wikimedia Commons' };
export function plain(value, max = 4000) {
  const source = Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : '';
  return source
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => {
      const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(
      /&(amp|quot|apos|lt|gt|nbsp);/g,
      (_, n) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' })[n],
    )
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
export function openLicense(value) {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    let u;
    try {
      u = new URL(candidate);
    } catch {
      continue;
    }
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.port) continue;
    if (!['creativecommons.org', 'www.creativecommons.org'].includes(u.hostname)) continue;
    const match =
      u.pathname.match(
        /^\/licenses\/(by|by-sa)\/(1\.0|2\.0|2\.5|3\.0|4\.0)\/(?:deed\.[a-z_-]+)?$/i,
      ) || u.pathname.match(/^\/licenses\/(by|by-sa)\/(1\.0|2\.0|2\.5|3\.0|4\.0)$/i);
    if (match)
      return {
        name: `CC ${match[1].toUpperCase()} ${match[2]}`,
        url: `https://creativecommons.org/licenses/${match[1].toLowerCase()}/${match[2]}/`,
      };
    if (/^\/publicdomain\/zero\/1\.0\/?$/.test(u.pathname))
      return { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' };
    if (/^\/publicdomain\/mark\/1\.0\/?$/.test(u.pathname))
      return {
        name: 'Public Domain Mark',
        url: 'https://creativecommons.org/publicdomain/mark/1.0/',
      };
  }
  return null;
}
function fileFormat(name, format = '') {
  const ext = path.extname(name).toLowerCase();
  if (['.flac', '.wav', '.mp3', '.ogg', '.oga', '.opus'].includes(ext))
    return ext.slice(1).toUpperCase();
  if (ext === '.m4a' && /alac|apple lossless/i.test(format)) return 'ALAC';
  return null;
}
function quality(file) {
  const format = fileFormat(file.name, file.format);
  if (!format) return null;
  const size = Number(file.size);
  if (
    !Number.isFinite(size) ||
    size < 1 ||
    size > MAX_AUDIO_BYTES ||
    file.private === 'true' ||
    file.private === true
  )
    return null;
  const lossless = ['FLAC', 'WAV', 'ALAC'].includes(format);
  const rate =
    Number(file.bitrate || file.bit_rate) ||
    Number(String(file.format).match(/(\d+)\s*Kbps/i)?.[1]) * 1000 ||
    0;
  return {
    format,
    lossless,
    size,
    bitrate: rate > 1000 ? Math.round(rate / 1000) : rate,
    sampleRate: Number(file.samplerate || file.sample_rate) || 0,
    bitDepth: Number(file.bitdepth || file.bits_per_sample) || 0,
  };
}
export function qualityCompare(a, b) {
  return (
    Number(b.lossless) - Number(a.lossless) ||
    (a.lossless ? b.bitDepth - a.bitDepth || b.sampleRate - a.sampleRate : b.bitrate - a.bitrate) ||
    Number(b.original) - Number(a.original) ||
    Number(b.format === 'FLAC') - Number(a.format === 'FLAC')
  );
}
function archiveId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(id))
    throw new ApiError(400, 'Mã nguồn không hợp lệ.');
  return id;
}
function commonsId(id) {
  if (typeof id !== 'string' || !/^[1-9]\d{0,11}$/.test(id))
    throw new ApiError(400, 'Mã nguồn không hợp lệ.');
  return id;
}
function safeFile(name) {
  return (
    typeof name === 'string' &&
    name.length <= 600 &&
    !/[\\\u0000-\u001f]/.test(name) &&
    !name.startsWith('/') &&
    !name.split('/').some((p) => p === '.' || p === '..')
  );
}

export function archiveTracks(id, data) {
  archiveId(id);
  const meta = data.metadata || {},
    license = openLicense(meta.licenseurl);
  if (!license || meta.mediatype !== 'audio' || meta['access-restricted-item'] === true) return [];
  if (meta['access-restricted-item'] === 'true' || meta['is_dark'] === 'true') return [];
  const files = Array.isArray(data.files) ? data.files : [],
    byName = new Map(files.map((f) => [f.name, f]));
  const groups = new Map();
  for (const file of files) {
    if (!safeFile(file.name)) continue;
    const q = quality(file);
    if (!q) continue;
    let root = file,
      seen = new Set();
    while (root.original && byName.has(root.original) && !seen.has(root.original)) {
      seen.add(root.name);
      root = byName.get(root.original);
    }
    const key = root.name;
    const fileLicense =
      file.licenseurl !== undefined
        ? openLicense(file.licenseurl)
        : root.licenseurl !== undefined
          ? openLicense(root.licenseurl)
          : license;
    if (!fileLicense) continue;
    const entry = {
      ...q,
      key,
      file: file.name,
      original: file.source === 'original',
      title: plain(
        file.title || root.title || path.basename(root.name, path.extname(root.name)),
        160,
      ),
      artist: plain(file.creator || meta.creator, 120) || 'Không rõ nghệ sĩ',
      album: plain(meta.title, 160),
      credit: plain(file.creator || root.creator || meta.creator),
      license: fileLicense,
      source: 'archive',
      itemId: id,
      sourceUrl: `https://archive.org/details/${encodeURIComponent(id)}`,
      downloadUrl: `https://archive.org/download/${encodeURIComponent(id)}/${file.name.split('/').map(encodeURIComponent).join('/')}`,
    };
    const group = groups.get(key) || [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    group.sort(qualityCompare);
    return { ...group[0], alternatives: group.length };
  });
}

function commonsTrack(page) {
  const info = page.imageinfo?.[0],
    meta = info?.extmetadata;
  if (!info || !meta || plain(meta.Restrictions?.value)) return null;
  let license = openLicense(meta.LicenseUrl?.value);
  if (
    !license &&
    meta.LicenseShortName?.value === 'Public domain' &&
    [
      'https://commons.wikimedia.org/wiki/Help:Public_domain',
      '//commons.wikimedia.org/wiki/Help:Public_domain',
    ].includes(meta.LicenseUrl?.value)
  )
    license = {
      name: 'Public domain',
      url: 'https://commons.wikimedia.org/wiki/Help:Public_domain',
    };
  if (!license) return null;
  let url;
  try {
    url = sourceURL(info.url, 'audio');
  } catch {
    return null;
  }
  const file = page.title.replace(/^File:/, '');
  const q = quality({ name: file, size: info.size, format: info.mime });
  if (!q) return null;
  url.search = '';
  return {
    ...q,
    key: String(page.pageid),
    itemId: String(page.pageid),
    source: 'commons',
    file,
    title: plain(file.replace(/\.[^.]+$/, ''), 160),
    artist: plain(meta.Artist?.value, 120) || 'Không rõ nghệ sĩ',
    album: 'Wikimedia Commons',
    credit: plain([meta.Artist?.value, meta.Attribution?.value].filter(Boolean)),
    license,
    sourceUrl: `https://commons.wikimedia.org/?curid=${page.pageid}`,
    downloadUrl: url.href,
    alternatives: 1,
  };
}

export function createOpenSources({ json = remoteJSON } = {}) {
  async function commons(params, signal) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Attribution|Restrictions',
      ...params,
    });
    return json(url.href, { signal });
  }
  async function searchOne(source, term, page, signal) {
    if (source === 'archive') {
      const url = new URL('https://archive.org/advancedsearch.php');
      const licensePaths = [
        'publicdomain/zero/1.0',
        'publicdomain/mark/1.0',
        ...['by', 'by-sa'].flatMap((type) =>
          ['1.0', '2.0', '2.5', '3.0', '4.0'].map((version) => `licenses/${type}/${version}`),
        ),
      ];
      const licenseQuery =
        '(' +
        licensePaths
          .flatMap((p) =>
            ['http', 'https'].map(
              (protocol) => `licenseurl:"${protocol}://creativecommons.org/${p}/"`,
            ),
          )
          .join(' OR ') +
        ')';
      const words = term
        .split(/\s+/)
        .map((word) => `"${word}"`)
        .join(' AND ');
      url.search = new URLSearchParams({
        q: `mediatype:audio AND ${licenseQuery} AND (${words})`,
        output: 'json',
        rows: '12',
        page: String(page),
      });
      for (const field of ['identifier', 'title', 'creator', 'licenseurl'])
        url.searchParams.append('fl[]', field);
      const data = await json(url.href, { signal });
      if (!data.response) throw new ApiError(502, 'Internet Archive chưa trả về danh mục.');
      return {
        items: (data.response.docs || [])
          .filter((d) => openLicense(d.licenseurl))
          .map((d) => ({
            source,
            id: d.identifier,
            title: plain(d.title, 160),
            artist: plain(d.creator, 120) || 'Không rõ nghệ sĩ',
            license: openLicense(d.licenseurl),
            sourceUrl: `https://archive.org/details/${encodeURIComponent(d.identifier)}`,
          })),
        more: page * 12 < data.response.numFound,
      };
    }
    const data = await commons(
      {
        generator: 'search',
        gsrsearch: `${term} filetype:audio`,
        gsrnamespace: '6',
        gsrlimit: '12',
        gsroffset: String((page - 1) * 12),
      },
      signal,
    );
    const tracks = (data.query?.pages || [])
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map(commonsTrack)
      .filter(Boolean);
    return {
      items: tracks.map((t) => ({
        source,
        id: t.itemId,
        title: t.title,
        artist: t.artist,
        license: t.license,
        sourceUrl: t.sourceUrl,
      })),
      more: !!data.continue,
    };
  }
  return {
    async search(query, source = 'all', page = 1, signal) {
      if (
        typeof query !== 'string' ||
        query.length > 100 ||
        !['all', ...Object.keys(providers)].includes(source) ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > 20
      )
        throw new ApiError(400, 'Từ khóa, nguồn hoặc trang tìm kiếm không hợp lệ.');
      const term = query
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join(' ');
      if (term.length < 2) throw new ApiError(400, 'Nhập ít nhất 2 ký tự để tìm nhạc.');
      const sources = source === 'all' ? Object.keys(providers) : [source],
        results = await Promise.allSettled(sources.map((s) => searchOne(s, term, page, signal)));
      const warnings = [],
        items = [];
      let more = false;
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          items.push(...r.value.items);
          more ||= r.value.more;
        } else warnings.push(`${providers[sources[i]]} chưa kết nối được. Hãy thử lại sau.`);
      });
      if (warnings.length === sources.length) throw new ApiError(502, warnings.join(' '));
      return { items, warnings, more, page };
    },
    async tracks(source, id, signal) {
      if (source === 'archive')
        return archiveTracks(
          archiveId(id),
          await json(`https://archive.org/metadata/${encodeURIComponent(id)}`, { signal }),
        );
      if (source === 'commons') {
        const data = await commons({ pageids: commonsId(id) }, signal);
        return (data.query?.pages || []).map(commonsTrack).filter(Boolean);
      }
      throw new ApiError(400, 'Nguồn nhạc không hợp lệ.');
    },
  };
}

import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { ApiError } from './validation.js';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
])
  blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
])
  blocked.addSubnet(address, prefix, 'ipv6');
export function publicAddress(address) {
  const family = isIP(address);
  // Reject mapped addresses too; DNS normally returns native A/AAAA records.
  return (
    !!family &&
    !address.toLowerCase().startsWith('::ffff:') &&
    !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6')
  );
}
export function sourceURL(value, kind = 'metadata') {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(400, 'Đường dẫn nguồn không hợp lệ.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443'))
    throw new ApiError(400, 'Nguồn nhạc phải dùng HTTPS.');
  const host = url.hostname;
  const allowed =
    kind === 'metadata'
      ? (host === 'archive.org' &&
          (/^\/metadata\/[A-Za-z0-9._-]+$/.test(url.pathname) ||
            url.pathname === '/advancedsearch.php')) ||
        (host === 'commons.wikimedia.org' && url.pathname === '/w/api.php')
      : (host === 'archive.org' && url.pathname.startsWith('/download/')) ||
        (/^(ia|dn)\d+\.(us|eu|ca)\.archive\.org$/.test(host) &&
          /^\/\d+\/items\//.test(url.pathname)) ||
        (host === 'upload.wikimedia.org' && url.pathname.startsWith('/wikipedia/commons/'));
  if (!allowed) throw new ApiError(400, 'Đường dẫn nằm ngoài nguồn nhạc được hỗ trợ.');
  return url;
}

export async function remoteStream(value, { kind = 'metadata', signal, redirects = 0 } = {}) {
  signal?.throwIfAborted();
  const url = sourceURL(value, kind);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new ApiError(502, 'Địa chỉ máy chủ nguồn không được phép.');
  const address = addresses.find((a) => a.family === 4) || addresses[0];
  const response = await new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        signal,
        headers: {
          'User-Agent': 'SPMusic/1.0 (personal open music library)',
          Accept: kind === 'metadata' ? 'application/json' : '*/*',
          'Accept-Encoding': 'identity',
        },
        lookup: (_hostname, options, callback) =>
          options.all ? callback(null, [address]) : callback(null, address.address, address.family),
      },
      resolve,
    );
    req.setTimeout(25000, () => req.destroy(new Error('Máy chủ nguồn phản hồi quá chậm.')));
    req.on('error', reject);
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    response.destroy();
    if (redirects >= 4 || !response.headers.location)
      throw new ApiError(502, 'Nguồn chuyển hướng quá nhiều lần.');
    return remoteStream(new URL(response.headers.location, url).href, {
      kind,
      signal,
      redirects: redirects + 1,
    });
  }
  if (response.statusCode !== 200) {
    response.destroy();
    throw new ApiError(
      502,
      `Nguồn nhạc chưa sẵn sàng (HTTP ${response.statusCode}). Hãy thử lại sau.`,
    );
  }
  return response;
}

export async function remoteJSON(url, { signal } = {}) {
  const boundedSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
    : AbortSignal.timeout(30000);
  const response = await remoteStream(url, { signal: boundedSignal });
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response) {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) throw new ApiError(502, 'Danh mục nguồn quá lớn.');
      chunks.push(chunk);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (data.error)
      throw new ApiError(502, 'Nguồn nhạc tạm thời không tìm kiếm được. Hãy thử lại sau.');
    return data;
  } catch (error) {
    response.destroy();
    if (error.status) throw error;
    throw new ApiError(502, 'Không đọc được thông tin từ nguồn nhạc.');
  }
}

import path from 'node:path';
import { TextDecoder } from 'node:util';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function text(value, field, max = 160, required = false) {
  if (value === undefined || value === null) {
    if (required) throw new ApiError(400, `${field} không được để trống.`);
    return '';
  }
  if (typeof value !== 'string') throw new ApiError(400, `${field} không hợp lệ.`);
  const result = value.trim();
  if (
    (required && !result) ||
    result.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)
  ) {
    throw new ApiError(400, `${field} phải có ${required ? '1' : '0'}–${max} ký tự.`);
  }
  return result;
}

export function validateLrc(buffer) {
  if (!buffer.length || buffer.length > 256 * 1024)
    throw new ApiError(400, 'File LRC phải có dung lượng từ 1 byte đến 256 KB.');
  let content;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new ApiError(400, 'File LRC phải dùng mã hóa UTF-8.');
  }
  if (content.includes('\0')) throw new ApiError(400, 'Nội dung LRC không hợp lệ.');
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  let timed = 0;
  for (const line of lines) {
    if (!line.trim() || /^\[(?:ar|al|ti|by|re|ve|length|offset):[^\]]*\]\s*$/i.test(line)) continue;
    const match = line.match(/^(?:\[\d{1,3}:[0-5]\d(?:[.:]\d{1,3})?\])+[^\r\n]*$/);
    if (!match)
      throw new ApiError(
        400,
        'Mỗi dòng lời hát phải có mốc thời gian LRC hợp lệ, ví dụ [00:12.50].',
      );
    timed++;
  }
  if (!timed) throw new ApiError(400, 'File LRC cần ít nhất một dòng có mốc thời gian.');
  return content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

export function validateCover(file, maxBytes = 5 * 1024 * 1024) {
  if (!file) return null;
  if (!file.size || file.size > maxBytes) throw new ApiError(400, `Ảnh bìa tối đa ${maxBytes / 1024 / 1024} MB.`);
  const b = file.buffer,
    ext = path.extname(file.originalname).toLowerCase();
  const valid =
    (['.jpg', '.jpeg'].includes(ext) && isJpeg(b)) ||
    (ext === '.png' && isPng(b)) ||
    (ext === '.webp' && isWebp(b));
  if (!valid) throw new ApiError(400, 'Ảnh bìa phải là JPG, PNG hoặc WebP hợp lệ.');
  return ext === '.jpeg' ? '.jpg' : ext;
}

function isPng(b) {
  if (b.length < 45 || !b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return false;
  let offset = 8,
    imageData = false;
  while (offset + 12 <= b.length) {
    const length = b.readUInt32BE(offset),
      type = b.toString('ascii', offset + 4, offset + 8),
      end = offset + length + 12;
    if (end > b.length) return false;
    if (offset === 8) {
      if (type !== 'IHDR' || length !== 13) return false;
      const width = b.readUInt32BE(16),
        height = b.readUInt32BE(20);
      if (!width || !height || width > 16384 || height > 16384 || width * height > 100000000)
        return false;
    } else if (type === 'IHDR') return false;
    if (type === 'IDAT' && length > 0) imageData = true;
    if (type === 'IEND') return length === 0 && imageData && end === b.length;
    offset = end;
  }
  return false;
}

function isJpeg(b) {
  if (
    b.length < 20 ||
    b[0] !== 255 ||
    b[1] !== 216 ||
    b[b.length - 2] !== 255 ||
    b[b.length - 1] !== 217
  )
    return false;
  let offset = 2,
    dimensions = false;
  while (offset + 4 <= b.length) {
    if (b[offset++] !== 255) return false;
    while (b[offset] === 255) offset++;
    const marker = b[offset++];
    if ([1, 208, 209, 210, 211, 212, 213, 214, 215].includes(marker)) continue;
    if (offset + 2 > b.length) return false;
    const length = b.readUInt16BE(offset);
    if (length < 2 || offset + length > b.length) return false;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
      if (length < 8) return false;
      const height = b.readUInt16BE(offset + 3),
        width = b.readUInt16BE(offset + 5);
      dimensions =
        width > 0 && height > 0 && width <= 16384 && height <= 16384 && width * height <= 100000000;
    }
    if (marker === 218) return dimensions && length >= 6 && offset + length < b.length - 2;
    offset += length;
  }
  return false;
}

function isWebp(b) {
  if (
    b.length < 25 ||
    b.toString('ascii', 0, 4) !== 'RIFF' ||
    b.toString('ascii', 8, 12) !== 'WEBP' ||
    b.readUInt32LE(4) !== b.length - 8
  )
    return false;
  let offset = 12,
    imageData = false;
  while (offset + 8 <= b.length) {
    const type = b.toString('ascii', offset, offset + 4),
      length = b.readUInt32LE(offset + 4),
      start = offset + 8;
    if (start + length > b.length) return false;
    if (
      type === 'VP8 ' &&
      length >= 10 &&
      b[start + 3] === 157 &&
      b[start + 4] === 1 &&
      b[start + 5] === 42
    )
      imageData = true;
    if (type === 'VP8L' && length >= 5 && b[start] === 47) imageData = true;
    if (type === 'ANMF' && length >= 24) imageData = true;
    offset = start + length + (length % 2);
  }
  return imageData && offset === b.length;
}

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import ffmpegPackage from 'ffmpeg-static';
import ffprobePackage from 'ffprobe-static';
import { ApiError } from './validation.js';

const execute = promisify(execFile);
export function externalBinaryPath(binary) {
  const physical = binary?.replace(/([\\/])app\.asar([\\/])/i, '$1app.asar.unpacked$2');
  return physical && physical !== binary && existsSync(physical) ? physical : binary;
}
const ffmpeg = externalBinaryPath(ffmpegPackage);
const ffprobe = externalBinaryPath(ffprobePackage.path);
export const MAX_AUDIO_BYTES = 250 * 1024 * 1024;
const MAX_PLAYBACK_BYTES = 1024 * 1024 * 1024;
const formats = {
  '.mp3': { demuxer: 'mp3', codec: /^mp3$/, label: 'MP3' },
  '.wav': { demuxer: 'wav', codec: /^pcm_/, label: 'WAV' },
  '.flac': { demuxer: 'flac', codec: /^flac$/, label: 'FLAC' },
  '.m4a': { demuxer: 'mov', codec: /^alac$/, label: 'ALAC' },
  '.ogg': { demuxer: 'ogg', codec: /^(vorbis|opus)$/, label: 'OGG' },
  '.oga': { demuxer: 'ogg', codec: /^(vorbis|opus)$/, label: 'OGG' },
  '.opus': { demuxer: 'ogg', codec: /^opus$/, label: 'OPUS' },
};

export function validateAudioFile(file) {
  if (!file) throw new ApiError(400, 'Hãy chọn file MP3, WAV, FLAC, ALAC (.m4a), OGG hoặc Opus.');
  if (!file.size || file.size > MAX_AUDIO_BYTES)
    throw new ApiError(400, 'File nhạc phải có dữ liệu và không vượt quá 250 MB.');
  const ext = path.extname(file.originalname).toLowerCase();
  if (!formats[ext]) throw new ApiError(400, 'Hỗ trợ MP3, WAV, FLAC, ALAC (.m4a), OGG và Opus.');
  return ext;
}

async function run(binary, args, timeout) {
  try {
    return await execute(binary, args, { timeout, maxBuffer: 1024 * 1024, windowsHide: true });
  } catch (error) {
    if (error.code === 'ENOENT' || !binary)
      throw new ApiError(
        503,
        'Thiếu bộ xử lý âm thanh. Hãy cài lại thư viện và khởi động Auralis.',
      );
    if (error.killed)
      throw new ApiError(400, 'File mất quá nhiều thời gian xử lý. Hãy chọn bản nhạc ngắn hơn.');
    throw new ApiError(
      400,
      'Không thể giải mã file nhạc. File có thể bị hỏng hoặc không đúng định dạng.',
    );
  }
}

function decode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let bytes = 0;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 120000);
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
    });
    child.once('error', () => {
      clearTimeout(timer);
      reject(new ApiError(503, 'Không chạy được bộ xử lý âm thanh. Hãy cài lại thư viện Auralis.'));
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (timedOut)
        reject(
          new ApiError(400, 'File mất quá nhiều thời gian xử lý. Hãy chọn bản nhạc ngắn hơn.'),
        );
      else if (code !== 0)
        reject(new ApiError(400, 'File nhạc bị hỏng hoặc không thể giải mã đầy đủ.'));
      else resolve(bytes);
    });
  });
}

// Only local files and the explicitly selected demuxer are permitted. No shell,
// URLs, external playlists or user-supplied FFmpeg arguments are used.
export async function prepareAudio(file, workingDir) {
  const ext = validateAudioFile(file);
  const format = formats[ext];
  const input = ['-protocol_whitelist', 'file', '-f', format.demuxer, '-i', file.path];
  const { stdout } = await run(
    ffprobe,
    [
      '-v',
      'error',
      '-max_alloc',
      '67108864',
      ...input,
      '-show_entries',
      'stream=codec_type,codec_name,sample_rate,channels,bits_per_raw_sample,bits_per_sample,duration:format=duration',
      '-of',
      'json',
    ],
    20000,
  );
  const info = JSON.parse(stdout);
  const streams = info.streams?.filter((stream) => stream.codec_type === 'audio') || [];
  const stream = streams[0];
  if (streams.length !== 1 || !format.codec.test(stream.codec_name || '')) {
    throw new ApiError(
      400,
      ext === '.m4a'
        ? 'File .m4a phải chứa ALAC (Apple Lossless). AAC trong M4A không phải lossless.'
        : 'Dữ liệu âm thanh không khớp với định dạng file.',
    );
  }
  const duration = Number(stream.duration || info.format?.duration);
  const sampleRate = Number(stream.sample_rate);
  const bitDepth = Number(stream.bits_per_raw_sample) || Number(stream.bits_per_sample) || null;
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 3 * 60 * 60 ||
    sampleRate < 8000 ||
    sampleRate > 192000 ||
    stream.channels < 1 ||
    stream.channels > 8
  )
    throw new ApiError(400, 'Nhạc cần có thời lượng tối đa 3 giờ, 8–192 kHz và 1–8 kênh.');
  if (
    ext === '.m4a' &&
    (![16, 20, 24].includes(bitDepth) ||
      duration * sampleRate * stream.channels * 4 > MAX_PLAYBACK_BYTES)
  )
    throw new ApiError(400, 'ALAC hỗ trợ 16/20/24 bit; bản giải mã phải nhỏ hơn 1 GB.');

  const playbackPath = ext === '.m4a' ? path.join(workingDir, 'playback.flac') : null;
  // Fully decode to catch corrupt frames; ALAC gets a browser-compatible FLAC
  // copy. No sample-rate change, channel downmix or lossy encoder is applied.
  const decodedBytes = await decode([
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-n',
    '-xerror',
    '-max_alloc',
    '67108864',
    '-err_detect',
    'crccheck+bitstream+buffer+explode',
    '-threads',
    '1',
    ...input,
    '-vn',
    '-sn',
    '-dn',
    '-map_metadata',
    '-1',
    '-threads',
    '1',
    '-nostats',
    ...(playbackPath
      ? [
          '-map',
          '0:a:0',
          '-c:a',
          'flac',
          '-sample_fmt',
          bitDepth <= 16 ? 's16' : 's32',
          '-compression_level',
          '5',
          '-fs',
          String(MAX_PLAYBACK_BYTES),
          playbackPath,
        ]
      : []),
    '-map',
    '0:a:0',
    '-c:a',
    'pcm_s32le',
    '-threads',
    '1',
    '-f',
    's32le',
    'pipe:1',
  ]);
  // Count decoded samples as they stream past, without buffering the PCM.
  // FFmpeg's progress timestamp can describe the start of its final packet.
  const decodedDuration = decodedBytes / (sampleRate * stream.channels * 4);
  if (
    !Number.isFinite(decodedDuration) ||
    Math.abs(decodedDuration - duration) >
      (['.mp3', '.ogg', '.oga', '.opus'].includes(ext) ? 0.25 : 2 / sampleRate)
  )
    throw new ApiError(400, 'File nhạc bị thiếu dữ liệu hoặc không thể giải mã đầy đủ.');
  if (playbackPath && (await fs.stat(playbackPath)).size >= MAX_PLAYBACK_BYTES)
    throw new ApiError(400, 'Bản phát lossless vượt giới hạn 1 GB.');
  return { ext, duration, format: format.label, sampleRate, bitDepth, playbackPath };
}

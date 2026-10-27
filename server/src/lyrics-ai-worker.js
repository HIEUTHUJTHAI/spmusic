import fs from 'node:fs/promises';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { alignLyrics } from './lyrics-alignment.js';

const execute = promisify(execFile);
let started = false;
const send = (message) => process.send?.(message);

process.on('message', async (job) => {
  if (started) return;
  started = true;
  let transcriber;
  try {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = job.cacheDir;
    env.allowLocalModels = true;
    env.localModelPath = job.cacheDir;
    env.allowRemoteModels = !job.offline;
    send({ stage: 'loading', message: 'Đang nạp mô hình AI cục bộ…' });
    let lastNotice = 0;
    transcriber = await pipeline('automatic-speech-recognition', job.model, {
      device: 'cpu',
      dtype: 'q8',
      local_files_only: job.offline,
      session_options: {
        intraOpNumThreads: Math.max(1, Math.min(4, os.availableParallelism() - 1)),
        interOpNumThreads: 1,
      },
      progress_callback: (event) => {
        if (event.status === 'progress' && Date.now() - lastNotice > 750) {
          lastNotice = Date.now();
          const percent = Math.round(event.progress || 0);
          send({
            stage: percent >= 100 ? 'loading' : 'downloading',
            message:
              percent >= 100
                ? 'Đang nạp dữ liệu mô hình trên máy…'
                : `Đang tải mô hình lần đầu… ${percent}%`,
          });
        }
      },
    });
    if (job.setupOnly) {
      send({ result: { ready: true } });
    } else {
      send({ stage: 'decoding', message: 'Đang chuẩn bị âm thanh cho AI…' });
      // This temporary mono/16-kHz copy is used only by speech recognition.
      // The original file and the lossless playback copy are never modified.
      await execute(
        ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-nostdin',
          '-n',
          '-protocol_whitelist',
          'file',
          '-i',
          job.audioPath,
          '-map',
          '0:a:0',
          '-vn',
          '-t',
          '901',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'pcm_f32le',
          '-f',
          'f32le',
          job.pcmPath,
        ],
        { windowsHide: true, timeout: 60000, maxBuffer: 64 * 1024 },
      );
      const bytes = await fs.readFile(job.pcmPath);
      const audio = new Float32Array(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      );
      const duration = audio.length / 16000;
      if (!duration || duration > 900) throw new Error('AI hiện hỗ trợ bài hát tối đa 15 phút.');
      let energy = 0;
      for (const sample of audio) energy += sample * sample;
      if (energy / audio.length < 1e-9)
        throw new Error('File gần như im lặng, AI không nhận ra giọng hát.');
      const chunks = [];
      // Non-overlapping windows bound memory and provide honest processing
      // progress. Boundary words may need manual review after recognition.
      const window = 25 * 16000;
      for (let offset = 0; offset < audio.length; offset += window) {
        const percent = Math.floor((offset / audio.length) * 100);
        send({
          stage: 'transcribing',
          progress: percent,
          message: `Đang nghe và nhận diện giọng hát… ${percent}%`,
        });
        const output = await transcriber(audio.subarray(offset, offset + window), {
          return_timestamps: 'word',
          language: job.language || undefined,
          task: 'transcribe',
          max_new_tokens: 224,
        });
        for (const chunk of output.chunks || [])
          chunks.push({
            text: chunk.text,
            timestamp: chunk.timestamp.map((time) =>
              time === null ? null : time + offset / 16000,
            ),
          });
      }
      send({ stage: 'aligning', progress: 100, message: 'Đang ghép từng câu với mốc thời gian…' });
      send({ result: alignLyrics(job.lines, chunks, duration) });
    }
  } catch (error) {
    // Internal paths, transcripts and model errors are kept out of API output.
    send({
      error: error.status
        ? error.message
        : /15 phút|im lặng/.test(error.message)
          ? error.message
          : 'Không chạy được AI. Lần đầu cần Internet để tải mô hình; hãy kiểm tra kết nối và bộ nhớ rồi thử lại.',
    });
    console.error('[Lyrics AI]', error.message);
  } finally {
    await transcriber?.dispose().catch(() => {});
    process.disconnect?.();
  }
});

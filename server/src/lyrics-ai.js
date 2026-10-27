import fs from 'node:fs/promises';
import path from 'node:path';
import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ApiError } from './validation.js';
import { plainLyrics } from './lyrics-alignment.js';

export const AI_MODEL = 'Xenova/whisper-base';
export const AI_LANGUAGES = new Set(['auto', 'vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es']);
const workerPath = fileURLToPath(new URL('./lyrics-ai-worker.js', import.meta.url));

export function createLyricsAI({
  dataDir,
  spawnWorker = (file) =>
    fork(file, [], {
      execArgv: [],
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    }),
}) {
  const jobs = new Map();
  let active = null;
  const view = (job) => ({
    id: job.id,
    status: job.status,
    stage: job.stage,
    message: job.message,
    progress: job.progress,
    result: job.result,
    error: job.error,
  });
  function get(id, ownerId) {
    const job = jobs.get(id);
    if (job && Date.now() - job.createdAt > 30 * 60 * 1000) {
      jobs.delete(id);
      throw new ApiError(404, 'Lượt căn lời đã hết hạn. Hãy chạy AI lại.');
    }
    if (!job || job.ownerId !== ownerId)
      throw new ApiError(404, 'Không tìm thấy lượt căn lời của bạn.');
    return job;
  }
  return {
    status: (id, ownerId) => view(get(id, ownerId)),
    async start({ ownerId, audioPath, content, language = 'auto', workingDir }) {
      const lines = plainLyrics(content);
      if (!AI_LANGUAGES.has(language)) throw new ApiError(400, 'Ngôn ngữ AI không hợp lệ.');
      if (active)
        throw new ApiError(409, 'AI đang xử lý một bài hát. Hãy chờ xong hoặc hủy lượt hiện tại.');
      for (const [id, job] of jobs)
        if (Date.now() - job.createdAt > 30 * 60 * 1000) jobs.delete(id);
      if (jobs.size >= 100) throw new ApiError(429, 'Có quá nhiều lượt AI. Hãy thử lại sau.');
      const job = {
        id: randomUUID(),
        ownerId,
        status: 'running',
        stage: 'loading',
        message: 'Đang khởi động AI trên máy của bạn…',
        createdAt: Date.now(),
      };
      const child = spawnWorker(workerPath);
      job.child = child;
      active = job;
      jobs.set(job.id, job);
      child.stderr?.on('data', () => {});
      const deadline = setTimeout(
        () => {
          job.status = 'failed';
          job.error = 'AI xử lý quá 20 phút. Hãy thử bài ngắn hơn.';
          child.kill();
        },
        20 * 60 * 1000,
      );
      deadline.unref?.();
      child.on('message', (message) => {
        if (job.status !== 'running') return;
        if (message.result) {
          job.status = 'completed';
          job.result = message.result;
          job.message = 'Đã tạo gợi ý thời gian.';
        } else if (message.error) {
          job.status = 'failed';
          job.error = message.error;
        } else {
          job.stage = message.stage;
          job.message = message.message;
          job.progress = Number.isFinite(message.progress) ? message.progress : undefined;
        }
      });
      const failed = () => {
        if (job.status === 'running') {
          job.status = 'failed';
          job.error = 'AI đã dừng trước khi hoàn tất. Hãy thử lại với bài ngắn hơn.';
        }
      };
      child.on('error', failed);
      child.once('close', async () => {
        clearTimeout(deadline);
        failed();
        if (active === job) active = null;
        job.child = null;
        await fs.rm(workingDir, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
      });
      child.send({
        audioPath,
        pcmPath: path.join(workingDir, 'recognition.f32'),
        lines,
        language: language === 'auto' ? null : language,
        model: AI_MODEL,
        cacheDir: path.resolve(process.env.LYRICS_AI_CACHE || path.join(dataDir, 'ai-models')),
        offline: process.env.LYRICS_AI_OFFLINE === 'true',
      });
      return view(job);
    },
    cancel(id, ownerId) {
      const job = get(id, ownerId);
      if (job.status === 'running') {
        job.status = 'cancelled';
        job.message = 'Đã hủy căn lời.';
        job.child?.kill();
      }
      return view(job);
    },
    close() {
      active?.child?.kill();
    },
  };
}

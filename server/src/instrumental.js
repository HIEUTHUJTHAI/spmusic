import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { ApiError } from './validation.js';

export async function instrumentalRoutes(app, { uploadsDir, requireAuth, ownTrack }) {
  const directory = path.join(uploadsDir, 'instrumental');
  await fs.mkdir(directory, { recursive: true });
  const models = path.join(uploadsDir, 'models');
  await fs.mkdir(models, { recursive: true });
  const modelPath = path.join(models, 'UVR_MDXNET_KARA_2.onnx');
  let modelDownload;
  app.get('/api/instrumental/model', requireAuth, async (req, res) => {
    try { await fs.access(modelPath); }
    catch {
      modelDownload ??= (async () => {
        const response = await fetch('https://huggingface.co/AI4future/RVC/resolve/main/UVR_MDXNET_KARA_2.onnx', { signal: AbortSignal.timeout(180000) });
        if (!response.ok) throw new ApiError(502, 'Không thể tải mô hình AI. Hãy kiểm tra Internet và thử lại.');
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length < 1000000 || bytes.length > 150 * 1024 * 1024) throw new ApiError(502, 'Mô hình AI tải về không hợp lệ.');
        await fs.writeFile(`${modelPath}.tmp`, bytes);
        await fs.rename(`${modelPath}.tmp`, modelPath);
      })().finally(() => { modelDownload = null; });
      await modelDownload;
    }
    res.type('application/octet-stream').sendFile(modelPath);
  });
  const upload = multer({ dest: path.join(uploadsDir, 'temp'), limits: { fileSize: 320 * 1024 * 1024, files: 1, fields: 0 } }).single('instrumental');
  app.get('/api/tracks/:id/instrumental', requireAuth, async (req, res) => {
    const track = await ownTrack(req);
    res.type('audio/wav').sendFile(path.join(directory, `${track.id}.wav`));
  });
  app.post('/api/tracks/:id/instrumental', requireAuth, async (req, res, next) => {
    const track = await ownTrack(req);
    upload(req, res, async (error) => {
      let staging;
      try {
        if (error) throw error;
        if (!req.file) throw new ApiError(400, 'Thiếu file nhạc nền.');
        const handle = await fs.open(req.file.path, 'r');
        const header = Buffer.alloc(12);
        try { await handle.read(header, 0, 12, 0); } finally { await handle.close(); }
        if (req.file.size < 44 || header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE')
          throw new ApiError(400, 'Nhạc nền phải là file WAV hợp lệ.');
        // Verify ownership again in case the song was removed while uploading.
        await ownTrack(req);
        staging = path.join(directory, `${randomUUID()}.tmp`);
        await fs.rename(req.file.path, staging);
        await fs.rename(staging, path.join(directory, `${track.id}.wav`));
        res.json({ ok: true });
      } catch (failure) { next(failure); }
      finally {
        if (req.file) await fs.unlink(req.file.path).catch(() => {});
        if (staging) await fs.unlink(staging).catch(() => {});
      }
    });
  });
}

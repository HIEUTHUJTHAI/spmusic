import { useEffect, useRef, useState } from 'react';
import { upload } from './api';

// One job at a time: model tensors and decoded audio can use substantial RAM.
export function useInstrumental(track, switchSource, notify) {
  const [job, setJob] = useState(null);
  const [enabled, setEnabled] = useState({});
  const busy = useRef(false);
  const mounted = useRef(true);
  const current = useRef(track);
  current.current = track;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!job) return undefined;
    const timer = setInterval(() => {
      if (!mounted.current || !job.startedAt) return;
      setJob((value) => value?.id === job.id ? { ...value, elapsed: Math.floor((Date.now() - value.startedAt) / 1000) } : value);
    }, 1000);
    return () => clearInterval(timer);
  }, [job?.id, Boolean(job)]);

  async function toggle(mode = 'instrumental') {
    if (!track || busy.current) return;
    const target = track;
    const url = `/api/tracks/${target.id}/${mode}`;
    const name = mode === 'vocals' ? 'giọng hát' : 'nhạc nền';
    if (enabled[target.id] === mode) {
      switchSource(target.id, null);
      setEnabled((value) => ({ ...value, [target.id]: null }));
      return;
    }
    busy.current = true;
    const startedAt = Date.now();
    setJob({ id: target.id, stage: 'checking', percent: 0, elapsed: 0, startedAt, text: `Đang kiểm tra bản ${name}…` });
    let separator;
    let outputs = [];
    try {
      const existing = await fetch(url, { method: 'HEAD' });
      if (!existing.ok && existing.status !== 404) throw new Error('Vui lòng đăng nhập bằng tài khoản sở hữu bài hát.');
      if (!existing.ok) {
        if (!target.duration || target.duration > 15 * 60)
          throw new Error('Tách nhạc nền hỗ trợ bài hát có thời lượng tối đa 15 phút.');
        setJob({ id: target.id, stage: 'loading-model', percent: 0, elapsed: 0, startedAt, text: 'Đang tải AI… Lần đầu cần kết nối Internet.' });
        const { createSeparator } = await import('web-audio-separation');
        const create = (executionProviders) => createSeparator('UVR_MDXNET_KARA_2', {
          common: {
            modelUrl: '/api/instrumental/model',
            outputSingleStem: mode, logLevel: 'error',
            onProgress: ({ stage, fraction, chunk, totalChunks }) => {
              if (!mounted.current) return;
              const label = stage === 'loading-model' ? 'Đang tải AI' : stage === 'demixing' ? `Đang tách ${name}` : `Đang tạo file ${name}`;
              const percent = Math.round(fraction * 100);
              const detail = stage === 'demixing' && totalChunks ? ` · khối ${chunk}/${totalChunks}` : ` · ${percent}%`;
              setJob((value) => ({ ...(value || {}), id: target.id, stage, percent, elapsed: Math.floor((Date.now() - startedAt) / 1000), startedAt, text: `${label}${detail}` }));
            },
          },
          mdx: { executionProviders, batchSize: 1 },
        });
        separator = create(['webgpu', 'wasm']);
        try {
          await separator.loadModel();
        } catch (webgpuError) {
          await separator.model?.release?.().catch(() => {});
          separator = create(['wasm']);
          setJob({ id: target.id, stage: 'loading-model', percent: 0, elapsed: Math.floor((Date.now() - startedAt) / 1000), startedAt, text: 'Thiết bị không dùng được WebGPU, đang chuyển sang chế độ tương thích…' });
          await separator.loadModel();
        }
        setJob({ id: target.id, stage: 'demixing', percent: 0, elapsed: Math.floor((Date.now() - startedAt) / 1000), startedAt, text: `Đã tải AI · đang tách ${name}…` });
        outputs = await separator.separate(target.audioUrl);
        if (!outputs[0]) throw new Error(`AI chưa tạo được ${name}.`);
        const blob = await (await fetch(outputs[0])).blob();
        const data = new FormData();
        data.append('instrumental', blob, 'instrumental.wav');
        setJob({ id: target.id, stage: 'saving', percent: 100, elapsed: Math.floor((Date.now() - startedAt) / 1000), startedAt, text: `Đang lưu ${name}…` });
        await upload(`/tracks/${target.id}/${mode}`, data);
      }
      if (mounted.current) {
        if (current.current?.id === target.id) {
          switchSource(target.id, url);
          setEnabled((value) => ({ ...value, [target.id]: mode }));
        }
        notify(`Bản ${name} đã sẵn sàng: ${target.title}`);
      }
    } catch (error) {
      if (mounted.current) notify(`Không thể tách ${name}. ${error.message}`);
    } finally {
      outputs.forEach((url) => URL.revokeObjectURL(url));
      // The package has no dispose API; release its ONNX session explicitly.
      await separator?.model?.release?.().catch(() => {});
      if (separator?.modelPath?.startsWith('blob:')) URL.revokeObjectURL(separator.modelPath);
      busy.current = false;
      if (mounted.current) setJob(null);
    }
  }
  return { toggle: () => toggle('instrumental'), toggleVocals: () => toggle('vocals'), job, mode: enabled[track?.id] || 'original', enabled: enabled[track?.id] === 'instrumental' };
}

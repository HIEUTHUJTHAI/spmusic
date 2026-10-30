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

  async function toggle() {
    if (!track || busy.current) return;
    const target = track;
    const url = `/api/tracks/${target.id}/instrumental`;
    if (enabled[target.id]) {
      switchSource(target.id, null);
      setEnabled((value) => ({ ...value, [target.id]: false }));
      return;
    }
    busy.current = true;
    setJob({ id: target.id, text: 'Đang kiểm tra bản nhạc nền…' });
    let separator;
    let outputs = [];
    try {
      const existing = await fetch(url, { method: 'HEAD' });
      if (!existing.ok && existing.status !== 404) throw new Error('Vui lòng đăng nhập bằng tài khoản sở hữu bài hát.');
      if (!existing.ok) {
        if (!target.duration || target.duration > 15 * 60)
          throw new Error('Tách nhạc nền hỗ trợ bài hát có thời lượng tối đa 15 phút.');
        setJob({ id: target.id, text: 'Đang tải AI… Lần đầu cần kết nối Internet.' });
        const { createSeparator } = await import('web-audio-separation');
        separator = createSeparator('UVR_MDXNET_KARA_2', {
          common: {
            modelUrl: '/api/instrumental/model',
            outputSingleStem: 'instrumental', logLevel: 'error',
            onProgress: ({ stage, fraction }) => {
              if (!mounted.current) return;
              const label = stage === 'loading-model' ? 'Đang tải AI' : stage === 'demixing' ? 'Đang tách nhạc nền' : 'Đang tạo file nhạc nền';
              setJob({ id: target.id, text: `${label} · ${Math.round(fraction * 100)}%` });
            },
          },
          mdx: { executionProviders: ['wasm'], batchSize: 1 },
        });
        await separator.loadModel();
        outputs = await separator.separate(target.audioUrl);
        if (!outputs[0]) throw new Error('AI chưa tạo được nhạc nền.');
        const blob = await (await fetch(outputs[0])).blob();
        const data = new FormData();
        data.append('instrumental', blob, 'instrumental.wav');
        setJob({ id: target.id, text: 'Đang lưu nhạc nền…' });
        await upload(`/tracks/${target.id}/instrumental`, data);
      }
      if (mounted.current) {
        if (current.current?.id === target.id) {
          switchSource(target.id, url);
          setEnabled((value) => ({ ...value, [target.id]: true }));
        }
        notify(`Nhạc nền đã sẵn sàng: ${target.title}`);
      }
    } catch (error) {
      if (mounted.current) notify(`Không thể tách nhạc nền. ${error.message}`);
    } finally {
      outputs.forEach((url) => URL.revokeObjectURL(url));
      // The package has no dispose API; release its ONNX session explicitly.
      await separator?.model?.release?.().catch(() => {});
      if (separator?.modelPath?.startsWith('blob:')) URL.revokeObjectURL(separator.modelPath);
      busy.current = false;
      if (mounted.current) setJob(null);
    }
  }
  return { toggle, job, enabled: Boolean(enabled[track?.id]) };
}

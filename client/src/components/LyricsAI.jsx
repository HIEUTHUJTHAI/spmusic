import { useEffect, useRef, useState } from 'react';
import { Sparkles, LoaderCircle, X, Undo2 } from 'lucide-react';
import { api } from '../lib/api';

const timeLabel = (value) => {
  if (value === null) return '';
  const count = Math.round(value * 100);
  return `${String(Math.floor(count / 6000)).padStart(2, '0')}:${String(Math.floor(count / 100) % 60).padStart(2, '0')}.${String(count % 100).padStart(2, '0')}`;
};
const timeValue = (value) => {
  const match = value.match(/^(\d{1,3}):([0-5]\d)(?:\.(\d{1,2}))?$/);
  return match
    ? Number(match[1]) * 60 + Number(match[2]) + Number((match[3] || '').padEnd(2, '0')) / 100
    : NaN;
};

export default function LyricsAI({
  content,
  trackId,
  audio,
  licensed = true,
  disabled,
  onChange,
  onBusyChange,
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [language, setLanguage] = useState('vi');
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [original, setOriginal] = useState(null);
  const request = useRef(null);
  const jobId = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
      if (jobId.current)
        api(`/lyrics/align/${jobId.current}`, { method: 'DELETE' }).catch(() => {});
    };
  }, []);

  async function cancel() {
    request.current?.abort();
    if (jobId.current)
      await api(`/lyrics/align/${jobId.current}`, { method: 'DELETE' }).catch(() => {});
  }

  async function start() {
    setError('');
    if (!licensed) {
      setError('Hãy đánh dấu xác nhận quyền sử dụng nội dung trước khi chạy AI.');
      return;
    }
    if (!content.trim()) {
      setError('Dán lời bài hát trước, mỗi câu hát một dòng.');
      return;
    }
    if (!trackId && !audio) {
      setError('Hãy chọn file nhạc để AI nghe và ghép lời.');
      return;
    }
    if (new TextEncoder().encode(content).length > 32 * 1024) {
      setError('AI hỗ trợ tối đa 32 KB lời bài hát.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    onBusyChange?.(true);
    setResult(null);
    setOriginal(null);
    setMessage(
      trackId ? 'Đang khởi động AI cục bộ…' : 'Đang gửi file tới máy chủ SPMusic trên máy của bạn…',
    );
    try {
      let data;
      if (trackId) {
        data = await api(`/tracks/${trackId}/lyrics/align`, {
          method: 'POST',
          body: { content, language },
          signal: controller.signal,
        });
      } else {
        const form = new FormData();
        form.append('audio', audio);
        form.append('content', content);
        form.append('language', language);
        const response = await fetch('/api/lyrics/align', {
          method: 'POST',
          body: form,
          credentials: 'same-origin',
          signal: controller.signal,
        });
        data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Không gửi được file cho AI.');
      }
      jobId.current = data.job.id;
      // If cancelled while the POST completed, also stop its background worker.
      if (controller.signal.aborted || !mounted.current) {
        await api(`/lyrics/align/${data.job.id}`, { method: 'DELETE' });
        return;
      }
      let job = data.job;
      while (job.status === 'running') {
        if (mounted.current) setMessage(job.message || 'AI đang xử lý…');
        await new Promise((resolve, reject) => {
          const stop = () => {
            clearTimeout(timer);
            reject(new DOMException('Cancelled', 'AbortError'));
          };
          const timer = setTimeout(() => {
            controller.signal.removeEventListener('abort', stop);
            resolve();
          }, 1000);
          controller.signal.addEventListener('abort', stop, { once: true });
          if (controller.signal.aborted) stop();
        });
        job = (await api(`/lyrics/align/${data.job.id}`, { signal: controller.signal })).job;
      }
      if (job.status === 'failed') throw new Error(job.error || 'Không căn được lời bài hát.');
      if (job.status === 'completed' && mounted.current) {
        setResult(job.result);
        setRows(job.result.lines.map((line) => ({ ...line, time: timeLabel(line.start) })));
        setMessage('Đã có gợi ý. Kiểm tra mốc thời gian rồi áp dụng vào lyrics.');
      }
    } catch (e) {
      if (mounted.current) {
        if (e.name === 'AbortError')
          setMessage('Đã hủy căn lời. Nội dung bạn dán vẫn được giữ lại.');
        else setError(e.message || 'AI chưa xử lý được bài hát này.');
      }
    } finally {
      jobId.current = null;
      if (mounted.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }
  const times = rows.map((row) => timeValue(row.time));
  const canApply =
    Boolean(result) &&
    rows.length > 0 &&
    times.every(
      (time, index) =>
        Number.isFinite(time) &&
        time >= 0 &&
        time <= result.duration &&
        (!index || time >= times[index - 1]),
    );
  function apply() {
    setOriginal(content);
    onChange(rows.map((row, index) => `[${timeLabel(times[index])}] ${row.text}`).join('\n'));
    setResult(null);
    setMessage('Đã đưa mốc AI vào ô lyrics. Bấm lưu để cập nhật bài hát.');
  }
  return (
    <section className="lyrics-ai" aria-label="AI căn thời gian lời bài hát">
      <div className="lyrics-ai-toolbar">
        <label>
          <span>Ngôn ngữ giọng hát</span>
          <select
            aria-label="Ngôn ngữ giọng hát"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={disabled || busy}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="auto">Tự nhận diện</option>
            <option value="en">Tiếng Anh</option>
            <option value="ja">Tiếng Nhật</option>
            <option value="ko">Tiếng Hàn</option>
            <option value="zh">Tiếng Trung</option>
            <option value="fr">Tiếng Pháp</option>
            <option value="de">Tiếng Đức</option>
            <option value="es">Tiếng Tây Ban Nha</option>
          </select>
        </label>
        <button
          type="button"
          className="form-secondary"
          disabled={disabled || busy || !content.trim()}
          onClick={start}
        >
          {busy ? <LoaderCircle size={16} className="spinning" /> : <Sparkles size={16} />}
          {busy ? 'AI đang căn lời…' : 'AI căn thời gian'}
        </button>
        {busy && (
          <button type="button" className="form-text-button" onClick={cancel}>
            <X size={15} />
            Hủy AI
          </button>
        )}
        {original !== null && !busy && (
          <button
            type="button"
            className="form-text-button"
            disabled={disabled}
            onClick={() => {
              onChange(original);
              setOriginal(null);
              setMessage('Đã khôi phục lời trước khi áp dụng AI.');
            }}
          >
            <Undo2 size={15} />
            Hoàn tác AI
          </button>
        )}
      </div>
      <p className="field-hint">
        Dán lời chưa có thời gian, mỗi câu một dòng. AI chạy trên máy của bạn; lần đầu tải mô hình.
        Bài tối đa 15 phút.
      </p>
      {message && (
        <p className="ai-status" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="ai-review">
          <strong>
            Ghép được {result.matchedLines}/{result.totalLines} câu
          </strong>
          <p className="field-hint">{result.warning} Ô trống cần nhập theo mẫu 00:12.50.</p>
          <div className="ai-review-lines">
            {rows.map((row, index) => (
              <div
                className={`ai-review-line ${row.start === null || row.confidence < 75 ? 'ai-uncertain' : ''}`}
                key={index}
              >
                <input
                  type="text"
                  aria-label={`Mốc thời gian câu ${index + 1}`}
                  placeholder="00:12.50"
                  value={row.time}
                  onChange={(e) =>
                    setRows((previous) =>
                      previous.map((item, i) =>
                        i === index ? { ...item, time: e.target.value } : item,
                      ),
                    )
                  }
                />
                <span>
                  {row.text}
                  {row.start === null
                    ? ' · Chưa ghép được'
                    : row.confidence < 75
                      ? ' · Cần nghe lại'
                      : ''}
                </span>
              </div>
            ))}
          </div>
          {!canApply && (
            <p className="field-hint">
              Điền đủ mốc theo thứ tự tăng dần, trong thời lượng bài hát để áp dụng.
            </p>
          )}
          <button
            type="button"
            className="form-primary"
            disabled={!canApply || disabled}
            onClick={apply}
          >
            Áp dụng LRC
          </button>
        </div>
      )}
    </section>
  );
}

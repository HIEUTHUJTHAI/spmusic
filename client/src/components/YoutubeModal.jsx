import { useEffect, useRef, useState } from 'react';
import { Link2, LoaderCircle } from 'lucide-react';
import Modal from './Modal';
import { api } from '../lib/api';
import './forms.css';

const finished = (status) => ['completed', 'failed', 'cancelled'].includes(status);

export default function YoutubeModal({ open, onClose, onImported, initialUrl }) {
  const [url, setUrl] = useState('');
  const [licensed, setLicensed] = useState(false);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState([]);
  const [results, setResults] = useState([]);
  const imported = useRef(null);
  const onImportedRef = useRef(onImported);
  onImportedRef.current = onImported;
  const working = job && !finished(job.status);

  useEffect(() => {
    if (open && initialUrl) { setUrl(initialUrl); setLicensed(false); setError(''); }
  }, [open, initialUrl]);

  useEffect(() => {
    const controller = new AbortController();
    api('/youtube/jobs/active', { signal: controller.signal })
      .then(({ job }) => setJob(job))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (job?.status === 'completed' && imported.current !== job.id) {
      imported.current = job.id;
      onImportedRef.current?.(job.track, job.existing);
    }
    if (!job || finished(job.status)) return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const next = await api(`/youtube/jobs/${job.id}`, { signal: controller.signal });
        setJob(next.job);
        if (finished(next.job.status)) return;
      } catch {
        if (controller.signal.aborted) return;
        setError('Mất kết nối khi theo dõi tải nhạc. Đang thử lại…');
      }
      timer = setTimeout(poll, 1200);
    }
    timer = setTimeout(poll, 700);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (!job || !finished(job.status)) return;
    setResults((items) => items.some((item) => item.id === job.id) ? items : [...items, job]);
    if (!pending.length || busy) return;
    let cancelled = false;
    setBusy(true);
    api('/youtube/jobs', { method: 'POST', body: { url: pending[0], licensed: true } })
      .then(({ job: next }) => { if (!cancelled) { setBusy(false); setPending((items) => items.slice(1)); setJob(next); } })
      .catch((e) => { if (!cancelled) { setBusy(false); setPending([]); setError(e.message); } });
    return () => { cancelled = true; };
  }, [job?.id, job?.status, pending.length]);

  async function start(event) {
    event.preventDefault();
    setError('');
    if (!licensed) { setError('Hãy xác nhận bạn có quyền tải video này.'); return; }
    const links = [...new Set(url.split(/[\s,]+/).filter(Boolean))];
    if (!links.length || links.length > 20) { setError('Hãy nhập từ 1 đến 20 link.'); return; }
    if (links.some((link) => { try { const value = new URL(link); return !['https:', 'http:'].includes(value.protocol); } catch { return true; } })) { setError('Có link không hợp lệ. Hãy kiểm tra từng link.'); return; }
    setBusy(true);
    setResults([]);
    try {
      const result = await api('/youtube/jobs', { method: 'POST', body: { url: links[0], licensed: true } });
      setPending(links.slice(1));
      setJob(result.job);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <Modal title="Tải nhạc offline" onClose={onClose}>
      <form className="modal-stack" onSubmit={start}>
        <p className="form-description">
          Dán một hoặc nhiều link video công khai, mỗi link một dòng. SPMusic chọn âm thanh tốt nhất có sẵn và lưu thành MP3
          trong thư viện của bạn. Bài đã lưu Online sẽ được chuyển sang bản offline, giữ nguyên playlist và thông tin đã chỉnh. Chuyển sang MP3 không làm tăng chất lượng của nguồn.
        </p>
        <label className="form-label">
          Link video YouTube
          <textarea required maxLength={12000} value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..." disabled={!!working || busy} />
        </label>
        <label className="license-checkbox">
          <input type="checkbox" checked={licensed} disabled={!!working || busy}
            onChange={(event) => setLicensed(event.target.checked)} />
          <span>Tôi sở hữu video này hoặc được phép tải và sử dụng âm thanh của video.</span>
        </label>
        <p className="field-hint">Tối đa 20 link, tải lần lượt · Mỗi video tối đa 3 giờ và 250 MB · Cần kết nối Internet. Giữ app mở đến khi hoàn tất.</p>
        <button className="form-primary" type="submit" disabled={!!working || busy}>
          {busy ? <LoaderCircle size={16} className="spinning" /> : <Link2 size={16} />}
          {busy ? 'Đang bắt đầu…' : 'Tải để nghe offline'}
        </button>
      </form>
      {job && <div className={`import-status ${job.status}`} role="status">
        <div>
          <strong>{working && <LoaderCircle size={15} className="spinning" />} {job.message}</strong>
          {working && <button className="form-text-button" disabled={job.status === 'saving'}
            onClick={async () => {
              try { setPending([]); setJob((await api(`/youtube/jobs/${job.id}`, { method: 'DELETE' })).job); }
              catch (e) { setError(e.message); }
            }}>Hủy tải</button>}
        </div>
        {working && <><progress max="100" value={job.progress} />
          <small>{job.progress}% · Có thể đóng cửa sổ này, app vẫn tiếp tục tải.</small></>}
        {job.track && <p className="field-hint">{job.track.title} · {job.track.artist}</p>}
      </div>}
      {(pending.length > 0 || results.length > 0) && <p className="field-hint" role="status">Đã xử lý {results.length} · Còn chờ {pending.length} link. {results.filter((item) => item.status === 'failed').length > 0 && `Thất bại: ${results.filter((item) => item.status === 'failed').length}.`}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  );
}

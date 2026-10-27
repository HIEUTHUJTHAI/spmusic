import { useEffect, useRef, useState } from 'react';
import { Link2, LoaderCircle } from 'lucide-react';
import Modal from './Modal';
import { api } from '../lib/api';
import './forms.css';

const finished = (status) => ['completed', 'failed', 'cancelled'].includes(status);

export default function YoutubeModal({ open, onClose, onImported }) {
  const [url, setUrl] = useState('');
  const [licensed, setLicensed] = useState(false);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const imported = useRef(null);
  const onImportedRef = useRef(onImported);
  onImportedRef.current = onImported;
  const working = job && !finished(job.status);

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

  async function start(event) {
    event.preventDefault();
    setError('');
    if (!licensed) { setError('Hãy xác nhận bạn có quyền tải video này.'); return; }
    setBusy(true);
    try {
      const result = await api('/youtube/jobs', { method: 'POST', body: { url, licensed: true } });
      setJob(result.job);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <Modal title="Thêm nhạc từ link YouTube" onClose={onClose}>
      <form className="modal-stack" onSubmit={start}>
        <p className="form-description">
          Dán link một video công khai. SPMusic chọn âm thanh tốt nhất có sẵn và lưu thành MP3
          trong thư viện của bạn. Chuyển sang MP3 không làm tăng chất lượng của nguồn.
        </p>
        <label className="form-label">
          Link video YouTube
          <input type="url" required maxLength={600} value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..." disabled={!!working || busy} />
        </label>
        <label className="license-checkbox">
          <input type="checkbox" checked={licensed} disabled={!!working || busy}
            onChange={(event) => setLicensed(event.target.checked)} />
          <span>Tôi sở hữu video này hoặc được phép tải và sử dụng âm thanh của video.</span>
        </label>
        <p className="field-hint">Một video mỗi lượt · Tối đa 3 giờ và 250 MB · Cần kết nối Internet.</p>
        <button className="form-primary" type="submit" disabled={!!working || busy}>
          {busy ? <LoaderCircle size={16} className="spinning" /> : <Link2 size={16} />}
          {busy ? 'Đang bắt đầu…' : 'Tải MP3 vào thư viện'}
        </button>
      </form>
      {job && <div className={`import-status ${job.status}`} role="status">
        <div>
          <strong>{working && <LoaderCircle size={15} className="spinning" />} {job.message}</strong>
          {working && <button className="form-text-button" disabled={job.status === 'saving'}
            onClick={async () => {
              try { setJob((await api(`/youtube/jobs/${job.id}`, { method: 'DELETE' })).job); }
              catch (e) { setError(e.message); }
            }}>Hủy tải</button>}
        </div>
        {working && <><progress max="100" value={job.progress} />
          <small>{job.progress}% · Có thể đóng cửa sổ này, app vẫn tiếp tục tải.</small></>}
        {job.track && <p className="field-hint">{job.track.title} · {job.track.artist}</p>}
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Modal>
  );
}

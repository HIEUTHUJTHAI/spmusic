import { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, Headphones, LoaderCircle } from 'lucide-react';
import { api, upload } from '../lib/api';
import './DiscoverMusic.css';

export default function DiscoverMusic({ query, user, onLogin, onImported, notify }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setLoading(false); setError(''); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      api(`/discover/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((data) => setResults(data.results || []))
        .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  async function save(result) {
    if (!user) { onLogin(); return; }
    setSaving(result.id);
    setProgress(0);
    try {
      const response = await fetch(result.audioUrl);
      if (!response.ok) throw new Error('Không thể lấy file nhạc từ nguồn này.');
      const blob = await response.blob();
      if (!blob.size || blob.size > 50 * 1024 * 1024) throw new Error('File vượt giới hạn 50 MB.');
      const form = new FormData();
      form.append('audio', new File([blob], result.filename, { type: blob.type || 'application/octet-stream' }));
      form.append('title', result.title);
      form.append('artist', result.artist);
      form.append('album', result.album || '');
      form.append('archiveId', result.id);
      form.append('archiveFile', result.filename);
      await upload('/tracks', form, setProgress);
      await onImported();
      notify('Đã thêm bài hát vào thư viện.');
    } catch (reason) { notify(reason.message || 'Không thể tải bài hát.'); }
    finally { setSaving(null); setProgress(0); }
  }

  return <section className="discover-music" aria-label="Tìm nhạc từ nguồn mở">
    <div className="discover-heading">
      <div><h2>Khám phá nguồn nhạc mở</h2><p>Nghe thử trước khi lưu vào thư viện. Nguồn thử nghiệm: Internet Archive.</p></div>
      <Headphones size={21} />
    </div>
    {query.trim().length < 2 ? <p className="discover-message">Nhập ít nhất hai ký tự vào ô tìm kiếm phía trên.</p>
      : loading ? <p className="discover-message"><LoaderCircle size={16} className="spin" /> Đang tìm các bản có giấy phép rõ ràng…</p>
      : error ? <p className="discover-message" role="alert">{error}</p>
      : !results.length ? <p className="discover-message">Chưa tìm thấy bản có thể nghe thử và tải hợp lệ.</p>
      : <div className="discover-results">{results.map((result) => <article className="discover-result" key={result.id}>
          <div className="discover-result-info">
            <strong>{result.title}</strong><span>{result.artist}{result.album ? ` · ${result.album}` : ''}</span>
            <small>{result.provider} · {result.format} · {(result.bytes / 1024 / 1024).toFixed(1)} MB</small>
          </div>
          <div className="discover-result-actions">
            <button onClick={() => setPreview(preview === result.id ? null : result.id)}>
              {preview === result.id ? 'Đóng nghe thử' : 'Nghe thử'}
            </button>
            <button onClick={() => save(result)} disabled={!!saving}>
              {saving === result.id ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}
              {saving === result.id ? (progress ? `Đang lưu ${progress}%` : 'Đang tải…') : 'Tải vào thư viện'}
            </button>
            <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" title="Xem trang nguồn" aria-label="Xem trang nguồn"><ExternalLink size={16} /></a>
          </div>
          {preview === result.id && <audio ref={audioRef} controls autoPlay preload="none" src={result.audioUrl} aria-label={`Nghe thử ${result.title}`} />}
          <a className="discover-license" href={result.licenseUrl} target="_blank" rel="noopener noreferrer">Xem giấy phép của bản này</a>
        </article>)}</div>}
  </section>;
}

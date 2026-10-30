import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Headphones, LoaderCircle } from 'lucide-react';
import { api, upload } from '../lib/api';
import './DiscoverMusic.css';

export default function DiscoverMusic({ query, user, onLogin, onImported, notify }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(null);
  const [progress, setProgress] = useState(0);
  const [source, setSource] = useState('open');
  const [copied, setCopied] = useState(null);
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [youtubeConfigured, setYoutubeConfigured] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setLoading(false); setError(''); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError('');
      api(`/discover/${source === 'youtube' ? 'youtube' : 'search'}?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then((data) => {
          if (source === 'youtube') { setYoutubeResults(data.results || []); setYoutubeConfigured(data.configured); }
          else setResults(data.results || []);
        })
        .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, source]);

  async function copyLink(result) {
    try {
      await navigator.clipboard.writeText(result.sourceUrl);
      setCopied(result.id);
      setTimeout(() => setCopied(null), 1800);
    } catch { notify('Không thể sao chép link. Hãy mở video rồi sao chép link trên thanh địa chỉ.'); }
  }

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

  const visibleResults = source === 'youtube' ? youtubeResults : results;
  return <section className="discover-music" aria-label="Khám phá nhạc">
    <div className="discover-heading">
      <div><h2>Khám phá nhạc</h2><p>Tìm và nghe thử trong app; YouTube chỉ mở trình phát chính thức.</p></div>
      <Headphones size={21} />
    </div>
    <div className="discover-source-tabs">
      <button className={source === 'open' ? 'selected' : ''} onClick={() => { setSource('open'); setPreview(null); }}>Nguồn mở · tải được</button>
      <button className={source === 'youtube' ? 'selected' : ''} onClick={() => { setSource('youtube'); setPreview(null); }}>YouTube · xem thử</button>
    </div>
    {query.trim().length < 2 ? <p className="discover-message">Nhập ít nhất hai ký tự vào ô tìm kiếm phía trên.</p>
      : loading ? <p className="discover-message"><LoaderCircle size={16} className="spin" /> Đang tìm các bản có giấy phép rõ ràng…</p>
      : error ? <p className="discover-message" role="alert">{error}</p>
      : source === 'youtube' && !youtubeConfigured ? <p className="discover-message">Cần YouTube Data API key để tìm video. Bản Windows đọc khóa từ %APPDATA%\SPMusic\data\youtube-api-key.txt. App không tải âm thanh YouTube.</p>
      : !visibleResults.length ? <p className="discover-message">{source === 'youtube' ? 'Không tìm thấy video phù hợp.' : 'Chưa tìm thấy bản có thể nghe thử và tải hợp lệ.'}</p>
      : <div className="discover-results">{visibleResults.map((result) => <article className="discover-result" key={result.id}>
          <div className="discover-result-info">
            {source === 'youtube' && result.thumbnail && <img className="youtube-thumbnail" src={result.thumbnail} alt="" />}
            <strong>{result.title}</strong><span>{result.artist}{result.album ? ` · ${result.album}` : ''}</span>
            <small>{source === 'youtube' ? 'YouTube · phát thử chính thức' : `${result.provider} · ${result.format} · ${(result.bytes / 1024 / 1024).toFixed(1)} MB`}</small>
          </div>
          <div className="discover-result-actions">
            {source === 'open' && <button onClick={() => setPreview(preview === result.id ? null : result.id)}>{preview === result.id ? 'Đóng nghe thử' : 'Nghe thử'}</button>}
            {source === 'open' && <button onClick={() => save(result)} disabled={!!saving}>
              {saving === result.id ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}
              {saving === result.id ? (progress ? `Đang lưu ${progress}%` : 'Đang tải…') : 'Tải vào thư viện'}
            </button>}
            {source === 'youtube' && <button onClick={() => setPreview(preview === result.id ? null : result.id)}>{preview === result.id ? 'Đóng xem thử' : 'Xem thử'}</button>}
            {source === 'youtube' && <button onClick={() => copyLink(result)}>{copied === result.id ? <Check size={15} /> : <Copy size={15} />}{copied === result.id ? 'Đã sao chép' : 'Sao chép link'}</button>}
            <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" title="Xem trang nguồn" aria-label="Xem trang nguồn"><ExternalLink size={16} /></a>
          </div>
          {preview === result.id && (source === 'youtube'
            ? <iframe className="youtube-preview" src={result.embedUrl} title={`Xem thử ${result.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
            : <audio ref={audioRef} controls autoPlay preload="none" src={result.audioUrl} aria-label={`Nghe thử ${result.title}`} />)}
          {source === 'open' && <a className="discover-license" href={result.licenseUrl} target="_blank" rel="noopener noreferrer">Xem giấy phép của bản này</a>}
        </article>)}</div>}
  </section>;
}

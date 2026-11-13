import { useEffect, useState } from 'react';
import { Check, Plus, Play, Eye, X, Download, Headphones, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api';
import './DiscoverMusic.css';

export default function DiscoverMusic({ query, user, onLogin, onImported, notify, onPlayOnline, onYoutubeImport }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(null);
  const [saved, setSaved] = useState({});
  const [configured, setConfigured] = useState(true);
  useEffect(() => {
    const term = query.trim();
    setResults([]); setError(''); setPreview(null);
    if (term.length < 2) { setLoading(false); return; }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(`/discover/youtube?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then(data => { if (!controller.signal.aborted) { setResults(data.results || []); setConfigured(data.configured); } })
        .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  async function add(result, play) {
    if (!user) return onLogin();
    setSaving(result.id);
    try {
      const data = await api('/tracks/online', { method: 'POST', body: { url: result.sourceUrl, title: result.title, artist: result.artist } });
      await onImported();
      setSaved(previous => ({ ...previous, [result.id]: true }));
      if (play) { setPreview(null); onPlayOnline(data.track); }
      notify(data.existing ? 'Bài đã có trong thư viện.' : 'Đã thêm bài Online. Cần Internet để nghe.');
    } catch (reason) { notify(reason.message); }
    finally { setSaving(null); }
  }
  return <section className="discover-music" aria-label="Nhạc trực tuyến">
    <div className="discover-heading"><div><h2>Nhạc trực tuyến</h2><p>Tìm trên YouTube · Thêm vào thư viện để nghe online, không tải file về máy.</p></div><Headphones size={21} /></div>
    {query.trim().length < 2 ? <p className="discover-message">Nhập tên bài hát hoặc nghệ sĩ phía trên.</p>
      : loading ? <p className="discover-message"><LoaderCircle size={16} className="spin" /> Đang tìm nhạc…</p>
      : error ? <p className="discover-message" role="alert">{error}</p>
      : !configured ? <p className="discover-message">Mở Cài đặt → YouTube API để lưu khóa tìm kiếm của bạn.</p>
      : !results.length ? <p className="discover-message">Không tìm thấy bài phù hợp.</p>
      : <div className="discover-results">{results.map(result => <article className="discover-result" key={result.id}>
        <div className="discover-result-info">
          {result.thumbnail && <img className="youtube-thumbnail" src={result.thumbnail} alt="" />}
          <strong>{result.title}</strong><span>{result.artist}</span><small>YouTube · Online</small>
        </div>
        <div className="discover-result-actions">
          <button title={preview === result.id ? 'Đóng xem thử' : 'Xem thử'} aria-label={preview === result.id ? 'Đóng xem thử' : 'Xem thử'} aria-pressed={preview === result.id} onClick={() => setPreview(preview === result.id ? null : result.id)}>{preview === result.id ? <X size={17} /> : <Eye size={17} />}</button>
          <button title={saved[result.id] ? 'Đã thêm thư viện' : 'Thêm thư viện'} aria-label="Thêm thư viện" disabled={!!saving} onClick={() => add(result, false)}>{saving === result.id ? <LoaderCircle size={15} className="spin" /> : saved[result.id] ? <Check size={15} /> : <Plus size={15} />}</button>
          <button title="Nghe ngay" aria-label="Nghe ngay" disabled={!!saving} onClick={() => add(result, true)}><Play size={17} /></button>
          <button className="discover-offline" onClick={() => user ? onYoutubeImport(result.sourceUrl) : onLogin()} title="Tải offline" aria-label="Tải offline"><Download size={17} /></button>
        </div>
        {preview === result.id && <iframe className="youtube-preview" src={result.embedUrl} title={result.title} allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}
      </article>)}</div>}
  </section>;
}

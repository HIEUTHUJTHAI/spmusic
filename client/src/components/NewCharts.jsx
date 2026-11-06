import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Play, Plus } from 'lucide-react';
import { api } from '../lib/api';
import './NewCharts.css';

const regions = [
  ['INTL', 'Quốc tế', '#ed8fba', '#7c8edc'],
  ['VN', 'Việt Nam', '#ff786e', '#f4b158'], ['US', 'Hoa Kỳ', '#6684d7', '#c885be'],
  ['GB', 'Anh', '#8e7bca', '#7aafd5'], ['KR', 'Hàn Quốc', '#ed90ad', '#9f90d4'],
  ['JP', 'Nhật Bản', '#d98b98', '#eeaf8c'], ['CA', 'Canada', '#d47f87', '#e8aa9b'],
];
export default function NewCharts({ onImport }) {
  const [region, setRegion] = useState(null), [data, setData] = useState(null), [error, setError] = useState(''), [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!region) return undefined;
    const controller = new AbortController();
    setData(null); setError(''); setPreview(null);
    api(`/discover/youtube-chart?region=${region}`, { signal: controller.signal }).then(setData).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [region]);
  const name = regions.find(([id]) => id === region)?.[1];
  return <section className="new-charts">
    <p className="eyebrow">KHÁM PHÁ ÂM NHẠC</p><h1>New<span className="title-dot">.</span></h1>
    {!region ? <><p>Những video âm nhạc phổ biến trên YouTube, chọn lọc theo từng khu vực.</p><h2>Âm nhạc khắp nơi</h2><div className="new-chart-grid">
      {regions.map(([id, title, a, b]) => <button key={id} className="new-chart-card" onClick={() => setRegion(id)} aria-label={`Xem video âm nhạc phổ biến tại ${title}`}>
        <span className="new-chart-cover" style={{ '--chart-a': a, '--chart-b': b }}><span className="new-chart-cover-top"><small>THE MUSIC INDEX</small><small>SPMUSIC / {id}</small></span><strong>{title}</strong><span className="new-chart-art" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span><span className="new-chart-cover-foot">YOUTUBE · MUSIC VIDEOS <b>↗</b></span></span>
        <strong>{title}</strong><small>{id === 'INTL' ? 'Tổng hợp 6 quốc gia · SPMusic' : 'Video phổ biến · YouTube'}</small>
      </button>)}
    </div><p className="new-chart-note">Dữ liệu video phổ biến do YouTube cung cấp, không phải bảng xếp hạng bài hát chính thức.</p></> : <>
      <button className="new-chart-back" onClick={() => setRegion(null)}><ArrowLeft size={16} /> Tất cả quốc gia</button>
      <h2>Âm nhạc phổ biến · {name}</h2><p>{region === 'INTL' ? 'SPMusic tổng hợp video từ Việt Nam, Mỹ, Anh, Hàn Quốc, Nhật Bản và Canada; ưu tiên video xuất hiện ở nhiều bảng và vị trí cao. Đây không phải BXH toàn cầu chính thức.' : 'Thứ tự do YouTube cung cấp · Không phải bảng xếp hạng bài hát chính thức.'}</p>
      {error ? <p role="alert">{error}</p> : !data ? <p role="status">Đang tải danh sách…</p> : !data.configured ? <p>Hãy thêm YouTube API key trong Cài đặt để xem danh sách này.</p> : !data.results.length ? <p>Chưa có video phổ biến cho khu vực này.</p> : <div className="new-chart-list">{data.results.map((video, i) => <article key={video.id} className="new-chart-row">
        <span className="new-chart-rank">{String(i + 1).padStart(2, '0')}</span>{video.thumbnail && <img src={video.thumbnail} alt="" />}
        <div className="new-chart-info"><strong>{video.title}</strong><span>{video.artist}{region === 'INTL' ? ` · Có mặt ở ${video.appearances}/6 quốc gia` : ''}{video.views ? ` · ${Number(video.views).toLocaleString('vi-VN')} lượt xem` : ''}</span></div>
        <button onClick={() => setPreview(preview === video.id ? null : video.id)} aria-label={`Xem thử ${video.title}`}><Play size={16} /></button>
        <button onClick={() => onImport(`https://www.youtube.com/watch?v=${video.id}`)} aria-label={`Thêm ${video.title} vào thư viện`}><Plus size={17} /></button>
        <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Mở ${video.title} trên YouTube`}><ExternalLink size={16} /></a>
        {preview === video.id && <iframe className="new-chart-preview" title={`Xem thử ${video.title}`} src={`https://www.youtube-nocookie.com/embed/${video.id}`} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />}
      </article>)}</div>}
    </>}
  </section>;
}

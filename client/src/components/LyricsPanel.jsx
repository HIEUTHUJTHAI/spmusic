import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignLeft, Pencil, X, Music2, LoaderCircle } from 'lucide-react';
import { api } from '../lib/api';
import { activeLineIndex, parseLrc } from '../lib/lrc';
import './forms.css';

export default function LyricsPanel({
  track,
  currentTime = 0,
  onSeek,
  onClose,
  canEdit,
  onEditLyrics,
}) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const activeRef = useRef(null);
  const scrollRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setContent('');
    setError('');
    if (!track?.id || !track.hasLyrics) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api(`/tracks/${track.id}/lyrics`)
      .then((data) => {
        if (!cancelled) setContent(data.content || '');
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [track?.id, track?.hasLyrics]);
  const lines = useMemo(() => parseLrc(content), [content]);
  const active = activeLineIndex(lines, currentTime);
  useEffect(() => {
    const container = scrollRef.current;
    const line = activeRef.current;
    if (!container || !line) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const position = line.offsetTop - container.offsetTop - container.clientHeight * 0.38;
    container.scrollTo({ top: position, behavior: reduced ? 'auto' : 'smooth' });
  }, [active, track?.id]);
  return (
    <aside className="lyrics-panel" aria-label="Lyrics đồng bộ">
      <header className="lyrics-panel-header">
        <div>
          <AlignLeft size={17} />
          <h2>Lời bài hát</h2>
          <span>ĐỒNG BỘ</span>
        </div>
        <button
          type="button"
          className="form-icon-button"
          onClick={onClose}
          aria-label="Đóng lời bài hát"
        >
          <X size={19} />
        </button>
      </header>
      {track && (
        <div className="lyrics-track">
          <img src={track.coverUrl} alt="" />
          <div>
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </div>
          {canEdit && (
            <button
              type="button"
              className="form-icon-button"
              onClick={onEditLyrics}
              aria-label="Chỉnh sửa lyrics"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      )}
      {loading ? (
        <div className="lyrics-empty">
          <LoaderCircle size={28} className="spinning" />
          <p>Đang mở lời bài hát…</p>
        </div>
      ) : error ? (
        <div className="lyrics-empty" role="alert">
          <Music2 size={30} />
          <strong>Chưa thể tải lyrics</strong>
          <p>{error}</p>
        </div>
      ) : !lines.length ? (
        <div className="lyrics-empty">
          <span className="lyrics-empty-icon">
            <Music2 size={35} />
          </span>
          <strong>{track ? 'Để giai điệu lên tiếng.' : 'Chọn một bài hát để bắt đầu'}</strong>
          <p>
            {track
              ? 'Bài hát này chưa có lyrics đồng bộ.'
              : 'Lyrics sẽ xuất hiện ở đây khi bạn phát nhạc.'}
          </p>
          {track && canEdit && (
            <button type="button" className="form-secondary" onClick={onEditLyrics}>
              <Pencil size={15} />
              Thêm lyrics LRC
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="lyrics-instruction">Chạm vào một dòng để tua đến đoạn đó</p>
          <div
            className="lyrics-lines"
            ref={scrollRef}
            tabIndex={0}
            aria-label="Các dòng lời bài hát"
          >
            {lines.map((line, index) => (
              <button
                key={`${line.time}-${index}`}
                type="button"
                ref={index === active ? activeRef : undefined}
                className={`lyric-line ${index === active ? 'active' : ''} ${index < active ? 'played' : ''}`}
                onClick={() => onSeek?.(line.time)}
                aria-current={index === active ? 'true' : undefined}
              >
                <span>{line.text || '♪'}</span>
              </button>
            ))}
          </div>
          <footer className="lyrics-panel-footer">
            <span className="lyrics-sync-dot" />
            Từng câu hát, đúng khoảnh khắc.
          </footer>
        </>
      )}
    </aside>
  );
}

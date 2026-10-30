import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, Heart, ListMusic, Mic2, Music2, Pause, Play, Repeat,
  Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX,
} from 'lucide-react';
import { api } from '../lib/api';
import { activeLineIndex, parseLrc } from '../lib/lrc';
import { formatTime } from './Player';
import './ExpandedPlayer.css';
import InstrumentalButton from './InstrumentalButton';

export default function ExpandedPlayer({ p, tracks, liked, onLike, onClose }) {
  const [tab, setTab] = useState('player');
  const [lyrics, setLyrics] = useState('');
  const [lyricsError, setLyricsError] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const activeRef = useRef(null);
  const scrollRef = useRef(null);
  const cover = p.track?.coverUrl || '/covers/fallback.svg';
  const lines = useMemo(() => parseLrc(lyrics), [lyrics]);
  const active = activeLineIndex(lines, p.time);
  const nextTracks = p.queue.slice(Math.max(0, p.queue.indexOf(p.trackId) + 1))
    .map((id) => tracks.find((item) => item.id === id)).filter(Boolean);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLyrics('');
    setLyricsError('');
    if (!p.track?.hasLyrics) {
      setLyricsLoading(false);
      return;
    }
    setLyricsLoading(true);
    api(`/tracks/${p.track.id}/lyrics`)
      .then((data) => { if (!cancelled) setLyrics(data.content || ''); })
      .catch((error) => { if (!cancelled) setLyricsError(error.message); })
      .finally(() => { if (!cancelled) setLyricsLoading(false); });
    return () => { cancelled = true; };
  }, [p.track?.id, p.track?.hasLyrics]);

  useEffect(() => {
    if (tab !== 'lyrics' || !activeRef.current || !scrollRef.current) return;
    activeRef.current.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [active, tab]);

  return (
    <section className="expanded-player" role="dialog" aria-modal="true" aria-label="Trình phát toàn màn hình">
      <div className="expanded-backdrop" style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />
      <header className="expanded-header">
        <button className="expanded-dismiss" onClick={onClose} aria-label="Thu nhỏ trình phát" title="Thu nhỏ (Esc)" autoFocus>
          <ChevronDown size={26} />
        </button>
        <span>SPMusic <small>ĐANG PHÁT</small></span>
        <div aria-hidden="true" />
      </header>
      <div className="expanded-content">
        <div className="expanded-artwork">
          <img src={cover} alt={`Ảnh bìa ${p.track?.title || ''}`} />
        </div>
        <div className="expanded-details">
          <div className="expanded-track-heading">
            <div>
              <h1>{p.track?.title || 'Chọn một bài hát'}</h1>
              <p>{p.track?.artist || 'SPMusic'}</p>
              {p.track?.album && <small>{p.track.album}</small>}
            </div>
            <button className={`expanded-icon ${liked ? 'is-on' : ''}`} onClick={onLike}
              disabled={!p.track} aria-label="Yêu thích" aria-pressed={liked}>
              <Heart size={25} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>

          {tab === 'lyrics' && (
            <div className="expanded-lyrics" ref={scrollRef} aria-label="Lời bài hát đồng bộ">
              {lyricsLoading ? <p className="expanded-empty">Đang tải lời bài hát…</p>
                : lyricsError ? <p className="expanded-empty" role="alert">{lyricsError}</p>
                : !lines.length ? <p className="expanded-empty">Bài hát này chưa có lyrics đồng bộ.</p>
                : lines.map((line, index) => (
                  <button key={`${line.time}-${index}`} ref={index === active ? activeRef : undefined}
                    className={`expanded-lyric-line ${index === active ? 'active' : ''}`}
                    onClick={() => p.seek(line.time)} aria-current={index === active ? 'true' : undefined}>
                    {line.text || '♪'}
                  </button>
                ))}
            </div>
          )}

          {tab === 'lyrics' && <div className="expanded-instrumental"><InstrumentalButton p={p} /></div>}
          {tab === 'queue' && (
            <div className="expanded-queue">
              <div className="expanded-queue-modes">
                <button className={p.shuffle ? 'active' : ''} onClick={() => p.setShuffle(!p.shuffle)}
                  aria-label="Phát ngẫu nhiên" aria-pressed={p.shuffle}><Shuffle size={19} /></button>
                <button className={p.repeat !== 'off' ? 'active' : ''}
                  onClick={() => p.setRepeat(p.repeat === 'off' ? 'all' : p.repeat === 'all' ? 'one' : 'off')}
                  aria-label={`Lặp lại: ${p.repeat === 'off' ? 'tắt' : p.repeat === 'all' ? 'tất cả' : 'một bài'}`}>
                  {p.repeat === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}
                </button>
                <span>Tiếp tục phát</span>
              </div>
              {nextTracks.length ? nextTracks.map((track) => (
                <button className="expanded-queue-item" key={track.id} onClick={() => p.play(track)}>
                  <img src={track.coverUrl || '/covers/fallback.svg'} alt="" />
                  <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                  <Play size={17} />
                </button>
              )) : <p className="expanded-empty">Chưa có bài hát tiếp theo.</p>}
            </div>
          )}

          {tab === 'player' && <div className="expanded-controls">
            <div className="expanded-progress">
              <input aria-label="Tua nhạc toàn màn hình" type="range" min="0" max={p.duration || 1}
                step="0.1" value={Math.min(p.time, p.duration || 1)}
                onChange={(event) => p.seek(Number(event.target.value))}
                style={{ '--range': `${p.duration ? (p.time / p.duration) * 100 : 0}%` }} />
              <div><span>{formatTime(p.time)}</span><span>-{formatTime(Math.max(0, p.duration - p.time))}</span></div>
            </div>
            <div className="expanded-transport">
              <button onClick={p.previous} aria-label="Bài trước"><SkipBack size={32} fill="currentColor" /></button>
              <button className="expanded-play" onClick={p.toggle} aria-label={p.playing ? 'Tạm dừng' : 'Phát nhạc'}>
                {p.playing ? <Pause size={38} fill="currentColor" /> : <Play size={38} fill="currentColor" />}
              </button>
              <button onClick={() => p.next()} aria-label="Bài tiếp theo"><SkipForward size={32} fill="currentColor" /></button>
            </div>
            <div className="expanded-volume">
              <button onClick={() => p.setVolume(p.volume ? 0 : 0.75)} aria-label={p.volume ? 'Bật tiếng' : 'Tắt tiếng'}>
                {p.volume ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <input aria-label="Âm lượng toàn màn hình" type="range" min="0" max="1" step="0.01"
                value={p.volume} onChange={(event) => p.setVolume(Number(event.target.value))}
                style={{ '--range': `${p.volume * 100}%` }} />
            </div>
          </div>}
          <nav className="expanded-tabs" aria-label="Chế độ trình phát">
            <button className={tab === 'lyrics' ? 'active' : ''} onClick={() => setTab('lyrics')}
              aria-label="Lời bài hát" title="Lời bài hát" aria-pressed={tab === 'lyrics'}><Mic2 size={22} /></button>
            <button className={tab === 'player' ? 'active' : ''} onClick={() => setTab('player')}
              aria-label="Trình phát" title="Trình phát" aria-pressed={tab === 'player'}><Music2 size={22} /></button>
            <button className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}
              aria-label="Danh sách phát" title="Danh sách phát" aria-pressed={tab === 'queue'}><ListMusic size={22} /></button>
          </nav>
        </div>
      </div>
    </section>
  );
}

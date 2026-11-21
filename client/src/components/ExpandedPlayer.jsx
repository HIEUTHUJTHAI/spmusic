import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Minimize2, X, MessageSquareQuote, MoreHorizontal, ChevronDown, Heart, ListMusic, Mic2, Music2, Pause, Play, Repeat,
  Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, Maximize2,
} from 'lucide-react';
import { api } from '../lib/api';
import { activeLineIndex, parseLrc } from '../lib/lrc';
import { lyricsScrollTop } from '../lib/lyricsScroll';
import { formatTime } from './Player';
import './ExpandedPlayer.css';
import InstrumentalButton from './InstrumentalButton';
import LiquidTabs from './LiquidTabs';
import MixArtwork from './MixArtwork';

export default function ExpandedPlayer({ p, tracks, liked, onLike, onClose, recent = [], embedded = false, onExpand }) {
  const [mini,setMini] = useState(false);
  const [showHistory,setShowHistory] = useState(false);
  const [tab, setTab] = useState('player');
  const [devices,setDevices] = useState([]);
  const [deviceError,setDeviceError] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [lyricsError, setLyricsError] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const activeRef = useRef(null);
  const scrollRef = useRef(null);
  const cover = p.track?.coverUrl || '/covers/fallback.svg';
  // Capture the initial offset once; changing animation-delay on each timeupdate speeds up the fade.
  const mixBackdrop = useMemo(() => p.mix ? {
    backgroundImage: `url("${p.mix.from?.coverUrl || '/covers/fallback.svg'}")`,
    '--mix-duration': `${p.mix.duration}s`, '--mix-offset': `${-p.mix.progress() * p.mix.duration}s`,
  } : null, [p.mix]);
  const lines = useMemo(() => parseLrc(lyrics), [lyrics]);
  const active = activeLineIndex(lines, p.time);
  const nextTracks = p.queue.slice(Math.max(0, p.queue.indexOf(p.trackId) + 1))
    .map((id) => tracks.find((item) => item.id === id)).filter(Boolean);

  useEffect(() => {
    if (embedded) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = previous; };
  }, [embedded]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (embedded && document.querySelector('[aria-modal="true"]')) return;
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, embedded]);

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
    scrollRef.current.scrollTo({
      top: lyricsScrollTop(scrollRef.current, activeRef.current),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }, [active, tab, lyricsLoading, lines]);

  useEffect(() => {
    if (mini) window.spmusicDesktop.setPlayerMini(tab !== 'player');
  }, [mini,tab]);
  const queueRows = mini && showHistory ? recent : nextTracks;
  const panels = <>
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
              {mini && <div className="mini-queue-tabs"><button aria-pressed={!showHistory} onClick={()=>setShowHistory(false)}>Tiếp theo</button><button aria-pressed={showHistory} onClick={()=>setShowHistory(true)}>Lịch sử</button></div>}
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
              {queueRows.length ? queueRows.map((track) => (
                <button className="expanded-queue-item" key={track.id} onClick={() => p.play(track)}>
                  <img src={track.coverUrl || '/covers/fallback.svg'} alt="" />
                  <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                  <Play size={17} />
                </button>
              )) : <p className="expanded-empty">{mini && showHistory ? 'Chưa có lịch sử nghe.' : 'Chưa có bài hát tiếp theo.'}</p>}
            </div>
          )}

  </>;
  return (
    <section className={`expanded-player ${embedded ? "now-playing-panel" : ""}`} role={embedded ? "region" : "dialog"} aria-modal={embedded ? undefined : true} aria-label={embedded ? "Đang phát" : "Trình phát toàn màn hình"}>
      <div className="expanded-backdrop" style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />
      {p.mix && <div className="expanded-backdrop expanded-backdrop-outgoing" key={p.mix.from?.id}
        style={mixBackdrop} aria-hidden="true" />}
      {!embedded ? <div className={'cinema '+(mini?'mini ':'')+(tab === 'player' ? '' : 'with-side')}>
        {mini && <div className="mini-drag-region" aria-hidden="true" />}
        <div className="cinema-deck">
          <MixArtwork track={p.track} mix={p.mix} wide={!mini} />
          <div className="cinema-meta"><h1>{p.track?.title || 'Chọn một bài hát'}</h1><p>{[p.track?.artist,p.track?.album].filter(Boolean).join(' — ')}</p></div>
          <div className="cinema-console">
            <div className="cinema-seek"><span>{formatTime(p.time)}</span><input aria-label="Tua nhạc toàn màn hình" type="range" min="0" max={p.duration || 1} step=".1" value={Math.min(p.time,p.duration || 1)} onChange={e=>p.seek(Number(e.target.value))}/><span>-{formatTime(Math.max(0,p.duration-p.time))}</span></div>
            <div className="cinema-buttons">
              <button popoverTarget="cinema-output" aria-label="Âm lượng và đầu ra" onClick={()=>navigator.mediaDevices?.enumerateDevices().then(items=>setDevices(items.filter(d=>d.kind==='audiooutput' && d.deviceId))).catch(()=>{})}><Volume2/></button>
              <div popover="auto" id="cinema-output" className="cinema-pop">
                <label>Âm lượng<input type="range" min="0" max="1" step=".01" value={p.volume} onChange={e=>p.setVolume(Number(e.target.value))}/></label>
                <label>Đầu ra<select value={p.outputDeviceId} onChange={async e=>{try {await p.setOutputDevice(devices.find(d=>d.deviceId===e.target.value)); setDeviceError('');}catch(err){setDeviceError(err.message)}}}><option value="">Mặc định hệ thống</option>{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label || 'Loa '+(i+1)}</option>)}</select></label>{deviceError && <small role="alert">{deviceError}</small>}
              </div>
              <button popoverTarget="cinema-more" aria-label="Tùy chọn phát"><MoreHorizontal/></button>
              <div popover="auto" id="cinema-more" className="cinema-pop">
                <button onClick={onLike} aria-pressed={liked}>{liked?'Bỏ yêu thích':'Yêu thích'}</button>
                <button onClick={e=>{setTab(tab==='queue'?'player':'queue');e.currentTarget.parentElement.hidePopover()}}>Danh sách phát</button>
              </div>
              <div className="cinema-transport"><button onClick={p.previous} aria-label="Bài trước"><SkipBack/></button><button onClick={p.toggle} aria-label={p.playing?'Tạm dừng':'Phát'}>{p.playing?<Pause/>:<Play/>}</button><button onClick={()=>p.next()} aria-label="Bài tiếp theo"><SkipForward/></button></div>
              <button className="cinema-words" aria-label="Lời bài hát" aria-pressed={tab==='lyrics'} onClick={()=>setTab(tab==='lyrics'?'player':'lyrics')}><MessageSquareQuote/></button>
              {mini && <button aria-label="Danh sách phát" aria-pressed={tab==='queue'} onClick={()=>setTab(tab==='queue'?'player':'queue')}><ListMusic/></button>}
            </div>
          </div>
        </div>
        {tab!=='player' && <aside className="cinema-side">{panels}</aside>}
        {window.spmusicDesktop?.setPlayerMini && (
          <button
            type="button"
            className="cinema-mini-toggle"
            title={mini ? 'Toàn màn hình' : 'Cửa sổ mini'}
            aria-label={mini ? 'Toàn màn hình' : 'Cửa sổ mini'}
            onClick={async (e) => {
              e.stopPropagation();
              if (mini) {
                setMini(false);
                try {
                  await window.spmusicDesktop?.setPlayerFullscreen(true);
                } catch (err) {
                  console.error('Lỗi phóng to toàn màn hình:', err);
                }
              } else {
                setMini(true);
                try {
                  await window.spmusicDesktop?.setPlayerMini(tab !== 'player');
                } catch (err) {
                  console.error('Lỗi chuyển cửa sổ mini:', err);
                }
              }
            }}
          >
            {mini ? <Maximize2 /> : <Minimize2 />}
          </button>
        )}
        <button
          type="button"
          className="cinema-close"
          onClick={onClose}
          aria-label="Thu nhỏ trình phát"
          title="Thu nhỏ (Esc)"
          autoFocus
        >
          <X />
        </button>
      </div> : <>      <header className="expanded-header">
        <button className="expanded-dismiss" onClick={onClose} aria-label={embedded ? "Đóng Đang phát" : "Thu nhỏ trình phát"} title="Thu nhỏ (Esc)" autoFocus>
          <ChevronDown size={26} />
        </button>
        <span>{embedded ? 'Đang phát' : 'SPMusic'} <small>ĐANG PHÁT</small></span>
        {embedded ? <button className="expanded-icon" onClick={onExpand} aria-label="Phóng lớn Đang phát"><Maximize2 size={19} /></button> : <div aria-hidden="true" />}
      </header>
      <div className="expanded-content">
        <MixArtwork track={p.track} mix={p.mix} />
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

          {panels}
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
          {embedded && tab === 'player' && <div className="now-playing-discovery">
            <button className="now-playing-lyric-preview" onClick={() => setTab('lyrics')}>
              <span><Mic2 size={15} /> Lời bài hát</span>
              <strong>{lyricsLoading ? 'Đang tải lời…' : lines.length ? lines[Math.max(0, active)]?.text || '♪' : 'Chưa có lời bài hát đồng bộ'}</strong>
              {lines.length > 0 && <small>{lines[Math.max(0, active) + 1]?.text || '♪'}</small>}
            </button>
            {nextTracks[0] && <div className="now-playing-next"><span>TIẾP THEO</span>
              <button className="expanded-queue-item" onClick={() => p.play(nextTracks[0])}>
                <img src={nextTracks[0].coverUrl || '/covers/fallback.svg'} alt="" />
                <span><strong>{nextTracks[0].title}</strong><small>{nextTracks[0].artist}</small></span><Play size={16} />
              </button>
            </div>}
          </div>}
          <LiquidTabs as="nav" className="expanded-tabs" aria-label="Chế độ trình phát">
            <button className={tab === 'lyrics' ? 'active' : ''} onClick={() => setTab('lyrics')}
              aria-label="Lời bài hát" title="Lời bài hát" aria-pressed={tab === 'lyrics'}><Mic2 size={22} /></button>
            <button className={tab === 'player' ? 'active' : ''} onClick={() => setTab('player')}
              aria-label="Trình phát" title="Trình phát" aria-pressed={tab === 'player'}><Music2 size={22} /></button>
            <button className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}
              aria-label="Danh sách phát" title="Danh sách phát" aria-pressed={tab === 'queue'}><ListMusic size={22} /></button>
          </LiquidTabs>
        </div>
      </div>
      </> }
    </section>
  );
}

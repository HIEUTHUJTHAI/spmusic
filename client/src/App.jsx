import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  House,
  Search,
  Library,
  Clock3,
  Heart,
  Plus,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  MoreHorizontal,
  Music2,
  Disc3,
  ArrowUpRight,
  X,
  LogOut,
  UserRound,
  Settings,
  Link2,
  ExternalLink,
  Menu,
  Check,
  Headphones,
  Trash2,
  Pencil,
  GripVertical,
  ListPlus,
  LoaderCircle,
} from 'lucide-react';
import { api } from './lib/api';
import { usePlayer } from './lib/usePlayer';
import Player, { formatTime } from './components/Player';
import ExpandedPlayer from './components/ExpandedPlayer';
import DiscoverMusic from './components/DiscoverMusic';
import Modal from './components/Modal';
import AuthModal from './components/AuthModal';
import TrackEditor from './components/TrackEditor';
import LyricsPanel from './components/LyricsPanel';
import PlaylistEditor from './components/PlaylistEditor';
import LyricsEditor from './components/LyricsEditor';
import AccountModal, { Avatar } from './components/AccountModal';
import SettingsModal from './components/SettingsModal';
import SourceCredit from './components/SourceCredit';
import UpdateNotice from './components/UpdateNotice';
import YoutubeModal from './components/YoutubeModal';

const navs = [
  ['home', 'Khám phá', House],
  ['search', 'Tìm kiếm', Search],
  ['library', 'Thư viện của bạn', Library],
];
const readLocal = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};
const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
const contrastText = (hex) => {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const luminance = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722 > 0.42
    ? '#231b22' : '#ffffff';
};
export default function App() {
  const [tracks, setTracks] = useState([]),
    [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [view, setView] = useState('home'),
    [query, setQuery] = useState(''),
    [genre, setGenre] = useState('Tất cả'),
    [playlists, setPlaylists] = useState([]),
    [history, setHistory] = useState([]),
    [likes, setLikes] = useState([]),
    [modal, setModal] = useState(null),
    [lyricsOpen, setLyricsOpen] = useState(false),
    [queueOpen, setQueueOpen] = useState(false),
    [expandedOpen, setExpandedOpen] = useState(false),
    [mobile, setMobile] = useState(false),
    [menu, setMenu] = useState(null),
    [draggedTrackId, setDraggedTrackId] = useState(null),
    [dropTargetTrackId, setDropTargetTrackId] = useState(null),
    [userMenu, setUserMenu] = useState(false),
    [loggingOut, setLoggingOut] = useState(false),
    [toast, setToast] = useState(''),
    [selection, setSelection] = useState(null),
    [tab, setTab] = useState('Bài hát');
  const userMenuRef = useRef(null);
  const reorderBusy = useRef(false);
  const timer = useRef(null),
    searchRef = useRef(null);
  const notify = (msg) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 4200);
  };
  const record = (t) => {
    if (!t) return;
    const h = { trackId: t.id, playedAt: new Date().toISOString() };
    setHistory((prev) => [h, ...prev.filter((x) => x.trackId !== t.id)].slice(0, 50));
    if (user)
      api('/history', { method: 'POST', body: { trackId: t.id } }).catch((e) => notify(e.message));
    else {
      const old = readLocal('auralis-history', []);
      localStorage.setItem(
        'auralis-history',
        JSON.stringify([h, ...old.filter((x) => x.trackId !== t.id)].slice(0, 50)),
      );
    }
  };
  const p = usePlayer(tracks, record, notify);
  const closeExpandedPlayer = () => {
    setExpandedOpen(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    if (!expandedOpen) return;
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setExpandedOpen(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [expandedOpen]);
  async function reorderPlaylistTrack(fromId, toId) {
    if (!user || !activePlaylist || !fromId || !toId || fromId === toId || reorderBusy.current)
      return;
    const previousIds = [...activePlaylist.trackIds];
    const fromIndex = previousIds.indexOf(fromId);
    const toIndex = previousIds.indexOf(toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = [...previousIds];
    nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, fromId);
    reorderBusy.current = true;
    setPlaylists((current) => current.map((item) =>
      item.id === activePlaylist.id ? { ...item, trackIds: nextIds } : item,
    ));
    const playerUsesPlaylist =
      p.queue.length === previousIds.length && p.queue.every((id, i) => id === previousIds[i]);
    if (playerUsesPlaylist) p.setQueueOrder(nextIds, previousIds);
    try {
      const { playlist } = await api(`/playlists/${activePlaylist.id}`, {
        method: 'PATCH',
        body: { trackIds: nextIds },
      });
      setPlaylists((current) => current.map((item) => item.id === playlist.id ? playlist : item));
      notify('Đã lưu thứ tự playlist.');
    } catch (e) {
      setPlaylists((current) => current.map((item) =>
        item.id === activePlaylist.id ? { ...item, trackIds: previousIds } : item,
      ));
      if (playerUsesPlaylist) p.setQueueOrder(previousIds, nextIds);
      notify(e.message || 'Không lưu được thứ tự playlist.');
    } finally {
      reorderBusy.current = false;
    }
  }
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = user?.theme || 'pink';
    const properties = ['--accent', '--bg', '--panel', '--text', '--button-text'];
    if (user?.theme === 'custom' && user.customTheme) {
      const { accent, background, surface, text } = user.customTheme;
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--bg', background);
      root.style.setProperty('--panel', surface);
      root.style.setProperty('--text', text);
      root.style.setProperty('--button-text', contrastText(accent));
    } else {
      properties.forEach((property) => root.style.removeProperty(property));
    }
  }, [user?.theme, user?.customTheme]);
  useEffect(() => {
    if (!userMenu) return;
    const outside = (e) => {
      if (!userMenuRef.current?.contains(e.target)) setUserMenu(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') {
        setUserMenu(false);
        userMenuRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [userMenu]);
  async function logout() {
    setLoggingOut(true);
    try {
      await api('/auth/logout', { method: 'POST' });
      p.stop();
      setUser(null);
      setTracks([]);
      setPlaylists([]);
      setHistory([]);
      setLikes([]);
      setUserMenu(false);
      setModal(null);
      setLyricsOpen(false);
      setQueueOpen(false);
      navigate('home');
      await refresh();
      notify('Đã đăng xuất.');
    } catch (e) {
      notify(e.message);
    } finally {
      setLoggingOut(false);
    }
  }
  function trackDeleted(id) {
    if (p.trackId === id) p.stop();
    setTracks((ts) => ts.filter((t) => t.id !== id));
    setHistory((hs) => hs.filter((h) => h.trackId !== id));
    setPlaylists((ps) =>
      ps.map((pl) => ({ ...pl, trackIds: pl.trackIds.filter((t) => t !== id) })),
    );
    const remaining = likes.filter((t) => t !== id);
    setLikes(remaining);
    localStorage.setItem('auralis-likes-' + user.id, JSON.stringify(remaining));
  }
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [{ tracks: ts }, { user: u }] = await Promise.all([api('/tracks'), api('/auth/me')]);
      setTracks(ts);
      setUser(u);
      if (u) {
        const [ps, hs] = await Promise.all([api('/playlists'), api('/history')]);
        setPlaylists(ps.playlists);
        setHistory(hs.history);
      } else {
        setPlaylists([]);
        setHistory(readLocal('auralis-history', []));
      }
    } catch (e) {
      setError('Chưa kết nối được máy chủ. ' + e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    setLikes(readLocal('auralis-likes-' + (user?.id || 'guest'), []));
  }, [user?.id]);
  useEffect(() => {
    if (view === 'search') searchRef.current?.focus();
    setMobile(false);
    setMenu(null);
  }, [view]);
  useEffect(() => {
    const key = (e) => {
      const editing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
      if (e.isComposing) return;
      if (e.key === '/' && !editing && !modal) {
        e.preventDefault();
        setView('search');
        setGenre('Tất cả');
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && !modal) {
        setLyricsOpen(false);
        setQueueOpen(false);
        setMenu(null);
        setMobile(false);
      }
      if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON|SELECT/.test(e.target.tagName) && !modal) {
        e.preventDefault();
        p.toggle();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [p, modal]);
  const like = (id) => {
    const next = likes.includes(id) ? likes.filter((x) => x !== id) : [...likes, id];
    setLikes(next);
    localStorage.setItem('auralis-likes-' + (user?.id || 'guest'), JSON.stringify(next));
  };
  const requireUser = (callback) => {
    if (!user) {
      setModal({ type: 'auth' });
      notify('Đăng nhập để quản lý thư viện cá nhân.');
      return;
    }
    callback();
  };
  const navigate = (v, s = null) => {
    setView(v);
    setSelection(s);
    setTab('Bài hát');
    setGenre('Tất cả');
    if (v !== 'search') setQuery('');
  };
  const filtered = useMemo(
    () =>
      tracks.filter((t) => {
        const q = normalize(query);
        return (
          (!q || normalize(`${t.title} ${t.artist} ${t.album}`).includes(q)) &&
          (genre === 'Tất cả' ||
            (genre === 'Thư giãn'
              ? ['Ambient', 'Chill', 'Lo-fi'].includes(t.genre)
              : genre === 'Tập trung'
                ? ['Lo-fi', 'Ambient'].includes(t.genre)
                : genre === 'Điện tử'
                  ? ['Electronic', 'Synthwave'].includes(t.genre)
                  : t.genre === 'Acoustic'))
        );
      }),
    [tracks, query, genre],
  );
  const recent = history.map((h) => tracks.find((t) => t.id === h.trackId)).filter(Boolean);
  const artists = [...new Set(filtered.map((t) => t.artist))].map((name) => ({
    name,
    tracks: filtered.filter((t) => t.artist === name),
  }));
  const albums = [...new Set(filtered.map((t) => t.album || 'Đĩa đơn'))].map((name) => ({
    name,
    tracks: filtered.filter((t) => (t.album || 'Đĩa đơn') === name),
  }));
  const activePlaylist = playlists.find((x) => x.id === selection);
  let list = filtered,
    title = 'Thư viện của bạn',
    subtitle = `${tracks.length} bài hát • Không gian của riêng bạn`;
  if (view === 'liked') {
    list = tracks.filter((t) => likes.includes(t.id));
    title = 'Bài hát yêu thích';
    subtitle = `${list.length} bài hát bạn muốn nghe lại`;
  }
  if (view === 'recent') {
    list = recent;
    title = 'Nghe gần đây';
    subtitle = 'Những giai điệu vừa đi qua ngày của bạn';
  }
  if (view === 'playlist') {
    list = (activePlaylist?.trackIds || [])
      .map((id) => tracks.find((t) => t.id === id))
      .filter(Boolean);
    title = activePlaylist?.name || 'Playlist';
    subtitle = activePlaylist?.description || `${list.length} bài hát • Playlist của bạn`;
  }
  if (view === 'collection') {
    list = tracks.filter((t) => t.artist === selection || t.album === selection);
    title = selection;
    subtitle = `${list.length} bài hát trong bộ sưu tập`;
  }
  if (view === 'search') {
    list = filtered;
    title = query ? `Kết quả cho “${query}”` : 'Tìm giai điệu của bạn';
    subtitle = query
      ? `${filtered.length} bài hát phù hợp`
      : 'Tìm bài hát, album hoặc nghệ sĩ trong thư viện';
  }
  async function removeTrack(t) {
    try {
      await api('/tracks/' + t.id, { method: 'DELETE' });
      if (p.trackId === t.id) p.stop();
      setTracks((ts) => ts.filter((x) => x.id !== t.id));
      setModal(null);
      notify('Đã xóa bài hát.');
      refresh();
    } catch (e) {
      notify(e.message);
    }
  }
  const cover = (t, extra = '') => (
    <img
      className={extra}
      src={t?.coverUrl || '/covers/fallback.svg'}
      alt=""
      loading="lazy"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = '/favicon.svg';
      }}
    />
  );
  const playButton = (t, items = tracks) => (
    <button
      className="card-play"
      aria-label={`${p.trackId === t.id && p.playing ? 'Tạm dừng' : 'Phát'} ${t.title}`}
      onClick={(e) => {
        e.stopPropagation();
        p.trackId === t.id ? p.toggle() : p.play(t, items);
      }}
    >
      {p.trackId === t.id && p.playing ? (
        <Pause size={21} fill="currentColor" />
      ) : (
        <Play size={21} fill="currentColor" />
      )}
    </button>
  );
  const cards = (items = filtered) => (
    <div className="album-grid">
      {items.slice(0, 6).map((t, i) => (
        <article className="album-card" key={t.id}>
          <div className="album-art">
            {cover(t)}
            <span className="art-type">{i % 2 ? 'EP' : 'ALBUM'}</span>
            {playButton(t, items)}
          </div>
          <button className="card-title" onClick={() => navigate('collection', t.album)}>
            {t.album || t.title}
          </button>
          <span>
            {t.artist} <span className="dot">•</span> {t.genre}
          </span>
        </article>
      ))}
    </div>
  );
  const rows = (items, sortablePlaylist = false) => (
    <div className={`track-table ${sortablePlaylist ? 'reorder-enabled' : ''}`}>
      <div className="track-row table-head">
        <span>#</span>
        <span>Bài hát</span>
        <span className="album-cell">Album</span>
        <span className="genre-cell">Thể loại</span>
        <span className="row-duration">
          <Clock3 size={15} />
        </span>
        <span />
      </div>
      {items.length ? (
        items.map((t, i) => (
          <div
            className={`track-row ${p.trackId === t.id ? 'current-track' : ''} ${draggedTrackId === t.id ? 'dragging-track' : ''} ${dropTargetTrackId === t.id ? 'drop-target' : ''}`}
            key={t.id}
            onDoubleClick={() => p.play(t, items)}
            onDragOver={(event) => {
              if (sortablePlaylist && draggedTrackId && draggedTrackId !== t.id) {
                event.preventDefault();
                setDropTargetTrackId(t.id);
              }
            }}
            onDrop={(event) => {
              if (!sortablePlaylist || !draggedTrackId) return;
              event.preventDefault();
              void reorderPlaylistTrack(draggedTrackId, t.id);
              setDraggedTrackId(null);
              setDropTargetTrackId(null);
            }}
          >
            <div className="row-position">
              {sortablePlaylist && user && (
                <button
                  className="playlist-order-handle"
                  type="button"
                  draggable
                  title="Kéo để đổi thứ tự; dùng phím mũi tên lên/xuống"
                  aria-label={`Di chuyển ${t.title}, vị trí ${i + 1}`}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', t.id);
                    setDraggedTrackId(t.id);
                    setDropTargetTrackId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedTrackId(null);
                    setDropTargetTrackId(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                    const nextIndex = i + (event.key === 'ArrowUp' ? -1 : 1);
                    if (nextIndex < 0 || nextIndex >= activePlaylist.trackIds.length) return;
                    event.preventDefault();
                    void reorderPlaylistTrack(t.id, activePlaylist.trackIds[nextIndex]);
                  }}
                >
                  <GripVertical size={15} />
                </button>
              )}
              <button
                className="row-index"
                aria-label={`Phát ${t.title}`}
                onClick={() => (p.trackId === t.id ? p.toggle() : p.play(t, items))}
              >
                {p.trackId === t.id && p.playing ? (
                  <AudioLines size={16} />
                ) : (
                  <>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <Play className="index-play" size={15} fill="currentColor" />
                  </>
                )}
              </button>
            </div>
            <div className="track-identity">
              {cover(t)}
              <div>
                <button onClick={() => p.play(t, items)}>{t.title}</button>
                <button className="artist-link" onClick={() => navigate('collection', t.artist)}>
                  {t.artist}
                </button>
              </div>
            </div>
            <button
              className="album-cell text-left muted truncate"
              onClick={() => navigate('collection', t.album)}
            >
              {t.album || 'Đĩa đơn'}
            </button>
            <span className="genre-cell muted">{t.genre || 'Khác'}</span>
            <span className="row-duration">{formatTime(t.duration)}</span>
            <div className="row-actions">
              <button
                className={`icon-btn ${likes.includes(t.id) ? 'is-on' : ''}`}
                aria-label={`Yêu thích ${t.title}`}
                aria-pressed={likes.includes(t.id)}
                onClick={() => like(t.id)}
              >
                <Heart size={16} fill={likes.includes(t.id) ? 'currentColor' : 'none'} />
              </button>
              <button
                className="icon-btn"
                aria-label={`Tùy chọn ${t.title}`}
                onClick={() => setMenu(menu === t.id ? null : t.id)}
              >
                <MoreHorizontal size={19} />
              </button>
              {menu === t.id && (
                <>
                  <button
                    className="menu-dismiss"
                    onClick={() => setMenu(null)}
                    aria-label="Đóng tùy chọn"
                  />
                  <div className="track-menu">
                    {t.sourceInfo && (
                      <button
                        onClick={() => {
                          setMenu(null);
                          setModal({ type: 'source', track: t });
                        }}
                      >
                        <ExternalLink size={16} />
                        Nguồn và giấy phép
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMenu(null);
                        requireUser(() => setModal({ type: 'addTo', track: t }));
                      }}
                    >
                      <ListPlus size={16} />
                      Thêm vào playlist
                    </button>
                    {user && t.ownerId === user.id && !t.isDemo && (
                      <>
                        <button
                          onClick={() => {
                            setModal({ type: 'track', track: t });
                            setMenu(null);
                          }}
                        >
                          <Pencil size={15} />
                          Chỉnh sửa bài hát và ảnh bìa
                        </button>
                        <button
                          onClick={() => {
                            setModal({ type: 'lyrics', track: t });
                            setMenu(null);
                          }}
                        >
                          <Music2 size={15} />
                          Quản lý lời bài hát
                        </button>
                        <button
                          className="danger"
                          onClick={() => {
                            setModal({ type: 'deleteTrack', track: t });
                            setMenu(null);
                          }}
                        >
                          <Trash2 size={15} />
                          Xóa bài hát
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Music2 size={34} />
          <h3>Chưa có bài hát nào</h3>
          <p>
            {query
              ? 'Thử tên bài hát, nghệ sĩ hoặc album khác.'
              : 'Thêm nhạc của bạn để bắt đầu nghe.'}
          </p>
          <button
            className="secondary-btn"
            onClick={() => (query ? setQuery('') : requireUser(() => setModal({ type: 'track' })))}
          >
            {query ? 'Xóa tìm kiếm' : 'Tải nhạc lên'}
          </button>
        </div>
      )}
    </div>
  );
  return (
    <div className={`app-shell ${user?.backgroundUrl ? 'has-wallpaper' : ''}`}>
      <div className="app-wallpaper" aria-hidden="true"
        style={user?.backgroundUrl ? { backgroundImage: `url("${user.backgroundUrl}")` } : undefined} />
      <audio {...p.audioProps[0]} />
      <audio {...p.audioProps[1]} />
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng điều hướng"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <button className="brand" onClick={() => navigate('home')} aria-label="SPMusic trang chủ">
          <span className="brand-symbol"><img src="/spmusic-icon.png" alt="" width="32" height="32" /></span>
          <span className="brand-wordmark">SPMusic<span className="brand-period">.</span><small>by HIEUTHUJTHAI</small></span>
        </button>
        <div className="nav-label">KHÔNG GIAN CỦA BẠN</div>
        <nav>
          {navs.map(([id, label, Icon]) => (
            <button
              className={`nav-item ${view === id ? 'active' : ''}`}
              key={id}
              onClick={() => navigate(id)}
            >
              <Icon size={20} />
              {label}
              {view === id && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <button
          className="nav-item"
          onClick={() => {
            setMobile(false);
            requireUser(() => setModal({ type: 'youtube' }));
          }}
        >
          <Link2 size={20} />
          Nhạc từ link YouTube
        </button>
        <div className="library-heading">
          <span>BỘ SƯU TẬP</span>
          <button
            className="icon-btn"
            aria-label="Tạo playlist"
            onClick={() => requireUser(() => setModal({ type: 'playlist' }))}
          >
            <Plus size={17} />
          </button>
        </div>
        <button
          className={`nav-item ${view === 'liked' ? 'active' : ''}`}
          onClick={() => navigate('liked')}
        >
          <span className="nav-tile heart-tile">
            <Heart size={16} fill="currentColor" />
          </span>
          Bài hát yêu thích<span className="nav-count">{likes.length}</span>
        </button>
        <button
          className={`nav-item ${view === 'recent' ? 'active' : ''}`}
          onClick={() => navigate('recent')}
        >
          <span className="nav-tile recent-tile">
            <Clock3 size={16} />
          </span>
          Nghe gần đây
        </button>
        <div className="playlist-nav">
          {playlists.map((pl, i) => (
            <button
              key={pl.id}
              className={`nav-item ${view === 'playlist' && selection === pl.id ? 'active' : ''}`}
              onClick={() => navigate('playlist', pl.id)}
            >
              <span className={`nav-tile playlist-tile tile-${i % 3}`}>
                {pl.coverUrl ? <img src={pl.coverUrl} alt="" /> : <Music2 size={16} />}
              </span>
              <span className="truncate">{pl.name}</span>
            </button>
          ))}
          {!playlists.length && (
            <button
              className="create-playlist"
              onClick={() => requireUser(() => setModal({ type: 'playlist' }))}
            >
              <Plus size={16} />
              Tạo playlist đầu tiên
            </button>
          )}
        </div>
        <div className="sidebar-upload">
          <span className="upload-orbit">
            <ArrowUpFromLine size={21} />
          </span>
          <strong>Mang âm nhạc đến đây</strong>
          <p>
            Giai điệu của bạn.
            <br />
            Câu chuyện của bạn.
          </p>
          <button onClick={() => requireUser(() => setModal({ type: 'track' }))}>
            <Plus size={15} />
            Tải nhạc lên
          </button>
        </div>
        <div className="sidebar-foot">
          <span className="status-dot" />
          Không gian nghe nhạc cá nhân
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Mở điều hướng"
            >
              <Menu size={22} />
            </button>
            <button
              className="history-button"
              title="Về khám phá"
              aria-label="Về khám phá"
              onClick={() => navigate('home')}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              className="history-button forward"
              aria-label="Mở thư viện"
              onClick={() => navigate('library')}
            >
              <ChevronRight size={19} />
            </button>
          </div>
          <label className="search-box">
            <Search size={18} />
            <input
              ref={searchRef}
              value={query}
              placeholder="Tìm bài hát, nghệ sĩ, album..."
              aria-label="Tìm bài hát, nghệ sĩ, album"
              onFocus={() => {
                if (view !== 'search') {
                  setView('search');
                  setGenre('Tất cả');
                }
              }}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}>
                <X size={15} />
              </button>
            )}
            <kbd>/</kbd>
          </label>
          <div className="topbar-end">
            <button
              className="upload-top"
              onClick={() => requireUser(() => setModal({ type: 'track' }))}
            >
              <ArrowUpFromLine size={16} />
              <span>Tải nhạc lên</span>
            </button>
            {user ? (
              <div className="user-control" ref={userMenuRef}>
                <button
                  className="user-avatar"
                  aria-label="Menu người dùng"
                  aria-expanded={userMenu}
                  aria-controls="user-dropdown"
                  title={user.name}
                  onClick={() => setUserMenu(!userMenu)}
                >
                  <Avatar user={user} />
                </button>
                {userMenu && (
                  <div className="user-dropdown" id="user-dropdown">
                    <div className="user-menu-heading">
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                    <button
                      onClick={() => {
                        setUserMenu(false);
                        setModal({ type: 'account' });
                      }}
                    >
                      <UserRound size={17} />
                      Tài khoản
                    </button>
                    <button
                      onClick={() => {
                        setUserMenu(false);
                        setModal({ type: 'settings' });
                      }}
                    >
                      <Settings size={17} />
                      Cài đặt
                    </button>
                    <button className="danger" disabled={loggingOut} onClick={logout}>
                      <LogOut size={17} />
                      {loggingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="login-btn" onClick={() => setModal({ type: 'auth' })}>
                Đăng nhập
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main>
          {error ? (
            <div className="connection-error">
              <h2>Chưa thể mở thư viện</h2>
              <p>{error}</p>
              <button className="primary-btn" onClick={refresh}>
                Thử kết nối lại
              </button>
            </div>
          ) : loading ? (
            <div className="loading-screen">
              <LoaderCircle className="spin" />
              <span>Đang mở không gian âm nhạc...</span>
            </div>
          ) : (
            <>
              {view === 'home' ? (
                <>
                  <div className="page-intro">
                    <div>
                      <p className="eyebrow">
                        <span />
                        MỘT NGÀY MỚI, MỘT GIAI ĐIỆU MỚI
                      </p>
                      <h1>
                        Chào bạn, cùng nghe nhé<span className="title-dot">.</span>
                      </h1>
                    </div>
                    <span className="date-tag">
                      <Headphones size={16} />
                      Bật nhạc. Chạm cảm xúc.
                    </span>
                  </div>
                  <div className="genre-tabs" aria-label="Lọc thể loại">
                    {['Tất cả', 'Thư giãn', 'Tập trung', 'Điện tử', 'Acoustic'].map((g) => (
                      <button
                        className={genre === g ? 'selected' : ''}
                        key={g}
                        onClick={() => setGenre(g)}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <section className="home-section">
                    <div className="section-heading">
                      <div>
                        <h2>Dành cho hôm nay</h2>
                        <p>Một chút cảm hứng cho mọi khoảnh khắc.</p>
                      </div>
                      <button onClick={() => navigate('library')}>
                        Xem tất cả
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {filtered.length ? (
                      cards()
                    ) : (
                      <div className="filter-empty">
                        {tracks.length ? 'Chưa có nhạc thuộc thể loại này.' : 'Thư viện chưa có bài hát nào.'}{' '}
                        <button onClick={() => tracks.length ? setGenre('Tất cả') : requireUser(() => setModal({ type: 'track' }))}>
                          {tracks.length ? 'Xem tất cả' : 'Thêm nhạc'}
                        </button>
                      </div>
                    )}
                  </section>
                  <section className="home-section recent-section">
                    <div className="section-heading">
                      <div>
                        <h2>
                          {recent.length
                            ? 'Tiếp tục câu chuyện của bạn'
                            : 'Nhạc trong thư viện của bạn'}
                        </h2>
                        <p>
                          {recent.length
                            ? 'Quay lại với những bài hát bạn vừa nghe.'
                            : 'Thêm bài hát để bắt đầu nghe.'}
                        </p>
                      </div>
                      <button onClick={() => navigate(recent.length ? 'recent' : 'library')}>
                        Xem tất cả
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {rows((recent.length ? recent : filtered).slice(0, 4))}
                  </section>
                  <section className="home-section">
                    <div className="section-heading">
                      <div>
                        <h2>Những sắc màu âm nhạc</h2>
                        <p>Khám phá các nghệ sĩ trong thư viện của bạn.</p>
                      </div>
                    </div>
                    <div className="artist-grid">
                      {artists.map((a) => (
                        <button
                          className="artist-card"
                          key={a.name}
                          onClick={() => navigate('collection', a.name)}
                        >
                          {cover(a.tracks[0])}
                          <strong>{a.name}</strong>
                          <span>Nghệ sĩ • {a.tracks.length} bài hát</span>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <div className="collection-heading">
                    <div className={`collection-icon ${view === 'liked' ? 'liked-icon' : ''} ${view === 'playlist' && activePlaylist?.coverUrl ? 'has-cover' : ''}`}>
                      {view === 'playlist' && activePlaylist?.coverUrl ? (
                        <img src={activePlaylist.coverUrl} alt={`Ảnh bìa playlist ${activePlaylist.name}`} />
                      ) : view === 'liked' ? (
                        <Heart size={46} fill="currentColor" />
                      ) : view === 'recent' ? (
                        <Clock3 size={46} />
                      ) : view === 'search' ? (
                        <Search size={46} />
                      ) : (
                        <Disc3 size={46} />
                      )}
                    </div>
                    <div>
                      <p className="eyebrow">
                        {view === 'playlist' ? 'PLAYLIST CỦA BẠN' : 'SPMUSIC LIBRARY'}
                      </p>
                      <h1>{title}</h1>
                      <p className="muted">{subtitle}</p>
                    </div>
                  </div>
                  {view === 'search' && <DiscoverMusic query={query} user={user}
                    onLogin={() => setModal({ type: 'auth' })} onImported={refresh} notify={notify} />}
                  <div className="collection-controls">
                    <button
                      className="primary-btn"
                      disabled={!list.length}
                      onClick={() => p.play(list[0], list)}
                    >
                      <Play size={17} fill="currentColor" />
                      Phát tất cả
                    </button>
                    {view === 'playlist' ? (
                      <>
                        <button
                          className="secondary-btn"
                          onClick={() => setModal({ type: 'playlist', playlist: activePlaylist })}
                        >
                          <Pencil size={16} />
                          Sửa playlist
                        </button>
                        <button
                          className="icon-btn"
                          aria-label="Xóa playlist"
                          onClick={() =>
                            setModal({ type: 'deletePlaylist', playlist: activePlaylist })
                          }
                        >
                          <Trash2 size={19} />
                        </button>
                      </>
                    ) : (
                      <button
                        className="secondary-btn"
                        onClick={() => requireUser(() => setModal({ type: 'track' }))}
                      >
                        <Plus size={17} />
                        Thêm nhạc
                      </button>
                    )}
                    <span className="collection-count">{list.length} bài hát</span>
                  </div>
                  {['search', 'library'].includes(view) && (
                    <div className="genre-tabs collection-tabs">
                      {['Bài hát', 'Album', 'Nghệ sĩ'].map((t) => (
                        <button
                          key={t}
                          className={tab === t ? 'selected' : ''}
                          onClick={() => setTab(t)}
                        >
                          {t}
                        </button>
                      ))}
                      {tab === 'Bài hát' && view === 'library' && (
                        <button
                          className={selection === 'own' ? 'selected' : ''}
                          onClick={() => setSelection(selection === 'own' ? null : 'own')}
                        >
                          Nhạc tải lên
                        </button>
                      )}
                    </div>
                  )}
                  {tab === 'Album' && ['search', 'library'].includes(view) ? (
                    <div className="album-grid library-albums">
                      {albums.map((a) => (
                        <article className="album-card" key={a.name}>
                          <div className="album-art">
                            {cover(a.tracks[0])}
                            {playButton(a.tracks[0], a.tracks)}
                          </div>
                          <button
                            className="card-title"
                            onClick={() => navigate('collection', a.name)}
                          >
                            {a.name}
                          </button>
                          <span>
                            {a.tracks[0].artist} • {a.tracks.length} bài hát
                          </span>
                        </article>
                      ))}
                    </div>
                  ) : tab === 'Nghệ sĩ' && ['search', 'library'].includes(view) ? (
                    <div className="artist-grid">
                      {artists.map((a) => (
                        <button
                          className="artist-card"
                          key={a.name}
                          onClick={() => navigate('collection', a.name)}
                        >
                          {cover(a.tracks[0])}
                          <strong>{a.name}</strong>
                          <span>{a.tracks.length} bài hát</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    rows(
                      view === 'library' && selection === 'own'
                        ? list.filter((t) => !t.isDemo)
                        : list,
                      view === 'playlist' && !!activePlaylist,
                    )
                  )}
                </>
              )}
              <div className="content-foot">
                <span className="footer-brand">
                  <AudioLines size={16} />
                  SPMusic.
                </span>
                <span>Âm nhạc của bạn, theo cách của bạn.</span>
                <span>Thư viện cá nhân • SPMusic 2.2.0</span>
              </div>
            </>
          )}
        </main>
      </div>
      {lyricsOpen && (
        <LyricsPanel
          track={p.track}
          currentTime={p.time}
          onSeek={p.seek}
          onClose={() => setLyricsOpen(false)}
          canEdit={!!user && p.track?.ownerId === user.id && !p.track?.isDemo}
          onEditLyrics={() => setModal({ type: 'lyrics', track: p.track })}
        />
      )}
      {queueOpen && (
        <aside className="queue-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">ĐANG CHỜ BẠN</span>
              <h2>Danh sách phát</h2>
            </div>
            <button
              className="icon-btn"
              aria-label="Đóng danh sách phát"
              onClick={() => setQueueOpen(false)}
            >
              <X size={21} />
            </button>
          </div>
          <div className="queue-settings">
            <span>Tùy chọn phát</span>
            <div>
              <button
                className={p.shuffle ? 'selected' : ''}
                aria-pressed={p.shuffle}
                onClick={() => p.setShuffle(!p.shuffle)}
              >
                Ngẫu nhiên: {p.shuffle ? 'bật' : 'tắt'}
              </button>
              <button
                onClick={() =>
                  p.setRepeat(p.repeat === 'off' ? 'all' : p.repeat === 'all' ? 'one' : 'off')
                }
              >
                Lặp: {p.repeat === 'off' ? 'tắt' : p.repeat === 'all' ? 'tất cả' : 'một bài'}
              </button>
            </div>
            <label>
              Âm lượng{' '}
              <input
                aria-label="Âm lượng danh sách phát"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={p.volume}
                onChange={(e) => p.setVolume(Number(e.target.value))}
                style={{ '--range': `${p.volume * 100}%` }}
              />
            </label>
          </div>
          {p.queue.map((id, i) => {
            const t = tracks.find((x) => x.id === id);
            return (
              t && (
                <button
                  key={id}
                  className={`queue-item ${p.trackId === id ? 'active' : ''}`}
                  onClick={() => p.play(t)}
                >
                  {cover(t)}
                  <span>
                    <strong>{t.title}</strong>
                    <small>{t.artist}</small>
                  </span>
                  {p.trackId === id ? <AudioLines size={18} /> : <span>{i + 1}</span>}
                </button>
              )
            );
          })}
        </aside>
      )}
      <Player
        p={p}
        onExpand={() => {
          setExpandedOpen(true);
          setLyricsOpen(false);
          setQueueOpen(false);
          document.documentElement.requestFullscreen?.().catch(() => {});
        }}
        onLyrics={() => {
          setLyricsOpen(!lyricsOpen);
          setQueueOpen(false);
        }}
        lyricsOpen={lyricsOpen}
        onQueue={() => {
          setQueueOpen(!queueOpen);
          setLyricsOpen(false);
        }}
        queueOpen={queueOpen}
        liked={likes.includes(p.trackId)}
        onLike={() => like(p.trackId)}
      />
      {expandedOpen && p.track && (
        <ExpandedPlayer p={p} tracks={tracks} liked={likes.includes(p.trackId)}
          onLike={() => like(p.trackId)} onClose={closeExpandedPlayer} />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button aria-label="Đóng thông báo" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal?.type === 'auth' && (
        <AuthModal
          onClose={() => setModal(null)}
          onSuccess={async () => {
            setModal(null);
            await refresh();
            notify('Chào mừng đến với SPMusic.');
          }}
        />
      )}
      {modal?.type === 'track' && (
        <TrackEditor
          track={modal.track}
          onClose={() => setModal(null)}
          onSaved={async (result) => {
            if (!result?.stayOpen) setModal(null);
            await refresh();
            notify(result?.count ? `Đã thêm ${result.count} bài hát vào thư viện.` : 'Đã lưu bài hát vào thư viện.');
          }}
        />
      )}
      {modal?.type === 'playlist' && (
        <PlaylistEditor
          playlist={modal.playlist}
          tracks={tracks}
          onClose={() => setModal(null)}
          onSaved={async (pl) => {
            setModal(null);
            await refresh();
            navigate('playlist', pl.id);
            notify('Đã lưu playlist.');
          }}
        />
      )}
      {modal?.type === 'addTo' && (
        <Modal title="Thêm vào playlist" onClose={() => setModal(null)}>
          <div className="modal-stack">
            <p className="muted">
              {modal.track.title} — {modal.track.artist}
            </p>
            {playlists.map((pl) => (
              <button
                className="playlist-choice"
                key={pl.id}
                onClick={async () => {
                  try {
                    await api('/playlists/' + pl.id, {
                      method: 'PATCH',
                      body: { trackIds: [...new Set([...pl.trackIds, modal.track.id])] },
                    });
                    setModal(null);
                    await refresh();
                    notify('Đã thêm vào ' + pl.name);
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                <Music2 size={20} />
                <span>
                  {pl.name}
                  <small>{pl.trackIds.length} bài hát</small>
                </span>
                <Plus size={18} />
              </button>
            ))}
            <button
              className="secondary-btn"
              onClick={() =>
                setModal({ type: 'playlist', playlist: { trackIds: [modal.track.id] } })
              }
            >
              <Plus size={17} />
              Tạo playlist mới
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === 'deleteTrack' && (
        <Modal title="Xóa bài hát?" onClose={() => setModal(null)}>
          <p className="muted">
            “{modal.track.title}” cùng file nhạc, ảnh bìa và lyrics sẽ được xóa khỏi thư viện của
            bạn.
          </p>
          <div className="dialog-actions">
            <button className="secondary-btn" onClick={() => setModal(null)}>
              Giữ lại
            </button>
            <button className="danger-btn" onClick={() => removeTrack(modal.track)}>
              Xóa bài hát
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === 'deletePlaylist' && (
        <Modal title="Xóa playlist?" onClose={() => setModal(null)}>
          <p className="muted">Xóa “{modal.playlist?.name}”? Các bài hát vẫn ở trong thư viện.</p>
          <div className="dialog-actions">
            <button className="secondary-btn" onClick={() => setModal(null)}>
              Giữ lại
            </button>
            <button
              className="danger-btn"
              onClick={async () => {
                try {
                  await api('/playlists/' + modal.playlist.id, { method: 'DELETE' });
                  setModal(null);
                  navigate('library');
                  refresh();
                  notify('Đã xóa playlist.');
                } catch (e) {
                  notify(e.message);
                }
              }}
            >
              Xóa playlist
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === 'lyrics' && (
        <LyricsEditor
          track={modal.track}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await refresh();
            setLyricsOpen(false);
            notify('Đã cập nhật lời bài hát.');
          }}
        />
      )}
      {modal?.type === 'account' && user && (
        <AccountModal user={user} onUser={setUser} onClose={() => setModal(null)} />
      )}
      {user && (
        <YoutubeModal
          key={user.id}
          open={modal?.type === 'youtube'}
          onClose={() => setModal(null)}
          onImported={(track, existing) => {
            if (track)
              setTracks((prev) => (prev.some((t) => t.id === track.id) ? prev : [track, ...prev]));
            notify(existing ? 'Video này đã có trong thư viện.' : 'Đã thêm MP3 vào thư viện của bạn.');
          }}
        />
      )}
      {modal?.type === 'source' && (
        <Modal title="Nguồn bài hát" onClose={() => setModal(null)}>
          <SourceCredit info={modal.track.sourceInfo} />
        </Modal>
      )}
      {modal?.type === 'settings' && user && (
        <SettingsModal
          user={user}
          player={p}
          tracks={tracks}
          onUser={setUser}
          onDeleted={trackDeleted}
          onEditTrack={(track) => setModal({ type: 'track', track })}
          onClose={() => setModal(null)}
        />
      )}
      <UpdateNotice />
    </div>
  );
}

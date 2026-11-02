import { useEffect, useMemo, useState } from 'react';
import { Camera, Play } from 'lucide-react';
import { upload } from '../lib/api';
import './ArtistPage.css';

export default function ArtistPage({ name, tracks, player, user, onAlbum, notify }) {
  const [revision, setRevision] = useState(0);
  const [hasImage, setHasImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const image = `/api/artists/image?name=${encodeURIComponent(name)}&v=${revision}`;
  const albums = useMemo(() => [...new Set(tracks.map(t => t.album || 'Đĩa đơn'))].map(album => ({ name: album, tracks: tracks.filter(t => (t.album || 'Đĩa đơn') === album) })), [tracks]);
  useEffect(() => {
    let active = true;
    setHasImage(false);
    if (user) fetch(image, { method: 'HEAD' }).then(r => { if (active) setHasImage(r.ok); }).catch(() => {});
    return () => { active = false; };
  }, [name, user?.id, revision]);
  const background = hasImage ? image : (tracks.find(t => t.coverUrl)?.coverUrl || '/covers/fallback.svg');
  async function changeImage(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setBusy(true);
    try { const form = new FormData(); form.append('cover', file); await upload(`/artists/image?name=${encodeURIComponent(name)}`, form, undefined, 'PUT'); setRevision(Date.now()); notify('Đã đổi ảnh nghệ sĩ.'); }
    catch (error) { notify(error.message); } finally { setBusy(false); }
  }
  return <article className="artist-page">
    <div className="artist-hero" style={{ '--artist-image': `url(${JSON.stringify(background)})` }}>
      {user && <label className="artist-photo-button"><Camera size={17}/>{busy ? 'Đang tải…' : 'Đổi ảnh nghệ sĩ'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={changeImage}/></label>}
      <div className="artist-hero-title"><span>NGHỆ SĨ TRONG THƯ VIỆN</span><h1>{name}</h1><button className="artist-play" disabled={!tracks.length} onClick={() => player.play(tracks[0], tracks)} aria-label={`Phát nhạc của ${name}`}><Play size={28} fill="currentColor"/></button></div>
    </div>
    <div className="artist-page-body">
      <section><h2>Bài hát</h2><div className="artist-song-grid">{tracks.map(t => <button className="artist-song" key={t.id} onClick={() => player.play(t, tracks)}><img src={t.coverUrl || '/covers/fallback.svg'} alt=""/><span><strong>{t.title}</strong><small>{t.album || 'Đĩa đơn'}</small></span><Play size={17}/></button>)}</div></section>
      <section><h2>Album &amp; đĩa đơn</h2><div className="artist-album-grid">{albums.map(a => <button className="artist-album" key={a.name} onClick={() => onAlbum(a.name)}><img src={a.tracks[0].coverUrl || '/covers/fallback.svg'} alt=""/><strong>{a.name}</strong><small>{a.tracks.length} bài hát</small></button>)}</div></section>
    </div>
  </article>;
}

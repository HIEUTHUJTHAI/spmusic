import { useEffect, useState } from 'react';
import { ImagePlus, Music2, Trash2 } from 'lucide-react';
import { api, upload } from '../lib/api';
import Modal from './Modal';

export default function PlaylistEditor({ playlist, tracks, onClose, onSaved }) {
  const [name, setName] = useState(playlist?.name || '');
  const [description, setDescription] = useState(playlist?.description || '');
  const [ids, setIds] = useState(playlist?.trackIds || []);
  const [savedPlaylist, setSavedPlaylist] = useState(playlist || null);
  const [cover, setCover] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [coverPreview, setCoverPreview] = useState(null);
  const [licensed, setLicensed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  function chooseCover(file) {
    if (!file) return;
    const ext = file.name.split('.').at(-1)?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext) || !file.size || file.size > 5 * 1024 * 1024) {
      setError('Ảnh bìa phải là JPG, PNG hoặc WebP, tối đa 5 MB.');
      return;
    }
    setError('');
    setCover(file);
    setRemoveCover(false);
  }

  async function save(event) {
    event.preventDefault();
    if (cover && !licensed) {
      setError('Vui lòng xác nhận quyền sử dụng ảnh bìa trước khi lưu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api(savedPlaylist?.id ? '/playlists/' + savedPlaylist.id : '/playlists', {
        method: savedPlaylist?.id ? 'PATCH' : 'POST',
        body: { name, description, trackIds: ids },
      });
      let updated = result.playlist;
      setSavedPlaylist(updated);
      if (cover) {
        const form = new FormData();
        form.append('cover', cover);
        const response = await upload(`/playlists/${updated.id}/cover`, form, setProgress, 'PUT');
        updated = response.playlist;
      } else if (removeCover && updated.coverUrl) {
        updated = (await api(`/playlists/${updated.id}/cover`, { method: 'DELETE' })).playlist;
      }
      onSaved(updated);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={playlist?.id ? 'Chỉnh sửa playlist' : 'Tạo playlist của bạn'} onClose={() => !busy && onClose()}>
      <form className="modal-stack" onSubmit={save}>
        <div className="playlist-cover-editor">
          {coverPreview || (!removeCover && savedPlaylist?.coverUrl) ? (
            <img src={coverPreview || savedPlaylist.coverUrl} alt="Ảnh bìa playlist" />
          ) : (
            <span className="playlist-cover-placeholder"><Music2 size={36} /></span>
          )}
          <div>
            <strong>Ảnh bìa playlist</strong>
            <span className="field-hint">JPG, PNG, WebP · Tối đa 5 MB</span>
            <label className="form-secondary file-button">
              <ImagePlus size={16} /> {cover || savedPlaylist?.coverUrl ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa'}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                aria-label="Chọn ảnh bìa playlist"
                disabled={busy}
                onChange={(e) => { chooseCover(e.target.files[0]); e.target.value = ''; }}
              />
            </label>
            {(cover || (!removeCover && savedPlaylist?.coverUrl)) && (
              <button type="button" className="form-text-button is-danger" disabled={busy}
                onClick={() => { setCover(null); setRemoveCover(true); }}>
                <Trash2 size={14} /> Xóa ảnh bìa
              </button>
            )}
          </div>
        </div>
        <label className="form-label">
          Tên playlist
          <input
            required
            maxLength={100}
            placeholder="Một chiều thật chậm..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="form-label">
          Mô tả
          <textarea
            maxLength={500}
            rows={2}
            placeholder="Vài điều về playlist này"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="form-label">
          Chọn bài hát <span className="muted">({ids.length})</span>
        </div>
        <div className="playlist-track-picker">
          {tracks.map((track) => (
            <label key={track.id}>
              <input
                type="checkbox"
                checked={ids.includes(track.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked ? [...ids, track.id] : ids.filter((id) => id !== track.id),
                  )
                }
              />
              <img src={track.coverUrl || '/favicon.svg'} alt="" />
              <span>
                <strong>{track.title}</strong>
                <small>{track.artist}</small>
              </span>
            </label>
          ))}
        </div>
        {cover && (
          <label className="license-checkbox">
            <input type="checkbox" checked={licensed} onChange={(e) => setLicensed(e.target.checked)} />
            <span>Tôi có quyền sử dụng ảnh bìa này.</span>
          </label>
        )}
        {busy && cover && <div className="upload-progress" role="status">
          <div><span>Đang tải ảnh bìa…</span><strong>{Math.round(progress)}%</strong></div>
          <progress max="100" value={progress} aria-label="Tiến trình tải ảnh bìa playlist" />
        </div>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary-btn" type="submit">
          {busy ? 'Đang lưu...' : 'Lưu playlist'}
        </button>
      </form>
    </Modal>
  );
}

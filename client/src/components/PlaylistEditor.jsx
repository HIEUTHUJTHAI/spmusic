import { useState } from 'react';
import { api } from '../lib/api';
import Modal from './Modal';

export default function PlaylistEditor({ playlist, tracks, onClose, onSaved }) {
  const [name, setName] = useState(playlist?.name || '');
  const [description, setDescription] = useState(playlist?.description || '');
  const [ids, setIds] = useState(playlist?.trackIds || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(playlist?.id ? '/playlists/' + playlist.id : '/playlists', {
        method: playlist?.id ? 'PATCH' : 'POST',
        body: { name, description, trackIds: ids },
      });
      onSaved(result.playlist);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={playlist?.id ? 'Chỉnh sửa playlist' : 'Tạo playlist của bạn'} onClose={onClose}>
      <form className="modal-stack" onSubmit={save}>
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

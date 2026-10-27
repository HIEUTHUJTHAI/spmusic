import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import Modal from './Modal';
import LyricsAI from './LyricsAI';

export default function LyricsEditor({ track, onClose, onSaved }) {
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState(false);
  const [aligning, setAligning] = useState(false);

  useEffect(() => {
    let valid = true;
    if (track.hasLyrics) {
      api('/tracks/' + track.id + '/lyrics')
        .then((result) => {
          if (valid) setContent(result.content);
        })
        .catch((e) => {
          if (valid) setError(e.message);
        })
        .finally(() => {
          if (valid) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => {
      valid = false;
    };
  }, [track.id]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/tracks/' + track.id + '/lyrics', {
        method: 'PUT',
        body: { content },
      });
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function selectFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 256 * 1024) {
      setError('LRC tối đa 256 KB.');
      return;
    }
    setContent(await file.text());
    setRemove(false);
    setError('');
  }

  async function deleteLyrics() {
    setBusy(true);
    try {
      await api('/tracks/' + track.id + '/lyrics', { method: 'DELETE' });
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Lời bài hát đồng bộ" onClose={() => !busy && !aligning && onClose()} wide>
      <form className="modal-stack" onSubmit={save}>
        <p className="muted">
          {track.title} • Dán lời rồi dùng AI căn thời gian, hoặc nhập LRC có sẵn.
        </p>
        <label className="file-select">
          Tải file LRC
          <input
            type="file"
            accept=".lrc,text/plain"
            disabled={loading || busy || aligning}
            onChange={selectFile}
          />
        </label>
        <textarea
          className="lrc-editor"
          aria-label="Nội dung lyrics"
          value={content}
          disabled={loading || busy || aligning}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          placeholder={'Dán lời bài hát, mỗi câu một dòng\nBấm AI căn thời gian để tạo mốc tự động'}
        />
        <LyricsAI
          content={content}
          trackId={track.id}
          disabled={loading || busy}
          onChange={setContent}
          onBusyChange={setAligning}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {remove ? (
          <div className="delete-lyrics-confirm">
            <p>Xóa lời bài hát khỏi bài này?</p>
            <button type="button" className="secondary-btn" onClick={() => setRemove(false)}>
              Giữ lại
            </button>
            <button type="button" className="danger-btn" disabled={busy} onClick={deleteLyrics}>
              Xác nhận xóa
            </button>
          </div>
        ) : (
          <div className="dialog-actions">
            {track.hasLyrics && (
              <button
                type="button"
                className="danger-text"
                disabled={busy || aligning}
                onClick={() => setRemove(true)}
              >
                <Trash2 size={15} />
                Xóa lyrics
              </button>
            )}
            <button
              className="primary-btn"
              disabled={busy || loading || aligning || !content.trim()}
            >
              {busy ? 'Đang lưu...' : 'Lưu lời bài hát'}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}

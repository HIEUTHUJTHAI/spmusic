import { useEffect, useState } from 'react';
import { Check, Download, Music2, Palette, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { api } from '../lib/api';

const themes = [
  ['pink', 'Trắng hồng', '#c83776'],
  ['lavender', 'Trắng tím', '#7551ba'],
  ['mint', 'Trắng xanh', '#207f6c'],
  ['dark', 'Đêm hồng', '#f499bc'],
];
const defaultCustomTheme = {
  accent: '#bb326c', background: '#fff9fc', surface: '#ffffff', text: '#382934',
};
const customColors = [
  ['accent', 'Màu nhấn'],
  ['background', 'Nền trang'],
  ['surface', 'Thẻ và thanh điều hướng'],
  ['text', 'Màu chữ'],
];

export default function SettingsModal({ user, tracks, onUser, onDeleted, onEditTrack, onClose }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [query, setQuery] = useState(''),
    [deleting, setDeleting] = useState(null),
    [update, setUpdate] = useState(null),
    [appVersion, setAppVersion] = useState(''),
    [customTheme, setCustomTheme] = useState({ ...defaultCustomTheme, ...user.customTheme });
  const desktop = typeof window !== 'undefined' ? window.spmusicDesktop : null;
  useEffect(() => {
    setCustomTheme({ ...defaultCustomTheme, ...user.customTheme });
  }, [user.customTheme]);
  useEffect(() => {
    if (!desktop) return undefined;
    let active = true;
    desktop.version().then((version) => active && setAppVersion(version));
    const unsubscribe = desktop.onUpdate((state) => active && setUpdate(state));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [desktop]);
  const own = tracks.filter((t) => !t.isDemo && t.ownerId === user.id);
  const filtered = own.filter((t) =>
    `${t.title} ${t.artist}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
  );
  async function action(fn, message) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Cài đặt" wide onClose={() => !busy && onClose()}>
      <section className="settings-section">
        {desktop && (
          <>
            <h3>
              <Download size={18} /> Cập nhật SPMusic
              {appVersion && <span className="settings-count">v{appVersion}</span>}
            </h3>
            <p className="form-description">
              Kiểm tra phiên bản mới. Dữ liệu nhạc, tài khoản và cài đặt được giữ lại khi cập nhật.
            </p>
            <div className="update-controls">
              <button
                className="form-secondary"
                disabled={busy || ['checking', 'downloading'].includes(update?.status)}
                onClick={() => desktop.checkForUpdates()}
              >
                <RefreshCw size={15} /> Kiểm tra cập nhật
              </button>
              {update?.status === 'available' && (
                <button className="form-primary" onClick={() => desktop.downloadUpdate()}>
                  <Download size={15} /> Tải bản {update.version}
                </button>
              )}
              {update?.status === 'downloaded' && (
                <button className="form-primary" onClick={() => desktop.installUpdate()}>
                  Khởi động lại để cập nhật
                </button>
              )}
            </div>
            {update?.status === 'downloading' && (
              <p className="form-description" role="status">
                Đang tải… {update.progress || 0}%
              </p>
            )}
            {update?.message && !['checking', 'downloading'].includes(update.status) && (
              <p className={update.status === 'error' ? 'form-error' : 'form-success'} role="status">
                {update.message}
              </p>
            )}
          </>
        )}
      </section>
      <section className="settings-section">
        <h3>
          <Palette size={18} /> Màu giao diện
        </h3>
        <p className="form-description">
          Chọn màu bạn thích. SPMusic lưu lựa chọn theo tài khoản của bạn.
        </p>
        <div className="theme-options" role="group" aria-label="Màu giao diện">
          {[...themes, ['custom', 'Tự chọn', user.customTheme?.accent || defaultCustomTheme.accent]].map(([id, name, color]) => (
            <button
              key={id}
              disabled={busy}
              aria-pressed={user.theme === id}
              className={`theme-choice ${user.theme === id ? 'selected' : ''}`}
              onClick={() =>
                action(async () => {
                  onUser(
                    (await api('/account/preferences', { method: 'PATCH', body: {
                      theme: id,
                      ...(id === 'custom' ? { customTheme } : {}),
                    } }))
                      .user,
                  );
                }, `Đã chọn giao diện ${name.toLowerCase()}.`)
              }
            >
              <span className="theme-swatch" style={{ background: color }} />
              {name}
              {user.theme === id && <Check size={15} />}
            </button>
          ))}
        </div>
        {user.theme === 'custom' && (
          <div className="custom-theme-editor">
            <strong>Tạo bảng màu của bạn</strong>
            <p className="field-hint">Chọn màu nhấn, nền, bề mặt và màu chữ. Hãy chọn màu chữ dễ đọc trên nền.</p>
            <div className="custom-theme-grid">
              {customColors.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input type="color" aria-label={label} value={customTheme[key]}
                    disabled={busy}
                    onChange={(event) => setCustomTheme((previous) => ({ ...previous, [key]: event.target.value }))} />
                </label>
              ))}
            </div>
            <div className="custom-theme-preview" style={{ background: customTheme.background, color: customTheme.text }}>
              <span style={{ background: customTheme.surface }}>Không gian âm nhạc của bạn</span>
              <span className="theme-swatch" style={{ background: customTheme.accent }} />
            </div>
            <button className="form-primary" disabled={busy || JSON.stringify(customTheme) === JSON.stringify(user.customTheme)}
              onClick={() => action(async () => {
                onUser((await api('/account/preferences', {
                  method: 'PATCH', body: { theme: 'custom', customTheme },
                })).user);
              }, 'Đã lưu bảng màu tùy chỉnh.')}>
              <Check size={15} /> Lưu màu tùy chỉnh
            </button>
          </div>
        )}
      </section>
      <section className="settings-section">
        <h3>
          <Music2 size={18} /> Nhạc đã thêm <span className="settings-count">{own.length}</span>
        </h3>
        <p className="form-description">
          Quản lý các bài nhạc bạn đã tải lên. Xóa bài hát cũng xóa file nhạc, ảnh bìa, lyrics và
          bài đó khỏi playlist.
        </p>
        <label className="settings-search">
          Tìm trong nhạc đã thêm
          <input
            aria-label="Tìm trong nhạc đã thêm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên bài hát hoặc nghệ sĩ"
          />
        </label>
        <div className="settings-tracks">
          {!filtered.length && (
            <p className="settings-empty">
              {own.length ? 'Không có bài hát phù hợp.' : 'Bạn chưa tải lên bài hát nào.'}
            </p>
          )}
          {filtered.map((track) => (
            <div className="settings-track" key={track.id}>
              <img src={track.coverUrl || '/covers/fallback.svg'} alt="" />
              <div className="settings-track-name">
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </div>
              <button
                className="icon-btn"
                aria-label={`Sửa ảnh bìa và thông tin ${track.title}`}
                title="Sửa ảnh bìa và thông tin"
                disabled={busy}
                onClick={() => onEditTrack(track)}
              >
                <Pencil size={17} />
              </button>
              <button
                className="icon-btn danger"
                aria-label={`Xóa ${track.title}`}
                disabled={busy}
                onClick={() => setDeleting(track.id)}
              >
                <Trash2 size={18} />
              </button>
              {deleting === track.id && (
                <div
                  className="delete-confirm"
                  role="group"
                  aria-label={`Xác nhận xóa ${track.title}`}
                >
                  <p>Xóa “{track.title}”? Thao tác này không thể hoàn tác.</p>
                  <div>
                    <button
                      className="form-secondary"
                      disabled={busy}
                      onClick={() => setDeleting(null)}
                    >
                      Giữ lại
                    </button>
                    <button
                      className="danger-btn"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await api('/tracks/' + track.id, { method: 'DELETE' });
                          setDeleting(null);
                          onDeleted(track.id);
                        }, 'Đã xóa bài hát khỏi thư viện.')
                      }
                    >
                      Xác nhận xóa
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
    </Modal>
  );
}

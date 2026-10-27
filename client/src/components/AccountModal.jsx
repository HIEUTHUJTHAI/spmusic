import { useEffect, useState } from 'react';
import { Camera, LockKeyhole, LoaderCircle } from 'lucide-react';
import Modal from './Modal';
import { api, upload } from '../lib/api';

export function Avatar({ user, className = '' }) {
  return (
    <span className={`avatar-image ${className}`}>
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={`Ảnh đại diện của ${user.name}`} />
      ) : (
        user.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export default function AccountModal({ user, onUser, onClose }) {
  const [file, setFile] = useState(null),
    [preview, setPreview] = useState(null);
  const [currentPassword, setCurrent] = useState(''),
    [newPassword, setNew] = useState(''),
    [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function action(fn, success) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(success);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function choose(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    setError('');
    setMessage('');
    if (
      !/\.(png|jpe?g|webp)$/i.test(selected.name) ||
      !selected.size ||
      selected.size > 5 * 1024 * 1024
    ) {
      setError('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.');
      return;
    }
    setFile(selected);
  }
  return (
    <Modal title="Tài khoản của bạn" onClose={() => !busy && onClose()}>
      <div className="account-profile">
        <Avatar user={{ ...user, avatarUrl: preview || user.avatarUrl }} className="avatar-large" />
        <div>
          <h3>{user.name}</h3>
          <p className="form-description">{user.email}</p>
        </div>
      </div>
      <section className="account-section">
        <h3>
          <Camera size={17} /> Ảnh đại diện
        </h3>
        <p className="form-description">JPG, PNG hoặc WebP · Tối đa 5 MB</p>
        <div className="account-actions">
          <label className="file-button form-secondary">
            Chọn ảnh
            <input
              aria-label="Chọn ảnh đại diện"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={choose}
              disabled={busy}
            />
          </label>
          {file && (
            <button
              className="form-primary"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  setProgress(0);
                  const form = new FormData();
                  form.set('avatar', file);
                  const data = await upload('/account/avatar', form, setProgress, 'PUT');
                  onUser(data.user);
                  setFile(null);
                }, 'Đã cập nhật ảnh đại diện.')
              }
            >
              Lưu ảnh
            </button>
          )}
          {user.avatarUrl && !file && (
            <button
              className="form-secondary"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  onUser((await api('/account/avatar', { method: 'DELETE' })).user);
                }, 'Đã gỡ ảnh đại diện.')
              }
            >
              Gỡ ảnh
            </button>
          )}
          {file && (
            <button className="form-text-button" disabled={busy} onClick={() => setFile(null)}>
              Bỏ chọn
            </button>
          )}
        </div>
        {file && (
          <p className="field-hint">
            {file.name}
            {busy ? ` · Đang tải ${progress}%` : ''}
          </p>
        )}
      </section>
      <form
        className="aural-form account-section"
        onSubmit={(event) => {
          event.preventDefault();
          if (newPassword !== confirmation) {
            setError('Hai mật khẩu mới chưa trùng nhau.');
            setMessage('');
            return;
          }
          action(async () => {
            await api('/account/password', {
              method: 'PUT',
              body: { currentPassword, newPassword },
            });
            setCurrent('');
            setNew('');
            setConfirmation('');
          }, 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã được đăng xuất.');
        }}
      >
        <h3>
          <LockKeyhole size={17} /> Đổi mật khẩu
        </h3>
        <label>
          Mật khẩu hiện tại
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            disabled={busy}
            placeholder="Từ 8 đến 128 ký tự"
          />
        </label>
        <label>
          Nhập lại mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={busy}
          />
        </label>
        <button className="form-primary" disabled={busy}>
          {busy && <LoaderCircle size={16} className="spin" />}Đổi mật khẩu
        </button>
      </form>
      {error && (
        <p className="form-error account-feedback" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success account-feedback" role="status">
          {message}
        </p>
      )}
    </Modal>
  );
}

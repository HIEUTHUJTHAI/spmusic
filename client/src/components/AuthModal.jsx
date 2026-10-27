import { useState } from 'react';
import { ArrowRight, LoaderCircle, AudioLines } from 'lucide-react';
import { api } from '../lib/api';
import Modal from './Modal';

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password },
      });
      onSuccess?.(user);
    } catch (e) {
      setError(e.message || 'Không thể kết nối. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={mode === 'login' ? 'Mừng bạn trở lại.' : 'Bắt đầu không gian riêng.'}
      onClose={() => !busy && onClose?.()}
    >
      <div className="auth-intro">
        <span className="auth-symbol">
          <AudioLines size={25} />
        </span>
        <p>
          Lưu những giai điệu yêu thích.
          <br />
          Mang theo thế giới âm nhạc của bạn.
        </p>
      </div>
      <div className="form-tabs" role="tablist" aria-label="Tài khoản">
        <button
          role="tab"
          aria-selected={mode === 'login'}
          disabled={busy}
          className={mode === 'login' ? 'selected' : ''}
          onClick={() => {
            setMode('login');
            setError('');
          }}
        >
          Đăng nhập
        </button>
        <button
          role="tab"
          aria-selected={mode === 'register'}
          disabled={busy}
          className={mode === 'register' ? 'selected' : ''}
          onClick={() => {
            setMode('register');
            setError('');
          }}
        >
          Tạo tài khoản
        </button>
      </div>
      <form onSubmit={submit} className="aural-form">
        {mode === 'register' && (
          <label>
            Tên hiển thị
            <input
              name="name"
              autoComplete="name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bạn muốn được gọi là…"
            />
          </label>
        )}
        <label>
          Email
          <input
            data-autofocus
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@example.com"
          />
        </label>
        <label>
          Mật khẩu
          <input
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 8 : undefined}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu của bạn'}
          />
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="form-primary" disabled={busy}>
          {busy ? <LoaderCircle size={18} className="spinning" /> : <ArrowRight size={18} />}
          {busy ? 'Đang kết nối…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </button>
        <p className="form-footnote">Tài khoản và thư viện của bạn được lưu trên máy chủ cục bộ.</p>
      </form>
    </Modal>
  );
}

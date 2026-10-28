import { useEffect, useState } from 'react';
import { Check, Download, ImagePlus, Music2, Palette, Pencil, RefreshCw, RotateCcw, SlidersHorizontal, Trash2, Waves, X } from 'lucide-react';
import Modal from './Modal';
import { api, upload } from '../lib/api';
import { EQ_FREQUENCIES, EQ_PRESETS } from '../lib/audioSettings';

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

export default function SettingsModal({ user, tracks, player, onUser, onDeleted, onEditTrack, onClose }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [query, setQuery] = useState(''),
    [deleting, setDeleting] = useState(null),
    [update, setUpdate] = useState(null),
    [appVersion, setAppVersion] = useState(''),
    [customTheme, setCustomTheme] = useState({ ...defaultCustomTheme, ...user.customTheme }),
    [eqOpen, setEqOpen] = useState(false),
    [olderVersions, setOlderVersions] = useState([]),
    [versionsBusy, setVersionsBusy] = useState(false),
    [selectedVersion, setSelectedVersion] = useState(''),
    [rollback, setRollback] = useState(null),
    [backgroundFile, setBackgroundFile] = useState(null),
    [backgroundPreview, setBackgroundPreview] = useState(''),
    [backgroundProgress, setBackgroundProgress] = useState(null);
  const desktop = typeof window !== 'undefined' ? window.spmusicDesktop : null;
  useEffect(() => {
    setCustomTheme({ ...defaultCustomTheme, ...user.customTheme });
  }, [user.customTheme]);
  useEffect(() => {
    if (!backgroundFile) {
      setBackgroundPreview('');
      return undefined;
    }
    const preview = URL.createObjectURL(backgroundFile);
    setBackgroundPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [backgroundFile]);
  useEffect(() => {
    if (!desktop) return undefined;
    let active = true;
    let sawUpdate = false;
    desktop.version().then((version) => active && setAppVersion(version));
    const unsubscribe = desktop.onUpdate((state) => {
      sawUpdate = true;
      if (active) setUpdate(state);
    });
    desktop.getUpdateState().then((state) => {
      if (active && !sawUpdate) setUpdate(state);
    }).catch(() => {});
    const unsubscribeRollback = desktop.onRollback?.((state) => active && setRollback(state));
    return () => {
      active = false;
      unsubscribe?.();
      unsubscribeRollback?.();
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
  async function loadOlderVersions() {
    setVersionsBusy(true);
    setError('');
    try {
      const result = await desktop.listOlderVersions();
      if (result.error) throw new Error(result.error);
      setOlderVersions(result.versions);
      setSelectedVersion((current) => current || result.versions[0]?.version || '');
      if (!result.versions.length) setRollback({ status: 'empty' });
    } catch (e) {
      setError(e.message);
    } finally {
      setVersionsBusy(false);
    }
  }
  async function downloadOlderVersion() {
    if (!selectedVersion) return;
    setError('');
    const result = await desktop.downloadOlderVersion(selectedVersion);
    if (result.error) setError(result.error);
  }
  async function installOlderVersion() {
    const result = await desktop.installOlderVersion(rollback.version);
    if (result.error) setError(result.error);
  }
  function chooseBackground(file) {
    setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setError('Ảnh nền phải là file JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ảnh nền không được vượt quá 10 MB.');
      return;
    }
    setBackgroundFile(file);
  }
  async function saveBackground() {
    if (!backgroundFile) return;
    await action(async () => {
      const data = new FormData();
      data.set('background', backgroundFile);
      setBackgroundProgress(0);
      try {
        onUser((await upload('/account/background', data, setBackgroundProgress, 'PUT')).user);
        setBackgroundFile(null);
      } finally {
        setBackgroundProgress(null);
      }
    }, 'Đã thay ảnh nền của bạn.');
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
            <div className="rollback-controls">
              <button className="form-secondary" disabled={versionsBusy || rollback?.status === 'downloading'}
                onClick={loadOlderVersions}>
                <RotateCcw size={15} /> {versionsBusy ? 'Đang tìm bản cũ…' : 'Lùi về phiên bản trước'}
              </button>
              {olderVersions.length > 0 && (
                <div className="rollback-picker">
                  <label htmlFor="older-version">Chọn phiên bản</label>
                  <select id="older-version" value={selectedVersion}
                    disabled={rollback?.status === 'downloading'}
                    onChange={(event) => setSelectedVersion(event.target.value)}>
                    {olderVersions.map((entry) => (
                      <option key={entry.version} value={entry.version}>SPMusic {entry.version}</option>
                    ))}
                  </select>
                  <button className="form-secondary" disabled={rollback?.status === 'downloading'}
                    onClick={downloadOlderVersion}>
                    <Download size={15} /> Tải bản đã chọn
                  </button>
                </div>
              )}
              {olderVersions.length === 0 && selectedVersion === '' && !versionsBusy && rollback?.status === 'empty' && (
                <p className="form-description">Chưa có bản cũ phù hợp để cài.</p>
              )}
              {rollback?.status === 'downloading' && (
                <p className="form-description" role="status">Đang tải và kiểm tra bản {rollback.version}… {rollback.progress}%</p>
              )}
              {rollback?.status === 'ready' && rollback.version === selectedVersion && (
                <div className="rollback-ready" role="status">
                  <p>Bản {rollback.version} đã tải xong và được kiểm tra. Nên sao lưu thư viện trước khi cài bản cũ vì dữ liệu tạo ở bản mới có thể không tương thích.</p>
                  <button className="form-primary" onClick={installOlderVersion}>
                    Cài phiên bản {rollback.version}
                  </button>
                </div>
              )}
              {rollback?.status === 'error' && <p className="form-error" role="alert">{rollback.message}</p>}
            </div>
          </>
        )}
      </section>
      <section className="settings-section">
        <h3><Waves size={18} /> Chuyển tiếp và âm thanh</h3>
        <p className="form-description">Tùy chỉnh cách chuyển bài và âm sắc. Cài đặt này được lưu trên thiết bị.</p>
        <label className="audio-toggle">
          <span><strong>AutoMix</strong><small>Chuyển mượt khoảng 5 giây trước khi hết bài, sớm hơn nếu đoạn cuối yên lặng.</small></span>
          <input type="checkbox" role="switch" checked={player.automix}
            onChange={(event) => player.setAutomix(event.target.checked)} />
        </label>
        <label className="audio-toggle">
          <span><strong>Bộ chỉnh EQ</strong><small>Điều chỉnh bass, giọng hát và treble theo thời gian thực.</small></span>
          <input type="checkbox" role="switch" checked={player.eqEnabled}
            onChange={(event) => {
              player.setEqEnabled(event.target.checked);
              setEqOpen(event.target.checked);
            }} />
        </label>
        {player.eqEnabled && (
          <button className="form-secondary eq-open-button" onClick={() => setEqOpen((value) => !value)}>
            <SlidersHorizontal size={16} /> {eqOpen ? 'Ẩn bảng EQ' : 'Mở bảng EQ'}
          </button>
        )}
        {player.eqEnabled && eqOpen && (
          <div className="eq-window" role="group" aria-label="Bảng điều chỉnh EQ">
            <div className="eq-window-heading">
              <strong><SlidersHorizontal size={17} /> Bộ chỉnh EQ</strong>
              <button className="icon-btn" aria-label="Đóng bảng EQ" onClick={() => setEqOpen(false)}><X size={17} /></button>
            </div>
            <label className="eq-preset">Chế độ
              <select value={player.eqPreset} onChange={(event) => player.setEqPreset(event.target.value)}>
                {Object.entries(EQ_PRESETS).map(([id, preset]) =>
                  <option key={id} value={id}>{preset.label}</option>)}
                {player.eqPreset === 'custom' && <option value="custom">Tùy chỉnh</option>}
              </select>
            </label>
            <div className="eq-bands">
              {EQ_FREQUENCIES.map((frequency, index) => (
                <label key={frequency}>
                  <span>{frequency >= 1000 ? `${frequency / 1000}k` : frequency} Hz</span>
                  <input type="range" min="-12" max="12" step="1" value={player.eqBands[index]}
                    aria-label={`EQ ${frequency} Hz`}
                    onChange={(event) => player.setEqBand(index, Number(event.target.value))} />
                  <output>{player.eqBands[index] > 0 ? '+' : ''}{player.eqBands[index]} dB</output>
                </label>
              ))}
            </div>
            <button className="form-secondary" onClick={() => player.setEqPreset('flat')}>
              <RotateCcw size={15} /> Đặt lại EQ
            </button>
          </div>
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
        <h3><ImagePlus size={18} /> Ảnh nền ứng dụng</h3>
        <p className="form-description">Chọn ảnh riêng để đặt sau giao diện kính mờ. Ảnh được lưu theo tài khoản và hiển thị cả khi dùng app offline trên máy này.</p>
        <div className="background-preview" style={backgroundPreview || user.backgroundUrl ? {
          backgroundImage: `url("${backgroundPreview || user.backgroundUrl}")`,
        } : undefined}>
          {!backgroundPreview && !user.backgroundUrl && <span>Chưa có ảnh nền · SPMusic dùng nền màu hiện tại</span>}
          <span className="background-preview-glass">SPMusic · Liquid Glass</span>
        </div>
        <div className="background-actions">
          <label className="form-secondary background-file-button">
            <ImagePlus size={15} /> Chọn ảnh JPG, PNG hoặc WebP
            <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              disabled={busy} onChange={(event) => chooseBackground(event.target.files?.[0])} />
          </label>
          {backgroundFile && (
            <button className="form-primary" disabled={busy} onClick={saveBackground}>
              <Check size={15} /> Lưu ảnh nền
            </button>
          )}
          {user.backgroundUrl && (
            <button className="form-secondary" disabled={busy} onClick={() => action(async () => {
              onUser((await api('/account/background', { method: 'DELETE' })).user);
              setBackgroundFile(null);
            }, 'Đã xóa ảnh nền.')}>
              <Trash2 size={15} /> Xóa ảnh nền
            </button>
          )}
        </div>
        {backgroundFile && <p className="field-hint">Ảnh đã chọn: {backgroundFile.name} · tối đa 10 MB</p>}
        {backgroundProgress !== null && <p className="form-description" role="status">Đang tải ảnh nền… {backgroundProgress}%</p>}
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

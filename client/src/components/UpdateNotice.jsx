import { useEffect, useState } from 'react';
import { ArrowDownToLine, BellRing, RefreshCw, X } from 'lucide-react';
import './update-notice.css';

export default function UpdateNotice() {
  const desktop = typeof window !== 'undefined' ? window.spmusicDesktop : null;
  const [update, setUpdate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!desktop) return undefined;
    let active = true;
    let sawEvent = false;
    const unsubscribe = desktop.onUpdate((state) => {
      sawEvent = true;
      if (active) setUpdate(state);
    });
    desktop.getUpdateState().then((state) => {
      if (active && !sawEvent) setUpdate(state);
    }).catch(() => {});
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [desktop]);

  if (!update?.noticeVisible) return null;

  async function action(task) {
    setBusy(true);
    setError('');
    try {
      const result = await task();
      if (result?.error) throw new Error(result.error);
    } catch (reason) {
      setError(reason.message || 'Không thể hoàn tất thao tác cập nhật.');
    } finally {
      setBusy(false);
    }
  }

  const downloading = update.status === 'downloading';
  const downloaded = update.status === 'downloaded';
  return (
    <section className="update-notice" role="dialog" aria-labelledby="update-notice-title">
      <div className="update-notice-header">
        <span className="update-notice-icon"><BellRing size={19} /></span>
        <div>
          <span className="update-notice-eyebrow">CẬP NHẬT SPMUSIC</span>
          <h2 id="update-notice-title">Có phiên bản {update.version} mới</h2>
        </div>
        {!downloading && !downloaded && (
          <button className="update-notice-close" aria-label="Để sau"
            disabled={busy} onClick={() => action(() => desktop.dismissUpdateNotice(update.version, 'later'))}>
            <X size={17} />
          </button>
        )}
      </div>
      <p>
        {downloaded ? 'Đã tải xong. Khởi động lại để cài bản mới.' :
          downloading ? `Đang tải bản cập nhật… ${update.progress || 0}%` :
          update.status === 'error' ? update.message :
          'Bản mới đã sẵn sàng. Bạn chọn thời điểm tải và cài đặt.'}
      </p>
      {downloading && <progress value={update.progress || 0} max="100" aria-label="Tiến trình tải bản cập nhật" />}
      {error && <p className="update-notice-error" role="alert">{error}</p>}
      <div className="update-notice-actions">
        {!downloading && (
          <button className="update-notice-primary" disabled={busy}
            onClick={() => action(() => downloaded ? desktop.installUpdate() : desktop.downloadUpdate())}>
            {downloaded ? <RefreshCw size={16} /> : <ArrowDownToLine size={16} />}
            {downloaded ? 'Khởi động lại để cập nhật' :
              update.status === 'error' ? 'Thử tải lại' : 'Cập nhật ngay'}
          </button>
        )}
        {!downloading && !downloaded && (
          <>
            <button disabled={busy}
              onClick={() => action(() => desktop.dismissUpdateNotice(update.version, 'later'))}>
              Để sau
            </button>
            <button disabled={busy}
              onClick={() => action(() => desktop.dismissUpdateNotice(update.version, 'never'))}>
              Không nhắc bản này
            </button>
          </>
        )}
      </div>
    </section>
  );
}

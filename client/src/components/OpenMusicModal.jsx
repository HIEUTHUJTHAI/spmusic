import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, Globe2, LoaderCircle, Search } from 'lucide-react';
import Modal from './Modal';
import { api } from '../lib/api';
import './open-music.css';

const terminal = (status) => ['completed', 'failed', 'cancelled'].includes(status);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export function SourceCredit({ info }) {
  if (!info) return null;
  return (
    <div className="source-credit">
      <strong>{info.title}</strong>
      <p>{info.credit || info.artist}</p>
      <div>
        <a href={info.sourceUrl} target="_blank" rel="noreferrer">
          Nguồn: {info.providerName || info.source} <ExternalLink size={12} />
        </a>
        {info.license?.url && <a href={info.license.url} target="_blank" rel="noreferrer">
          {info.license.name} <ExternalLink size={12} />
        </a>}
      </div>
      {info.downloadedAt && (
        <p>
          Đã tải bản {info.format} · {new Date(info.downloadedAt).toLocaleDateString('vi-VN')}
          {info.provider !== 'youtube' && ' · Giữ nguyên nội dung âm thanh'}
        </p>
      )}
    </div>
  );
}

export default function OpenMusicModal({ open, onClose, onImported }) {
  const [query, setQuery] = useState(''),
    [source, setSource] = useState('all'),
    [search, setSearch] = useState(null),
    [items, setItems] = useState([]),
    [warnings, setWarnings] = useState([]),
    [page, setPage] = useState(1),
    [more, setMore] = useState(false),
    [selected, setSelected] = useState(null),
    [tracks, setTracks] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [job, setJob] = useState(null),
    [pollError, setPollError] = useState('');
  const onImportedRef = useRef(onImported),
    reported = useRef(null),
    loadController = useRef(null);
  onImportedRef.current = onImported;
  const working = job && !terminal(job.status);
  useEffect(() => {
    const controller = new AbortController();
    api('/open-music/jobs/active', { signal: controller.signal })
      .then((data) => setJob(data.job))
      .catch((e) => {
        if (!controller.signal.aborted) setPollError(e.message);
      });
    return () => {
      controller.abort();
      loadController.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (job?.status === 'completed' && reported.current !== job.id) {
      reported.current = job.id;
      onImportedRef.current(job.track, job.existing);
    }
    if (!job || terminal(job.status)) return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const data = await api('/open-music/jobs/' + job.id, { signal: controller.signal });
        setPollError('');
        setJob(data.job);
        if (terminal(data.job.status)) return;
      } catch (e) {
        if (controller.signal.aborted) return;
        setPollError('Mất kết nối khi theo dõi tải nhạc. Đang thử kết nối lại…');
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1200);
    }
    timer = setTimeout(poll, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [job?.id, job?.status]);
  async function find(nextPage = 1) {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const request = nextPage === 1 ? { query, source } : search;
    if (!request) return;
    setBusy(true);
    setError('');
    setSelected(null);
    try {
      const data = await api(
        `/open-music/search?q=${encodeURIComponent(request.query)}&source=${request.source}&page=${nextPage}`,
        { signal: controller.signal },
      );
      setItems(
        nextPage === 1
          ? data.items
          : (prev) => [
              ...prev,
              ...data.items.filter(
                (item) => !prev.some((p) => p.id === item.id && p.source === item.source),
              ),
            ],
      );
      setWarnings(data.warnings);
      setPage(data.page);
      setMore(data.more);
      setSearch(request);
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function inspect(item) {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setSelected(item);
    setTracks([]);
    setBusy(true);
    setError('');
    try {
      setTracks(
        (
          await api(`/open-music/tracks?source=${item.source}&id=${encodeURIComponent(item.id)}`, {
            signal: controller.signal,
          })
        ).tracks,
      );
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function start(track) {
    setError('');
    setBusy(true);
    try {
      setJob(
        (
          await api('/open-music/jobs', {
            method: 'POST',
            body: { source: track.source, itemId: track.itemId, key: track.key },
          })
        ).job,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!open) return null;
  return (
    <Modal wide title="Nhạc mở từ internet" onClose={onClose}>
      <div className="open-music-intro">
        <span>
          <Globe2 size={23} />
        </span>
        <p>
          Tìm nhạc từ Internet Archive và Wikimedia Commons. Ưu tiên bản lossless có sẵn; nhạc tải
          về sẽ nằm trong thư viện riêng của bạn.
        </p>
      </div>
      <form
        className="open-music-search"
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <label>
          Tên bài, nghệ sĩ hoặc thể loại
          <input
            required
            minLength={2}
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ví dụ: piano, ambient, jazz…"
          />
        </label>
        <label>
          Nguồn nhạc
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">Tất cả nguồn</option>
            <option value="archive">Internet Archive</option>
            <option value="commons">Wikimedia Commons</option>
          </select>
        </label>
        <button className="form-primary" disabled={busy}>
          <Search size={16} />
          Tìm nhạc
        </button>
      </form>
      <p className="open-music-note">
        Chỉ nhận CC0, CC BY, CC BY-SA hoặc bản được nguồn đánh dấu thuộc phạm vi công cộng. Giấy
        phép do nguồn cung cấp; thông tin ghi công được lưu cùng bài hát. Tối đa 250 MB/bài.
      </p>
      {job && (
        <div className={`import-status ${job.status}`} role="status">
          <div>
            <strong>
              {working && <LoaderCircle className="spin" size={15} />} {job.message}
            </strong>
            {working && (
              <button
                className="form-text-button"
                disabled={job.status === 'saving'}
                onClick={async () => {
                  try {
                    setJob((await api('/open-music/jobs/' + job.id, { method: 'DELETE' })).job);
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Hủy tải
              </button>
            )}
          </div>
          {working && (
            <>
              <progress max="100" value={job.progress} />
              <small>
                {job.received
                  ? `${mb(job.received)}${job.total ? ' / ' + mb(job.total) : ''} · `
                  : ''}
                {job.progress}% · Có thể đóng cửa sổ này, app vẫn tiếp tục tải.
              </small>
            </>
          )}
          {job.track && <SourceCredit info={job.track.sourceInfo} />}
        </div>
      )}
      {pollError && (
        <p className="form-error" role="alert">
          {pollError}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {warnings.map((w) => (
        <p className="open-music-note" key={w}>
          {w}
        </p>
      ))}
      {selected ? (
        <section className="open-music-results">
          <button
            className="source-back"
            disabled={busy}
            onClick={() => {
              setSelected(null);
              setError('');
            }}
          >
            <ArrowLeft size={15} />
            Kết quả tìm kiếm
          </button>
          <h3>{selected.title}</h3>
          <p className="form-description">
            {selected.artist} · {selected.license.name}
          </p>
          {!busy && !tracks.length && (
            <p className="settings-empty">
              Nguồn này chưa có file phù hợp về định dạng, dung lượng hoặc giấy phép.
            </p>
          )}
          {tracks.map((track) => (
            <article className="open-track" key={track.key}>
              <div>
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
                <div className="quality-tags">
                  <b>
                    {track.lossless ? 'Lossless · ' : ''}
                    {track.format}
                  </b>
                  <span>{mb(track.size)}</span>
                  {track.bitrate > 0 && !track.lossless && <span>{track.bitrate} kbps</span>}
                </div>
                <small>
                  {track.alternatives > 1
                    ? `Đã chọn bản ưu tiên từ ${track.alternatives} phiên bản.`
                    : 'Bản gốc có sẵn từ nguồn.'}
                </small>
              </div>
              <button
                className="form-primary"
                disabled={busy || working}
                onClick={() => start(track)}
                aria-label={`Thêm ${track.title} vào thư viện`}
              >
                <Download size={15} />
                Thêm
              </button>
            </article>
          ))}
          <a className="source-link" href={selected.sourceUrl} target="_blank" rel="noreferrer">
            Xem trang nguồn và giấy phép <ExternalLink size={13} />
          </a>
        </section>
      ) : (
        <section className="open-music-results">
          {!search && !busy && (
            <div className="open-music-empty">
              <MusicNote />
              <strong>Khám phá những thanh âm mới</strong>
              <p>
                Nhập từ khóa để tìm bản thu có giấy phép mở. Bạn chọn bài, SPMusic chọn file ưu tiên
                và tải về.
              </p>
            </div>
          )}
          {search && !items.length && !busy && (
            <p className="settings-empty">
              Chưa có kết quả phù hợp. Thử từ khóa khác hoặc chọn nguồn khác.
            </p>
          )}
          {items.map((item) => (
            <button
              className="open-source-item"
              key={item.source + ':' + item.id}
              onClick={() => inspect(item)}
              disabled={busy}
            >
              <span className="source-icon">
                <Globe2 size={21} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.artist}</small>
                <em>
                  {item.source === 'archive' ? 'Internet Archive' : 'Wikimedia Commons'} ·{' '}
                  {item.license.name}
                </em>
              </span>
              <span className="source-open">Xem bài hát →</span>
            </button>
          ))}
          {more && (
            <button className="form-secondary" disabled={busy} onClick={() => find(page + 1)}>
              Xem thêm kết quả
            </button>
          )}
        </section>
      )}
      {busy && (
        <p className="source-loading" role="status">
          <LoaderCircle className="spin" size={17} />
          Đang kết nối nguồn nhạc…
        </p>
      )}
    </Modal>
  );
}
function MusicNote() {
  return <Globe2 size={35} />;
}

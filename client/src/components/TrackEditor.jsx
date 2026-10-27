import { useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  ImagePlus,
  FileMusic,
  FileText,
  LoaderCircle,
  Check,
  Trash2,
} from 'lucide-react';
import { api, upload } from '../lib/api';
import { parseLrc } from '../lib/lrc';
import Modal from './Modal';
import LyricsAI from './LyricsAI';

const MB = 1024 * 1024;
export default function TrackEditor({ track, onClose, onSaved }) {
  const editing = !!track;
  const [fields, setFields] = useState({
    title: track?.title || '',
    artist: track?.artist || '',
    album: track?.album || '',
    genre: track?.genre || '',
  });
  const [audio, setAudio] = useState(null);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkResults, setBulkResults] = useState([]);
  const [cover, setCover] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [removeLyrics, setRemoveLyrics] = useState(false);
  const [coverPreview, setCoverPreview] = useState(null);
  const [licensed, setLicensed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [aligning, setAligning] = useState(false);
  const lyricsRead = useRef(0);
  const bulk = bulkFiles.length > 1;
  useEffect(() => {
    if (!track?.hasLyrics) return;
    let cancelled = false;
    setLyricsLoading(true);
    api(`/tracks/${track.id}/lyrics`)
      .then((data) => {
        if (!cancelled) {
          setContent(data.content);
          setOriginalContent(data.content);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [track?.id]);
  useEffect(() => {
    if (!cover) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(cover);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);
  async function chooseFile(file, kind) {
    if (busy || aligning) return;
    setError('');
    if (!file) return;
    const ext = file.name.split('.').at(-1).toLowerCase();
    const rules = {
      audio: {
        types: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'oga', 'opus'],
        limit: 250 * MB,
        label: 'Chọn MP3, WAV, FLAC, ALAC (.m4a), OGG hoặc Opus, tối đa 250 MB.',
      },
      cover: {
        types: ['jpg', 'jpeg', 'png', 'webp'],
        limit: 5 * MB,
        label: 'Ảnh bìa phải là JPG, PNG hoặc WebP, tối đa 5 MB.',
      },
      lyrics: {
        types: ['lrc'],
        limit: 256 * 1024,
        label: 'Lyrics phải là file LRC, tối đa 256 KB.',
      },
    };
    const rule = rules[kind];
    if (!rule.types.includes(ext) || file.size > rule.limit || !file.size) {
      setError(rule.label);
      return;
    }
    if (kind === 'audio') {
      setAudio(file);
      if (!fields.title)
        setFields((value) => ({ ...value, title: file.name.replace(/\.[^.]+$/, '') }));
    }
    if (kind === 'cover') {
      setCover(file);
      setRemoveCover(false);
    }
    if (kind === 'lyrics') {
      const readId = ++lyricsRead.current;
      setLyricsLoading(true);
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
        if (readId !== lyricsRead.current) return;
        setLyrics(file);
        setRemoveLyrics(false);
        setContent(text);
      } catch {
        if (readId === lyricsRead.current)
          setError('Không thể đọc lyrics. Hãy chọn file LRC mã hóa UTF-8.');
      } finally {
        if (readId === lyricsRead.current) setLyricsLoading(false);
      }
    }
  }
  function chooseAudioFiles(selected) {
    if (busy || aligning) return;
    const files = Array.from(selected || []);
    if (!files.length) return;
    if (files.length > 50) {
      setError('Mỗi lượt chọn tối đa 50 bài hát.');
      return;
    }
    const allowed = new Set(['mp3', 'wav', 'flac', 'm4a', 'ogg', 'oga', 'opus']);
    const invalid = files.find((file) =>
      !allowed.has(file.name.split('.').at(-1)?.toLowerCase()) ||
      !file.size ||
      file.size > 250 * MB,
    );
    if (invalid) {
      setError(`File “${invalid.name}” không hợp lệ hoặc vượt 250 MB.`);
      return;
    }
    setError('');
    setBulkResults([]);
    if (files.length === 1) {
      setBulkFiles([]);
      chooseFile(files[0], 'audio');
    } else {
      setAudio(null);
      setBulkFiles(files);
    }
  }
  function field(key, label, placeholder, maxLength) {
    return (
      <label>
        {label}
        <input
          required={key === 'title' || key === 'artist'}
          maxLength={maxLength}
          value={fields[key]}
          onChange={(e) => setFields((previous) => ({ ...previous, [key]: e.target.value }))}
          placeholder={placeholder}
        />
      </label>
    );
  }
  async function save(event) {
    event.preventDefault();
    setError('');
    if (!editing && !audio && !bulk) {
      setError('Hãy chọn file MP3, WAV, FLAC hoặc ALAC (.m4a).');
      return;
    }
    if ((!editing || cover || lyrics || content !== originalContent) && !licensed) {
      setError('Vui lòng xác nhận quyền sử dụng nội dung trước khi lưu.');
      return;
    }
    if (bulk) {
      setBusy(true);
      const results = [...bulkResults];
      let newlySaved = 0;
      try {
        for (let i = 0; i < bulkFiles.length; i++) {
          if (results[i]?.ok) continue;
          const file = bulkFiles[i];
          const form = new FormData();
          form.append('title', file.name.replace(/\.[^.]+$/, '').trim().slice(0, 160) || 'Bài hát');
          form.append('artist', fields.artist.trim());
          form.append('album', fields.album.trim());
          form.append('genre', fields.genre.trim());
          form.append('audio', file);
          if (cover) form.append('cover', cover);
          try {
            await upload('/tracks', form, (value) =>
              setProgress(((i + value / 100) / bulkFiles.length) * 100),
            );
            results[i] = { ok: true, message: 'Đã thêm' };
            newlySaved++;
          } catch (e) {
            results[i] = { ok: false, message: e.message || 'Không thể thêm bài hát.' };
          }
          setBulkResults([...results]);
          setProgress(((i + 1) / bulkFiles.length) * 100);
        }
        const failures = results.filter((item) => !item?.ok).length;
        if (newlySaved) await onSaved?.({ count: newlySaved, stayOpen: failures > 0 });
        if (failures) setError(`${failures} bài chưa được thêm. Bạn có thể thử lại các bài lỗi.`);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!bulk && !removeLyrics && new TextEncoder().encode(content).length > 256 * 1024) {
      setError('Lyrics không được vượt quá 256 KB.');
      return;
    }
    if (!bulk && !removeLyrics && content.trim() && !parseLrc(content).length) {
      setError('Lyrics cần ít nhất một dòng có mốc thời gian, ví dụ [00:12.50] Lời bài hát.');
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      let result;
      if (editing) {
        result = await api(`/tracks/${track.id}`, { method: 'PATCH', body: fields });
        if (cover) {
          const form = new FormData();
          form.append('cover', cover);
          result = await upload(`/tracks/${track.id}/cover`, form, setProgress, 'PUT');
        } else if (removeCover) {
          result = await api(`/tracks/${track.id}/cover`, { method: 'DELETE' });
        }
        if (removeLyrics && track.hasLyrics)
          await api(`/tracks/${track.id}/lyrics`, { method: 'DELETE' });
        else if (content !== originalContent || lyrics)
          await api(`/tracks/${track.id}/lyrics`, { method: 'PUT', body: { content } });
      } else {
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.append(key, value.trim());
        form.append('audio', audio);
        if (cover) form.append('cover', cover);
        if (content.trim())
          form.append(
            'lyrics',
            new File([content], lyrics?.name || 'lyrics.lrc', { type: 'text/plain' }),
          );
        result = await upload('/tracks', form, setProgress);
      }
      onSaved?.(result?.track);
    } catch (e) {
      setError(e.message || 'Không thể lưu bài hát. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={editing ? 'Chỉnh sửa bài hát' : 'Thêm giai điệu của bạn'}
      onClose={() => !busy && !aligning && onClose?.()}
      wide
    >
      <form className="aural-form" onSubmit={save}>
        <p className="form-description">
          {editing
            ? 'Cập nhật thông tin và lời bài hát trong thư viện của bạn.'
            : 'Một bài hát, một câu chuyện. Thêm nhạc bạn sáng tác hoặc có quyền sử dụng.'}
        </p>
        {!editing && (
          <div
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              chooseAudioFiles(e.dataTransfer.files);
            }}
          >
            <UploadCloud size={30} />
            <strong>{bulk ? `${bulkFiles.length} bài hát đã chọn` : audio?.name || 'Kéo thả file nhạc vào đây'}</strong>
            <span>
              {bulk
                ? 'Sẽ thêm lần lượt từng bài; tên bài lấy từ tên file.'
                : audio
                ? `${(audio.size / MB).toFixed(1)} MB · Đã sẵn sàng`
                : 'MP3 · WAV · FLAC · ALAC · OGG · Opus · Tối đa 250 MB/bài'}
            </span>
            <label className="form-secondary file-button">
              {audio || bulk ? 'Chọn lại file' : 'Chọn một hoặc nhiều file nhạc'}
              <input
                type="file"
                multiple
                accept=".mp3,.wav,.flac,.m4a,.ogg,.oga,.opus,audio/mpeg,audio/wav,audio/flac,audio/mp4,audio/ogg"
                aria-label="Chọn một hoặc nhiều file nhạc MP3, WAV, FLAC, ALAC, OGG hoặc Opus"
                disabled={busy || aligning}
                onChange={(e) => { chooseAudioFiles(e.target.files); e.target.value = ''; }}
              />
            </label>
            <span className="field-hint">
              ALAC được tạo bản phát FLAC lossless. File M4A chứa AAC chưa được hỗ trợ.
            </span>
          </div>
        )}
        {bulk && (
          <div className="bulk-track-list" aria-label="Các bài hát đã chọn">
            {bulkFiles.map((file, index) => (
              <div key={`${file.name}-${index}`}>
                <span>{index + 1}. {file.name}</span>
                <small className={bulkResults[index]?.ok ? 'bulk-success' : 'bulk-error'}>
                  {bulkResults[index]?.message || `${(file.size / MB).toFixed(1)} MB`}
                </small>
              </div>
            ))}
          </div>
        )}
        <div className="track-editor-grid">
          <div className="cover-upload">
            {!removeCover && (coverPreview || track?.coverUrl) ? (
              <img src={coverPreview || track.coverUrl} alt="Ảnh bìa bài hát" />
            ) : (
              <div className="cover-placeholder">
                <FileMusic size={40} />
              </div>
            )}
            <label className="form-secondary file-button">
                <ImagePlus size={16} />
                {cover || (editing && track?.coverUrl !== '/covers/fallback.svg') ? 'Đổi ảnh bìa' : 'Thêm ảnh bìa'}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  aria-label="Chọn ảnh bìa"
                  disabled={busy || aligning}
                  onChange={(e) => { chooseFile(e.target.files[0], 'cover'); e.target.value = ''; }}
                />
              </label>
            {editing && (cover || (!removeCover && track?.coverUrl !== '/covers/fallback.svg')) && (
              <button
                type="button"
                className="form-text-button is-danger"
                disabled={busy || aligning}
                onClick={() => { setCover(null); setRemoveCover(true); }}
              >
                <Trash2 size={14} /> Xóa ảnh bìa
              </button>
            )}
            <span className="field-hint">
              JPG, PNG, WebP · Tối đa 5 MB
            </span>
          </div>
          <div className="metadata-fields">
            {!bulk && field('title', 'Tên bài hát *', 'Tên giai điệu của bạn', 160)}
            {field('artist', 'Nghệ sĩ *', 'Tên nghệ sĩ', 120)}
            <div className="form-two-columns">
              {field('album', 'Album', 'Đĩa đơn', 160)}
              {field('genre', 'Thể loại', 'Ambient, Indie…', 80)}
            </div>
            {bulk && <span className="field-hint">Nghệ sĩ, album, thể loại và ảnh bìa sẽ dùng chung. Bạn có thể sửa từng bài sau khi thêm.</span>}
          </div>
        </div>
        {!bulk && <>
        <div className="lyrics-editor-heading">
          <label className="field-title" htmlFor="lyrics-content">
            Lyrics đồng bộ <span>Không bắt buộc</span>
          </label>
          <label className="file-button lyrics-file-button">
            <FileText size={15} />
            {lyrics ? lyrics.name : 'Tải file .LRC'}
            <input
              type="file"
              accept=".lrc,text/plain"
              aria-label="Chọn file lyrics LRC"
              disabled={busy || aligning}
              onChange={(e) => chooseFile(e.target.files[0], 'lyrics')}
            />
          </label>
        </div>
        <textarea
          id="lyrics-content"
          className="lyrics-textarea"
          rows={5}
          disabled={lyricsLoading || removeLyrics || busy || aligning}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setLyrics(null);
          }}
          placeholder={
            'Dán lời bài hát ở đây, mỗi câu một dòng\nBấm AI căn thời gian để tạo mốc tự động\nHoặc nhập LRC: [00:12.50] Lời bài hát'
          }
          spellCheck="false"
        />
        <LyricsAI
          content={content}
          trackId={track?.id}
          audio={audio}
          licensed={licensed}
          disabled={busy || lyricsLoading || removeLyrics}
          onBusyChange={setAligning}
          onChange={(value) => {
            setContent(value);
            setLyrics(null);
          }}
        />
        <div className="lyrics-editor-footer">
          <span className="field-hint">
            {lyricsLoading ? 'Đang tải lyrics…' : 'LRC có mốc thời gian · UTF-8 · Tối đa 256 KB'}
          </span>
          {editing && track.hasLyrics && (
            <button
              type="button"
              className={`form-text-button ${removeLyrics ? 'is-danger' : ''}`}
              disabled={busy || aligning}
              onClick={() => setRemoveLyrics((value) => !value)}
            >
              <Trash2 size={14} />
              {removeLyrics ? 'Hoàn tác xóa lyrics' : 'Xóa lyrics'}
            </button>
          )}
        </div>
        {removeLyrics && <p className="form-warning">Lyrics sẽ được xóa khi bạn lưu thay đổi.</p>}
        </>}
        <label className="license-checkbox">
          <input
            type="checkbox"
            checked={licensed}
            onChange={(e) => setLicensed(e.target.checked)}
          />
          <span>Tôi sáng tác hoặc có quyền sử dụng nhạc, ảnh bìa và lyrics này.</span>
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {busy && (!editing || cover) && (
          <div className="upload-progress" role="status">
            <div>
              <span>
                {progress < 100 ? 'Đang tải lên…' : 'Đang kiểm tra âm thanh và chuẩn bị bản phát…'}
              </span>
              <strong>{Math.round(progress)}%</strong>
            </div>
            <progress max="100" value={progress} aria-label="Tiến trình tải file" />
          </div>
        )}
        <footer className="form-actions">
          <button
            type="button"
            className="form-secondary"
            disabled={busy || aligning}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="form-primary"
            disabled={busy || lyricsLoading || aligning}
          >
            {busy ? <LoaderCircle size={17} className="spinning" /> : <Check size={17} />}
            {busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : bulk ? (bulkResults.some((item) => item && !item.ok) ? 'Thử lại bài lỗi' : `Thêm ${bulkFiles.length} bài hát`) : 'Thêm vào thư viện'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

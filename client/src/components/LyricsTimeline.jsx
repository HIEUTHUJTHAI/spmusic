import { useRef, useState } from 'react';
import { parseLrc } from '../lib/lrc';

const stamp = (seconds) => {
  const n = Math.round(seconds * 100);
  return `${String(Math.floor(n / 6000)).padStart(2, '0')}:${String(Math.floor(n / 100) % 60).padStart(2, '0')}.${String(n % 100).padStart(2, '0')}`;
};

export default function LyricsTimeline({ track, content, onChange, disabled }) {
  const audio = useRef(null);
  const [rows, setRows] = useState(null);
  const [duration, setDuration] = useState(Number(track.duration) || 0);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(0);
  const parsed = () => {
    const lrc = parseLrc(content).filter((line) => line.text);
    return lrc.length ? lrc.map((line) => ({ text: line.text, time: line.time })) :
      content.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((text) => ({ text, time: null }));
  };
  const update = (index, time) => setRows((items) => items.map((r, i) => i === index ? { ...r, time } : r));
  const valid = rows?.length && rows.every((r, i) => r.text.trim() && r.time !== null && r.time <= duration && (!i || r.time >= rows[i - 1].time));
  return <section className="lyrics-ai" aria-label="Căn lời thủ công">
    <strong>Căn thời gian thủ công</strong>
    {!rows ? <><p className="field-hint">Dán lời vào ô phía trên rồi mở bộ căn. Nếu có lời đang chỉnh, hãy áp dụng hoặc đóng trước khi mở lại.</p><button type="button" className="form-secondary" disabled={disabled || !content.trim()} onClick={() => { setRows(parsed()); setSelected(0); }}>Mở bộ căn lời</button></> : <>
      <audio ref={audio} controls preload="metadata" src={`/api/media/${encodeURIComponent(track.id)}/audio`} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || duration)} onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)} />
      <p className="field-hint">Chọn câu, nghe hoặc kéo thanh phát, rồi bấm đánh dấu. Có thể kéo thanh riêng của từng câu để tinh chỉnh.</p>
      <button type="button" className="form-secondary" disabled={disabled || !duration} onClick={() => { update(selected, current); setSelected(Math.min(rows.length - 1, selected + 1)); }}>Đánh dấu câu {selected + 1} tại {stamp(current)}</button>
      <div className="ai-review-lines">{rows.map((row, i) => <div className="ai-review-line" key={i}>
        <button type="button" className="form-secondary" aria-pressed={selected === i} onClick={() => { setSelected(i); if (row.time !== null && audio.current) audio.current.currentTime = row.time; }}>{i + 1} · {row.time === null ? '--:--' : stamp(row.time)}</button>
        <div><span>{row.text}</span><input aria-label={`Kéo thời gian câu ${i + 1}`} type="range" min="0" max={duration || 1} step="0.01" value={row.time ?? 0} disabled={disabled || !duration} onChange={(e) => update(i, Number(e.target.value))} /></div>
      </div>)}</div>
      {!valid && <p className="field-hint">Đánh dấu đủ các câu theo thứ tự thời gian trong bài hát.</p>}
      <div className="update-controls"><button type="button" className="form-primary" disabled={disabled || !valid} onClick={() => { onChange(rows.map((r) => `[${stamp(r.time)}] ${r.text}`).join('\n')); setRows(null); }}>Áp dụng thời gian</button><button type="button" className="form-secondary" onClick={() => setRows(null)}>Đóng bộ căn</button></div>
    </>}
  </section>;
}

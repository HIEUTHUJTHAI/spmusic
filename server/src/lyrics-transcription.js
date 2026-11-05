import { ApiError } from './validation.js';

export function transcriptionLines(chunks, duration) {
  const valid = chunks.filter((c) => c.text?.trim() && Number.isFinite(c.timestamp?.[0]) && c.timestamp[0] >= 0 && c.timestamp[0] <= duration);
  if (!valid.length) throw new ApiError(422, 'AI chưa nhận ra giọng hát.');
  const lines = [];
  for (let i = 0; i < valid.length; i += 8) {
    const part = valid.slice(i, i + 8);
    lines.push({ text: part.map((c) => c.text.trim()).join(' ').replace(/\s+/g, ' '), start: part[0].timestamp[0], confidence: 0 });
  }
  return { duration, lines, matchedLines: lines.length, totalLines: lines.length, warning: 'AI có thể nghe sai; hãy chỉnh lại lời và thời gian trước khi áp dụng.' };
}

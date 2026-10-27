import { ApiError } from './validation.js';

const normalize = (text) =>
  text
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
const tokens = (text) => normalize(text).match(/[\p{L}\p{N}]+/gu) || [];

export function plainLyrics(content) {
  if (
    typeof content !== 'string' ||
    Buffer.byteLength(content, 'utf8') > 32 * 1024 ||
    content.includes('\0')
  )
    throw new ApiError(400, 'Lời để AI phân tích phải là văn bản, tối đa 32 KB.');
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[(?:ar|al|ti|by|offset|length):/i.test(line))
    .map((line) => line.replace(/^(?:\s*\[\d{1,3}:[0-5]\d(?:[.:]\d{1,3})?\])+/, '').trim())
    .filter(Boolean);
  const count = lines.reduce((sum, line) => sum + tokens(line).length, 0);
  if (
    !lines.length ||
    lines.length > 200 ||
    count < 2 ||
    count > 2500 ||
    lines.some((line) => !tokens(line).length)
  )
    throw new ApiError(400, 'Hãy nhập 2–2500 từ, tối đa 200 dòng lời; mỗi dòng là một câu hát.');
  return lines;
}

export function lrcTime(seconds) {
  const centiseconds = Math.round(seconds * 100);
  return `${String(Math.floor(centiseconds / 6000)).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}

// Match the supplied lyrics against acoustic word timestamps in sequence. A
// repeated chorus cannot reuse words from an earlier occurrence. Unmatched
// lines remain unresolved: do not invent times by dividing the song equally.
export function alignLyrics(lines, chunks, duration) {
  const expected = lines.flatMap((line, lineIndex) =>
    tokens(line).map((word) => ({ word, lineIndex })),
  );
  const heard = chunks.flatMap((chunk) => {
    const words = tokens(chunk.text || '');
    const [start, end] = chunk.timestamp || [];
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end < start ||
      end > duration + 0.5
    )
      return [];
    return words.map((word, index) => ({
      word,
      start: start + ((end - start) * index) / words.length,
    }));
  });
  const n = expected.length,
    m = heard.length;
  if (!m)
    throw new ApiError(
      422,
      'AI chưa nhận ra giọng hát. Hãy thử bản có giọng rõ hơn hoặc nhập mốc thời gian thủ công.',
    );
  if (n * m > 12000000)
    throw new ApiError(400, 'Quá nhiều từ để căn tự động. Hãy rút gọn lời hoặc dùng bài ngắn hơn.');
  // Weighted longest common subsequence, using two score rows and a compact
  // traceback. Accent/case/punctuation differences do not break Vietnamese words.
  const directions = new Uint8Array((n + 1) * (m + 1));
  let previous = new Uint16Array(m + 1);
  for (let i = 1; i <= n; i++) {
    const current = new Uint16Array(m + 1);
    for (let j = 1; j <= m; j++) {
      const match = expected[i - 1].word === heard[j - 1].word;
      const diagonal = match ? previous[j - 1] + 1 : -1;
      if (diagonal >= previous[j] && diagonal >= current[j - 1]) {
        current[j] = diagonal;
        directions[i * (m + 1) + j] = 1;
      } else if (previous[j] >= current[j - 1]) {
        current[j] = previous[j];
        directions[i * (m + 1) + j] = 2;
      } else {
        current[j] = current[j - 1];
        directions[i * (m + 1) + j] = 3;
      }
    }
    previous = current;
  }
  const matches = new Map();
  let i = n,
    j = m;
  while (i && j) {
    const direction = directions[i * (m + 1) + j];
    if (direction === 1) {
      matches.set(i - 1, heard[j - 1]);
      i--;
      j--;
    } else if (direction === 2) i--;
    else j--;
  }
  let offset = 0;
  const result = lines.map((text, index) => {
    const words = tokens(text);
    const matched = words.map((word, k) => matches.get(offset + k)).filter(Boolean);
    // Without a match near the beginning of the line its onset is unknown.
    const onset = matches.get(offset) || matches.get(offset + (words.length > 2 ? 1 : 0));
    const confidence = matched.length / words.length;
    offset += words.length;
    return {
      text,
      start: confidence >= 0.5 && onset ? onset.start : null,
      confidence: Math.round(confidence * 100),
      line: index + 1,
    };
  });
  const matchedLines = result.filter((line) => line.start !== null).length;
  if (!matchedLines)
    throw new ApiError(
      422,
      'Chưa ghép được lời với giọng hát. Hãy kiểm tra ngôn ngữ, lời và bản thu.',
    );
  return {
    lines: result,
    matchedLines,
    totalLines: result.length,
    duration,
    warning: 'Mốc AI là gợi ý. Hãy nghe lại và chỉnh các câu chưa chính xác trước khi lưu.',
    lrc: result.every((line) => line.start !== null)
      ? result.map((line) => `[${lrcTime(line.start)}] ${line.text}`).join('\n')
      : null,
  };
}

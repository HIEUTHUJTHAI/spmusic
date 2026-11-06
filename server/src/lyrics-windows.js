// Assign overlapping chunks to one window by timestamp midpoint.
export function windowWords(chunks, offset, end, total, overlap = 5) {
  const lower = offset === 0 ? 0 : offset + overlap / 2;
  const upper = end >= total ? total + 0.01 : end - overlap / 2;
  return chunks.flatMap((chunk) => {
    const [start, finish] = chunk.timestamp || [];
    if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) return [];
    const absoluteStart = start + offset, absoluteEnd = finish + offset;
    const middle = (absoluteStart + absoluteEnd) / 2;
    return middle >= lower && middle < upper ? [{ text: chunk.text, timestamp: [absoluteStart, absoluteEnd] }] : [];
  });
}

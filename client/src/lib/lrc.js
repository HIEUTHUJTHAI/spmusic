/** Parse ordinary and enhanced LRC timestamps. Returned times are seconds. */
export function parseLrc(content = '') {
  const source = String(content).replace(/^\uFEFF/, '');
  const offsetMatches = [...source.matchAll(/\[offset:([+-]?\d+)\]/gi)];
  const offset = offsetMatches.length ? Number(offsetMatches.at(-1)[1]) / 1000 : 0;
  const result = [];
  for (const line of source.split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = line.replace(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g, '').trim();
    for (const stamp of stamps) {
      const seconds = Number(stamp[2]);
      if (seconds >= 60) continue;
      const fraction = stamp[3] ? Number(`0.${stamp[3]}`) : 0;
      result.push({ time: Math.max(0, Number(stamp[1]) * 60 + seconds + fraction + offset), text });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

/** Last line whose timestamp is at or before playback time; -1 before first. */
export function activeLineIndex(lines, seconds) {
  let low = 0;
  let high = lines.length - 1;
  let active = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lines[middle].time <= seconds) {
      active = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return active;
}

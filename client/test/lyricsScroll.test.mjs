import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lyricsScrollTop } from '../src/lib/lyricsScroll.js';

test('lyrics scrolling centers the current line only inside its pane and clamps at both ends', () => {
  const pane = { scrollTop: 120, scrollHeight: 1000, clientHeight: 200, getBoundingClientRect: () => ({ top: 300, height: 200 }) };
  const line = (top) => ({ getBoundingClientRect: () => ({ top, height: 40 }) });
  assert.equal(lyricsScrollTop(pane, line(450)), 190);
  assert.equal(lyricsScrollTop(pane, line(0)), 0);
  assert.equal(lyricsScrollTop(pane, line(1500)), 800);
});

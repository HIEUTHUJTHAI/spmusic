import test from 'node:test';
import assert from 'node:assert/strict';
import { artworkSpring, springFrames } from '../src/lib/springMotion.js';
test('artwork spring settles exactly, with a gentle bounded overshoot', () => {
  assert.equal(artworkSpring(0), 0);
  assert.equal(artworkSpring(1), 1);
  assert.equal(artworkSpring(2), 1);
  const values = Array.from({length:101}, (_,i) => artworkSpring(i/100));
  assert.ok(Math.max(...values) > 1 && Math.max(...values) < 1.03);
  assert.ok(values.every(v => Number.isFinite(v) && v >= 0));
});
test('tab spring starts at prior position and finishes at exact destination', () => {
  for (const [x,y] of [[0,180],[-220,0],[0,-50]]) {
    const frames = springFrames(x,y);
    assert.equal(frames[0].transform, `translate(${x}px, ${y}px) scale(1, 1)`);
    assert.equal(frames.at(-1).transform, 'translate(0px, 0px) scale(1, 1)');
    assert.ok(frames.every(f => !/NaN|Infinity/.test(f.transform)));
  }
});

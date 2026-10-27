import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLrc, activeLineIndex } from '../src/lib/lrc.js';

test('LRC supports single timestamps and one, two, or three fractional digits', () => {
  const lines = parseLrc('[00:03.1] First\n[00:12.50] Second\n[01:02.123] Third\n[02:00] Fourth');
  assert.deepEqual(lines, [
    { time: 3.1, text: 'First' },
    { time: 12.5, text: 'Second' },
    { time: 62.123, text: 'Third' },
    { time: 120, text: 'Fourth' },
  ]);
});

test('multiple timestamps expand the same lyric into independently timed entries', () => {
  assert.deepEqual(parseLrc('[00:12.50][00:24.123] A repeated refrain'), [
    { time: 12.5, text: 'A repeated refrain' },
    { time: 24.123, text: 'A repeated refrain' },
  ]);
});

test('metadata, BOM and Windows newlines do not become lyric lines', () => {
  const lines = parseLrc(
    '\uFEFF[ar:Original artist]\r\n[ti:Original title]\r\n[00:00.00] Xin chào\r\n[00:02.00] Một ngày mới',
  );
  assert.deepEqual(lines, [
    { time: 0, text: 'Xin chào' },
    { time: 2, text: 'Một ngày mới' },
  ]);
});

test('offset is applied in milliseconds and the last offset declaration wins', () => {
  const lines = parseLrc('[offset:-100]\n[00:03.1] Early\n[offset:+500]\n[00:12.50] Later');
  assert.equal(lines[0].time, 3.6);
  assert.equal(lines[1].time, 13);
});

test('negative offsets cannot create negative seek targets', () => {
  assert.equal(parseLrc('[offset:-3000]\n[00:01.00] Start')[0].time, 0);
});

test('out-of-order timestamps are sorted chronologically', () => {
  assert.deepEqual(
    parseLrc('[01:05] Third\n[00:30] Second\n[00:02] First').map((line) => line.text),
    ['First', 'Second', 'Third'],
  );
});

test('plain text, unsupported timestamp formats and invalid seconds are ignored', () => {
  assert.deepEqual(
    parseLrc('plain text\n[00:75.00] Invalid\n[00:99] Invalid\n[nan:10] Invalid'),
    [],
  );
  assert.deepEqual(parseLrc(), []);
});

test('empty timed lines remain seekable instrumental gaps', () => {
  assert.deepEqual(parseLrc('[00:12.00]'), [{ time: 12, text: '' }]);
});

test('active line follows timestamp boundaries and remains the last line after ending', () => {
  const lines = parseLrc('[00:03.60] First\n[00:13.00] Second\n[00:24.623] Third');
  assert.equal(activeLineIndex(lines, 0), -1);
  assert.equal(activeLineIndex(lines, 3.599), -1);
  assert.equal(activeLineIndex(lines, 3.6), 0);
  assert.equal(activeLineIndex(lines, 12.999), 0);
  assert.equal(activeLineIndex(lines, 13), 1);
  assert.equal(activeLineIndex(lines, 23), 1);
  assert.equal(activeLineIndex(lines, 24.623), 2);
  assert.equal(activeLineIndex(lines, 100), 2);
});

test('no active line exists for empty lyrics', () => {
  assert.equal(activeLineIndex([], 0), -1);
  assert.equal(activeLineIndex([], 10), -1);
});

test('duplicate timestamps keep source order and select the last simultaneous line', () => {
  const lines = parseLrc(
    '[00:01] First simultaneous line\n[00:01] Second simultaneous line\n[00:02] Next line',
  );
  assert.deepEqual(
    lines.map((line) => line.text),
    ['First simultaneous line', 'Second simultaneous line', 'Next line'],
  );
  assert.equal(activeLineIndex(lines, 0.999), -1);
  assert.equal(activeLineIndex(lines, 1), 1);
  assert.equal(activeLineIndex(lines, 1.9), 1);
  assert.equal(activeLineIndex(lines, 2), 2);
});

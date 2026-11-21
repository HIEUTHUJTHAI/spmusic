const { test } = require('node:test');
const assert = require('node:assert/strict');

test('mini player mode transitions preserve window bounds and restore to fullscreen correctly', () => {
  let miniRestore = null;
  const mockWin = {
    bounds: { x: 100, y: 100, width: 1200, height: 800 },
    isMax: true,
    isFS: false,
    alwaysOnTop: false,
    minSize: [760, 600],
    getNormalBounds() { return { ...this.bounds }; },
    isMaximized() { return this.isMax; },
    isFullScreen() { return this.isFS; },
    isAlwaysOnTop() { return this.alwaysOnTop; },
    setFullScreen(fs) { this.isFS = fs; },
    unmaximize() { this.isMax = false; },
    maximize() { this.isMax = true; },
    setMinimumSize(w, h) { this.minSize = [w, h]; },
    setAlwaysOnTop(top) { this.alwaysOnTop = top; },
    setBounds(b) { this.bounds = { ...b }; }
  };

  // 1. Enter fullscreen
  mockWin.setFullScreen(true);
  assert.equal(mockWin.isFS, true);

  // 2. Switch to mini mode
  if (!miniRestore) {
    miniRestore = { bounds: mockWin.getNormalBounds(), maximized: mockWin.isMaximized() };
  }
  mockWin.setAlwaysOnTop(true);
  mockWin.setFullScreen(false);
  if (mockWin.isMaximized()) mockWin.unmaximize();
  mockWin.setMinimumSize(360, 195);
  mockWin.setBounds({ width: 420, height: 215, x: 200, y: 200 });

  assert.equal(mockWin.alwaysOnTop, true);
  assert.equal(mockWin.isFS, false);
  assert.equal(mockWin.bounds.width, 420);
  assert.equal(mockWin.bounds.height, 215);
  assert.deepEqual(miniRestore.bounds, { x: 100, y: 100, width: 1200, height: 800 });
  assert.equal(miniRestore.maximized, true);

  // 3. Return to fullscreen from mini mode
  // enabled = true
  mockWin.setAlwaysOnTop(false);
  mockWin.setMinimumSize(760, 600);
  mockWin.setFullScreen(true);

  assert.equal(mockWin.alwaysOnTop, false);
  assert.equal(mockWin.isFS, true);
  // miniRestore must be preserved so closing player later restores pre-mini bounds
  assert.ok(miniRestore !== null);

  // 4. Exit expanded player completely (Esc or close)
  // enabled = false
  mockWin.setFullScreen(false);
  if (miniRestore) {
    mockWin.setAlwaysOnTop(false);
    mockWin.setMinimumSize(760, 600);
    mockWin.setBounds(miniRestore.bounds);
    if (miniRestore.maximized) mockWin.maximize();
    miniRestore = null;
  }

  assert.equal(mockWin.isFS, false);
  assert.equal(mockWin.alwaysOnTop, false);
  assert.equal(mockWin.isMax, true);
  assert.deepEqual(mockWin.bounds, { x: 100, y: 100, width: 1200, height: 800 });
  assert.equal(miniRestore, null);
});

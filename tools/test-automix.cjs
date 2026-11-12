// Exercise the production build using real generated audio and an isolated local database.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.runtime', `automix-qa-${Date.now()}`);
app.setPath('userData', path.join(output, 'profile'));
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let backend, win;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = (fn, arg) => win.webContents.executeJavaScript(`(${fn.toString()})(${JSON.stringify(arg)})`);
async function waitFor(fn, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await win.webContents.executeJavaScript(`Boolean((${fn.toString()})())`)) {
      if (fn === idle) await assertCoverVisible(label);
      return;
    }
    await delay(50);
  }
  throw new Error(`Timeout: ${label}`);
}
async function assertCoverVisible(label) {
  const state = await evaluate(async () => {
    const image = document.querySelector('[data-mixing="false"] .mix-cover');
    if (!image) return null;
    await image.decode();
    const style = getComputedStyle(image), rect = image.getBoundingClientRect();
    return { opacity: style.opacity, transform: style.transform, width: rect.width,
      height: rect.height, loaded: image.naturalWidth > 0,
      correctTrack: image.alt === `Ảnh bìa ${document.querySelector('.expanded-track-heading h1').textContent}` };
  });
  assert.ok(state?.loaded && state.correctTrack && state.opacity === '1' && state.transform === 'none' &&
    state.width > 100 && state.height > 100, `${label}: full-size artwork must remain visible: ${JSON.stringify(state)}`);
}
const click = (selector) => evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error(s); el.click(); }, selector);
const shot = async (name) => fs.writeFile(path.join(output, `${name}.png`), (await win.webContents.capturePage()).toPNG());
const mixing = () => document.querySelector('[data-mixing="true"]');
const idle = () => document.querySelector('[data-mixing="false"]');
const next = () => click('.expanded-player [aria-label="Bài tiếp theo"]');
async function seek(value) {
  await evaluate((n) => {
    const input = document.querySelector('[aria-label="Tua nhạc toàn màn hình"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, n);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
app.whenReady().then(async () => {
  await fs.mkdir(output, { recursive: true });
  const { startDesktopServer } = await import('../server/src/desktop-server.js');
  backend = await startDesktopServer({ dataDir: path.join(root, 'server', `test-temp-automix-${Date.now()}`) });
  win = new BrowserWindow({ show: false, width: 1440, height: 960,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(60);
  win.webContents.setAudioMuted(true);
  const errors = [];
  win.webContents.on('console-message', (event) => { if (event.level === 'error') errors.push(event.message); });
  await win.loadURL(backend.url);
  await evaluate(async () => {
    const credentials = { name: 'AutoMix QA', email: 'automix@example.test', password: 'AutomixTest123!' };
    for (const route of ['register', 'login']) {
      const r = await fetch(`/api/auth/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
      if (!r.ok) throw new Error(await r.text());
    }
    for (let j = 0; j < 3; j++) {
      const rate = 16000, count = rate * 30, bytes = new ArrayBuffer(44 + count * 2), view = new DataView(bytes);
      const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, count * 2, true);
      for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.sin(i * Math.PI * 2 * (220 + j * 110) / rate) * 5000, true);
      const c = document.createElement('canvas'); c.width = c.height = 800; const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 800, 800);
      g.addColorStop(0, ['#1c3a4b', '#582131', '#22352d'][j]); g.addColorStop(1, ['#acbbbc', '#df9c78', '#bea477'][j]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 800);
      ctx.fillStyle = '#ffffff18';
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(400, 400, 25 + i * 34, Math.PI * .1, Math.PI * 1.7); ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff26'; ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.font = '600 62px sans-serif'; ctx.fillText(['AFTERGLOW', 'SLOW TIDES', 'HOME AGAIN'][j], 48, 690);
      ctx.font = '20px sans-serif'; ctx.fillText('SPMUSIC  /  SOUND STUDIES', 52, 735);
      const form = new FormData();
      form.append('audio', new Blob([bytes], { type: 'audio/wav' }), `tone-${j}.wav`);
      form.append('cover', await new Promise((r) => c.toBlob(r)), `cover-${j}.png`);
      form.append('lyrics', new Blob(['[00:00.00] Sound study\n[00:05.00] A generated tone\n[00:10.00] AutoMix in motion']), 'test.lrc');
      form.append('title', ['Afterglow', 'Slow Tides', 'Home Again'][j]); form.append('artist', 'SPMusic · Sound Studies');
      const r = await fetch('/api/tracks', { method: 'POST', body: form }); if (!r.ok) throw new Error(await r.text());
    }
  });
  await win.reload();
  await waitFor(() => document.querySelector('[aria-label="Phát Home Again"]'), 'library');
  await click('[aria-label="Phát Home Again"]');
  await waitFor(() => [...document.querySelectorAll('audio')].some((a) => !a.paused && a.currentTime > .1), 'playback');
  await click('[aria-label="Mở trình phát toàn màn hình"]');
  await waitFor(idle, 'expanded player'); await delay(500);
  await shot('01-before');
  await next(); await waitFor(mixing, 'manual crossfade'); await delay(650);
  assert.equal(await evaluate(() => [...document.querySelectorAll('audio')].filter((a) => !a.paused).length), 2, 'Two audio streams during mix');
  await shot('02-dust');
  assert.ok(await evaluate(() => {
    const c = document.querySelector('.mix-dust');
    return c && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 20);
  }), 'Dust is actually drawn');
  await waitFor(idle, 'settled cover');
  assert.equal(await evaluate(() => [...document.querySelectorAll('audio')].filter((a) => !a.paused).length), 1);
  await shot('03-settled');
  // Natural five-second AutoMix: use the real media clock, not a simulated mix object.
  await seek(25.2); await waitFor(mixing, 'automatic crossfade'); await delay(1200);
  await shot('04-auto');
  const backdropOffset = await evaluate(() => document.querySelector('.expanded-backdrop-outgoing').style.getPropertyValue('--mix-offset'));
  console.log('FRAME_TIMING', await evaluate(() => new Promise((resolve) => {
    const samples = []; let last = performance.now();
    const tick = (now) => { samples.push(now - last); last = now;
      if (samples.length < 30) requestAnimationFrame(tick);
      else resolve({ averageMs: samples.reduce((a, b) => a + b, 0) / samples.length, longestMs: Math.max(...samples) });
    }; requestAnimationFrame(tick);
  })));
  assert.equal(await evaluate(() => document.querySelector('.expanded-backdrop-outgoing').style.getPropertyValue('--mix-offset')), backdropOffset, 'Playback updates do not restart or accelerate backdrop fade');
  await click('.expanded-tabs [aria-label="Lời bài hát"]'); await delay(250); await shot('05-lyrics');
  await click('.expanded-tabs [aria-label="Danh sách phát"]'); await delay(250); await shot('06-queue');
  await click('.expanded-tabs [aria-label="Trình phát"]');
  await waitFor(idle, 'automatic settle');
  await next(); await waitFor(mixing, 'pause test');
  await click('.expanded-play'); await waitFor(idle, 'pause settles');
  assert.equal(await evaluate(() => [...document.querySelectorAll('audio')].filter((a) => !a.paused).length), 0, 'Pause stops both streams');
  await click('.expanded-play');
  await waitFor(() => document.querySelector('.expanded-play[aria-label="Tạm dừng"]') && [...document.querySelectorAll('audio')].some((a) => !a.paused), 'resume before next');
  await next(); await waitFor(mixing, 'seek test'); await seek(10); await waitFor(idle, 'seek cancels animation');
  await next(); await waitFor(mixing, 'rapid next'); await next(); await waitFor(idle, 'rapid next settles');
  assert.equal(await evaluate(() => [...document.querySelectorAll('audio')].filter((a) => !a.paused).length), 1);
  await next(); await waitFor(mixing, 'close during mix'); await click('[aria-label="Thu nhỏ trình phát"]');
  await waitFor(() => !document.fullscreenElement && !document.querySelector('.expanded-player'), 'fullscreen exit');
  await delay(200);
  await click('[aria-label="Mở trình phát toàn màn hình"]'); await waitFor(idle, 'reopen settles');
  win.webContents.debugger.attach('1.3');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await next(); await delay(700);
  assert.equal(await evaluate(() => Boolean(document.querySelector('.mix-dust'))), false, 'Reduced motion disables particles');
  await assertCoverVisible('reduced motion during crossfade');
  await delay(2300);
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
  await next(); await waitFor(mixing, 'changing reduced motion during mix');
  await delay(200);
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await waitFor(idle, 'reduced motion retains visible cover');
  await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });
  await waitFor(mixing, 'restoring motion resumes active mix');
  await waitFor(idle, 'restoring motion retains visible cover');
  await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', { width: 900, height: 620, deviceScaleFactor: 1, mobile: false });
  await delay(100);
  await next(); await waitFor(mixing, 'compact layout'); await delay(550); await shot('07-compact');
  assert.ok(await evaluate(() => {
    const a = document.querySelector('.mix-artwork').getBoundingClientRect();
    return a.top >= 0 && a.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth;
  }), 'Artwork stays within small desktop viewport');
  await waitFor(idle, 'compact settles');
  assert.deepEqual(errors, [], 'No renderer errors');
  console.log('AUTOMIX_QA_PASS', JSON.stringify({ output, checks: ['manual', 'automatic', 'two streams', 'particles', 'pause', 'seek', 'rapid skip', 'reopen', 'lyrics', 'queue', 'reduced motion', 'compact'] }));
  await backend.close(); app.exit(0);
}).catch(async (error) => { console.error(error); await backend?.close(); app.exit(1); });
setTimeout(() => { console.error('AutoMix QA timeout'); app.exit(1); }, 120000).unref();

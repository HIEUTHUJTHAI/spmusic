// Hidden Electron smoke test: isolated profile/database and generated wallpaper.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
let backend, window;
const workspace = path.resolve(__dirname, '..');
const profile = path.join(workspace, '.runtime', `glass-qa-${Date.now()}`);
app.setPath('userData', path.join(profile, 'profile'));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = async (fn, arg) => {
  const result = await window.webContents.executeJavaScript(`(async () => { try { return await (${fn.toString()})(${JSON.stringify(arg)}); } catch (error) { return { __qaError: error.stack || error.message }; } })()`);
  if (result?.__qaError) throw new Error(result.__qaError);
  return result;
};
async function waitFor(fn, description) {
  const start = Date.now();
  while (Date.now() - start < 12000) {
    if (await window.webContents.executeJavaScript(`Boolean((${fn.toString()})())`)) return;
    await delay(40);
  }
  throw new Error(`Timed out: ${description}`);
}
async function screenshot(name) {
  await delay(450);
  await fs.writeFile(path.join(profile, `${name}.png`), (await window.webContents.capturePage()).toPNG());
}
async function reload() {
  await new Promise((resolve) => { window.webContents.once('did-finish-load', resolve); window.reload(); });
}
async function openSettings() {
  await evaluate(() => document.querySelector('[aria-label="Menu người dùng"]').click());
  await waitFor(() => document.querySelector('#user-dropdown'), 'user menu');
  await evaluate(() => [...document.querySelectorAll('#user-dropdown button')].find((item) => item.textContent.includes('Cài đặt')).click());
  await waitFor(() => document.querySelector('[role="dialog"][aria-label="Cài đặt"]'), 'settings');
}

app.whenReady().then(async () => {
  await fs.mkdir(profile, { recursive: true });
  const { startDesktopServer } = await import('../server/src/desktop-server.js');
  // Express sendFile excludes dot-directories, so media data must not live under .runtime.
  backend = await startDesktopServer({ dataDir: path.join(workspace, 'server', `test-temp-glass-${Date.now()}`) });
  window = new BrowserWindow({ show: false, width: 1360, height: 900,
    webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false, offscreen: true } });
  window.webContents.setFrameRate(60);
  const errors = [];
  window.webContents.on('console-message', (event) => { if (event.level === 'error') { errors.push(event.message); console.error(event.message); } });
  await window.loadURL(backend.url);
  await waitFor(() => document.querySelector('.nav-item') && !document.querySelector('.loading-screen'), 'initial app');
  await evaluate(async () => {
    const credentials = { name: 'Glass QA', email: 'glass-qa@example.test', password: 'GlassTest123!' };
    for (const route of ['register', 'login']) {
      const response = await fetch(`/api/auth/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
      if (!response.ok) throw new Error(`${route}: ${await response.text()}`);
    }
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1600, 1000);
    gradient.addColorStop(0, '#23354b'); gradient.addColorStop(.4, '#6e496d'); gradient.addColorStop(1, '#dca37c');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1600, 1000);
    ctx.fillStyle = '#d4b5d855'; ctx.beginPath(); ctx.arc(1150, 270, 360, 0, Math.PI * 2); ctx.fill();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const form = new FormData(); form.append('background', blob, 'qa-wallpaper.png');
    const response = await fetch('/api/account/background', { method: 'PUT', body: form });
    if (!response.ok) throw new Error(`wallpaper: ${await response.text()}`);
  });
  await reload();
  await waitFor(() => document.querySelector('[aria-label="Menu người dùng"]'), 'logged-in app');
  await waitFor(() => document.querySelector('.app-shell.has-wallpaper'), 'wallpaper shell');
  await evaluate(() => [...document.querySelectorAll('.sidebar-primary-nav button')].find((b) => b.textContent.trim() === 'New').click());
  await waitFor(() => document.querySelectorAll('.new-chart-card').length === 6, 'New charts');
  await evaluate(() => document.querySelector('.new-chart-card').click());
  await waitFor(() => document.querySelector('.new-chart-back'), 'chart details');
  await evaluate(() => [...document.querySelectorAll('.sidebar-primary-nav button')].find((b) => b.textContent.includes('Khám phá')).click());
  await waitFor(() => document.querySelector('.page-intro'), 'home after New');
  await evaluate(() => document.querySelector('.player .instrumental-control').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
  await delay(3200);
  const controls = await evaluate(() => {
    const control = document.querySelector('.player .instrumental-control');
    const top = control.querySelector('.vocals-button').getBoundingClientRect();
    const bottom = control.querySelector('.instrumental-button').getBoundingClientRect();
    return { overlap: top.bottom - bottom.top, width: top.width, leftDiff: top.left - bottom.left, text: control.querySelector('.vocals-button').textContent.trim() };
  });
  assert.ok(controls.overlap <= 1 && Math.abs(controls.leftDiff) < 1 && Math.abs(controls.width - 38) < 1 && !controls.text, `Unexpected stem controls ${JSON.stringify(controls)}`);
  await screenshot('stem-controls');
  await evaluate(() => document.querySelector('.player .instrumental-control').dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
  console.log('WALLPAPER_STYLE', JSON.stringify(await evaluate(() => ({ inline: document.querySelector('.app-wallpaper').style.backgroundImage, computed: getComputedStyle(document.querySelector('.app-wallpaper')).backgroundImage }))));
  console.log('WALLPAPER_STATE', JSON.stringify(await evaluate(async () => {
    const wall = document.querySelector('.app-wallpaper');
    const background = getComputedStyle(wall).backgroundImage;
    const response = await fetch('/api/account/background');
    if (!response.ok) throw new Error(`Wallpaper read ${response.status}: ${await response.text()}`);
    const blob = await response.blob();
    const image = new Image(); const blobUrl = URL.createObjectURL(blob); image.src = blobUrl;
    try { await image.decode(); } finally { URL.revokeObjectURL(blobUrl); }
    return { background, sidebar: getComputedStyle(document.querySelector('.sidebar')).backgroundColor, supported: CSS.supports('background-color', 'color-mix(in srgb, white calc(.62 * 100%), transparent)'), imageWidth: image.naturalWidth };
  })));

  // Remaining checks use actual controls and media preferences in the built app.
  const target = await evaluate(() => {
    const el = document.querySelector('.sidebar .nav-item');
    const rect = el.getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
  });
  window.webContents.sendInputEvent({ type: 'mouseMove', ...target });
  await delay(250);
  let nativePointerDelivered = await evaluate(() => Boolean(document.querySelector('.sidebar .glass-proximity')));
  if (!nativePointerDelivered) {
    await evaluate((point) => document.querySelector('.sidebar .nav-item').dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: point.x, clientY: point.y })), target);
    await delay(200);
  }
  const scale = await evaluate(() => {
    const item = document.querySelector('.sidebar .glass-proximity');
    return item ? Number(item.style.getPropertyValue('--proximity-scale')) : null;
  });
  assert.ok(scale > 1, `Expected proximity magnification, got ${scale}`);
  console.log('POINTER_ENVIRONMENT', JSON.stringify(await evaluate(() => ({ fine: matchMedia('(hover: hover) and (pointer: fine)').matches, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, visibility: document.visibilityState }))));
  await screenshot('desktop-glass');

  await evaluate(() => [...document.querySelectorAll('.sidebar nav button')].find((item) => item.textContent.includes('Tìm kiếm')).click());
  await waitFor(() => document.querySelector('.sidebar nav button.active')?.textContent.includes('Tìm kiếm'), 'search navigation');
  assert.ok(await evaluate(() => document.querySelector('.nav-liquid-marker').getAnimations().some((animation) => animation.playState === 'running')), 'Liquid marker animates during navigation');
  assert.ok(await evaluate(() => {
    const nav = document.querySelector('.sidebar-primary-nav');
    const marker = nav.querySelector('.nav-liquid-marker');
    const active = nav.querySelector('[aria-current="page"]');
    return !marker.hidden && marker.offsetTop === active.offsetTop && marker.offsetHeight === active.offsetHeight;
  }), 'Liquid marker follows selected tab');
  await delay(320);
  assert.ok(await evaluate(() => Boolean(document.querySelector('.discover-music'))), 'Search page renders');
  await evaluate(() => document.querySelector('.discover-source-tabs button:nth-of-type(2)').click());
  assert.ok(await evaluate(() => {
    const group = document.querySelector('.discover-source-tabs');
    const marker = group.querySelector('.liquid-lens'), active = group.querySelector('button.selected');
    return !marker.hidden && marker.offsetLeft === active.offsetLeft && marker.getAnimations().some((item) => item.playState === 'running');
  }), 'Discovery lens moves to selected source');
  await evaluate(() => {
    const buttons = [...document.querySelectorAll('.sidebar nav button')];
    buttons.find((item) => item.textContent.includes('Khám phá')).click();
    buttons.find((item) => item.textContent.includes('Thư viện')).click();
    buttons.find((item) => item.textContent.includes('Tìm kiếm')).click();
  });
  await delay(500);
  assert.ok(await evaluate(() => document.querySelector('.sidebar nav button.active')?.textContent.includes('Tìm kiếm')), 'Rapid navigation retains last destination');
  assert.equal(await evaluate(() => getComputedStyle(document.querySelector('main')).opacity), '1', 'Navigation settles at full opacity');
  await evaluate(() => {
    const library = [...document.querySelectorAll('.sidebar nav button')].find((item) => item.textContent.includes('Thư viện'));
    library.focus(); library.click();
    const search = document.querySelector('.search-box input');
    search.focus();
    // Hidden windows can suppress native focus events; exercise React's focus handler explicitly.
    search.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  });
  await delay(500);
  assert.ok(await evaluate(() => document.querySelector('.sidebar nav button.active')?.textContent.includes('Tìm kiếm')), 'Search focus supersedes pending navigation');

  await openSettings();
  await waitFor(() => document.querySelector('[aria-label="Độ trong suốt Liquid Glass"]'), 'glass transparency range');
  async function setTransparency(value) {
    await evaluate((next) => {
      const input = document.querySelector('[aria-label="Độ trong suốt Liquid Glass"]');
      input.scrollIntoView({ block: 'center' });
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await delay(100);
    const opacity = await evaluate(() => Number(document.documentElement.style.getPropertyValue('--glass-opacity')));
    assert.ok(Math.abs(opacity - (1 - value / 100)) < .001, `Live opacity mismatch ${opacity}`);
  }
  await setTransparency(85);
  await screenshot('settings-transparent');
  await setTransparency(5);
  await screenshot('settings-glass');
  await setTransparency(70);
  await reload();
  await waitFor(() => document.querySelector('[aria-label="Menu người dùng"]'), 'reload');
  assert.ok(Math.abs(await evaluate(() => Number(localStorage.getItem('spmusic-glass-opacity'))) - .3) < .001, 'Preference saved');
  assert.ok(Math.abs(await evaluate(() => Number(document.documentElement.style.getPropertyValue('--glass-opacity'))) - .3) < .001, 'Opacity persists after reload');

  // Reduced motion must suppress proximity movement even after it was activated.
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  window.webContents.sendInputEvent({ type: 'mouseMove', ...target });
  await delay(200);
  const reducedScale = await evaluate(() => Number(document.querySelector('.sidebar .nav-item').style.getPropertyValue('--proximity-scale') || '1'));
  assert.equal(reducedScale, 1, 'Reduced motion disables magnification');
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] });

  await evaluate(async () => {
    const response = await fetch('/api/account/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: 'dark' }) });
    if (!response.ok) throw new Error('Dark theme failed');
  });
  await reload();
  await waitFor(() => document.documentElement.dataset.theme === 'dark', 'dark theme');
  await screenshot('desktop-dark-glass');
  window.setContentSize(390, 844);
  await delay(250);
  assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile viewport has no horizontal overflow');
  await screenshot('mobile-glass');
  console.log('GLASS_QA_RESULT', JSON.stringify({ scale, reducedScale, nativePointerDelivered, screenshots: profile, errors }));
  await backend.close(); app.exit(0);
}).catch(async (error) => { console.error(error); await backend?.close(); app.exit(1); });
setTimeout(() => { console.error('Glass QA timed out'); app.exit(1); }, 90000).unref();

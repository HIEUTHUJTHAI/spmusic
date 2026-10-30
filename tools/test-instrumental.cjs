// Real Electron + ONNX smoke test. Uses generated silence, no copyrighted audio.
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
let backend;
app.whenReady().then(async () => {
  const { startDesktopServer } = await import('../server/src/desktop-server.js');
  const fs = require('node:fs/promises');
  const assetsDir = path.resolve(__dirname, '../client/dist/assets');
  let entry;
  for (const name of await fs.readdir(assetsDir)) {
    if (name.endsWith('.js') && (await fs.readFile(path.join(assetsDir,name),'utf8')).includes('as createSeparator')) entry = name;
  }
  if (!entry) throw new Error('Build client first');
  backend = await startDesktopServer({ dataDir: path.resolve(__dirname, '../server/test-temp-instrumental-smoke') });
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  window.webContents.on('console-message', (_event, ...args) => console.log(...args));
  await window.loadURL(backend.url);
  const result = await window.webContents.executeJavaScript(`(async () => {
    const { createSeparator } = await import('/assets/${entry}');
    const account = {name:'Smoke test',email:'smoke@example.test',password:'InstrumentalTest123!'};
    await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(account)});
    const login = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(account)});
    if(!login.ok) throw new Error('Test login failed');
    const separator = createSeparator('UVR_MDXNET_KARA_2', { common: { modelUrl:'/api/instrumental/model', outputSingleStem: 'instrumental', onProgress: p => console.log(JSON.stringify(p)) }, mdx: { executionProviders: ['wasm'] } });
    await separator.loadModel();
    const bytes = new ArrayBuffer(44 + 44100 * 4);
    const d = new DataView(bytes); const s = (o, v) => [...v].forEach((c,i) => d.setUint8(o+i,c.charCodeAt(0)));
    s(0,'RIFF'); d.setUint32(4,bytes.byteLength-8,true); s(8,'WAVEfmt '); d.setUint32(16,16,true); d.setUint16(20,1,true); d.setUint16(22,2,true); d.setUint32(24,44100,true); d.setUint32(28,176400,true); d.setUint16(32,4,true); d.setUint16(34,16,true); s(36,'data'); d.setUint32(40,bytes.byteLength-44,true);
    const input = URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
    const outputs = await separator.separate(input);
    const blob = await (await fetch(outputs[0])).blob();
    const audio = await new OfflineAudioContext(2,1,44100).decodeAudioData(await blob.arrayBuffer());
    await separator.model.release();
    outputs.concat(input).forEach(u=>URL.revokeObjectURL(u));
    return { bytes: blob.size, duration: audio.duration, channels: audio.numberOfChannels };
  })()`);
  console.log('SEPARATION_RESULT', JSON.stringify(result));
  if (Math.abs(result.duration - 1) > .05 || result.bytes < 44) throw new Error('Invalid output');
  await backend.close(); app.exit(0);
}).catch(async error => { console.error(error); await backend?.close(); app.exit(1); });
setTimeout(() => { console.error('Timed out'); app.exit(1); }, 240000).unref();

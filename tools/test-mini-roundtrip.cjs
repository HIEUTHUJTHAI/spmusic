const {app, BrowserWindow} = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
app.setPath('userData', fs.mkdtempSync(path.join(root, '.runtime/mini-roundtrip-')));
require('../electron/main.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    const evaluate = code => win.webContents.executeJavaScript(code);
    const click = async selector => {
      for (let i=0; i<60; i++) {
        if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) {
          await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
          await delay(650);
          return;
        }
        await delay(100);
      }
      throw Error('Missing '+selector);
    };
    try {
      const audio = fs.readFileSync(path.join(root,'server/test/fixtures/silence.mp3')).toString('base64');
      await evaluate(`(async()=>{
        const credentials={name:'Mini QA',email:'mini@example.test',password:'MiniPlayer123!'};
        for(const action of ['register','login']){
          const r=await fetch('/api/auth/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(credentials)});
          if(!r.ok) throw Error(await r.text());
        }
        const form=new FormData();
        form.append('audio',new Blob([Uint8Array.from(atob('${audio}'), c=>c.charCodeAt(0))],{type:'audio/mpeg'}),'test.mp3');
        form.append('title','Mini QA');form.append('artist','QA');
        const r=await fetch('/api/tracks',{method:'POST',body:form});
        if(!r.ok) throw Error(await r.text());
        const {track}=await r.json();
        await fetch('/api/playlists',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Mini QA',trackIds:[track.id]})});
      })()`);
      await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload()});
      await click('.playlist-nav .nav-item');
      await click('[aria-label="Phát Mini QA"]');
      await click('.expand-player-button');
      await click('.cinema-mini-toggle');
      assert.ok(await evaluate("!!document.querySelector('.cinema.mini') && !document.querySelector('.desktop-caption')"));
      assert.equal(win.getBounds().width,420);
      await click('.cinema-words');
      assert.equal(win.getBounds().height,590);
      await click('.cinema-mini-toggle');
      assert.ok(win.isFullScreen());
      await click('.cinema-mini-toggle');
      await click('.cinema-close');
      assert.ok(await evaluate("!!document.querySelector('.desktop-caption')"));
      assert.ok(win.getBounds().width >= 760);
      console.log('MINI_ROUNDTRIP_PASS'); app.quit();
    } catch(error){console.error(error);app.exit(1)}
  });
});

// Real desktop shell regression: isolated account, generated media, no personal library changes.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.runtime', `shell-qa-${Date.now()}`);
app.setPath('userData', path.join(output, 'profile'));
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
let backend, win;
const delay = ms => new Promise(r => setTimeout(r, ms));
const evaluate = (fn, arg) => win.webContents.executeJavaScript(`(${fn.toString()})(${JSON.stringify(arg)})`);
const click = selector => evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error(s); e.click(); }, selector);
const shot = async name => fs.writeFile(path.join(output, `${name}.png`), (await win.webContents.capturePage()).toPNG());
async function waitFor(fn, name) {
  for (let i = 0; i < 240; i++) { if (await win.webContents.executeJavaScript(`Boolean((${fn.toString()})())`)) return; await delay(50); }
  throw new Error(`Timeout: ${name}`);
}
async function metrics() {
  return evaluate(() => {
    const rect = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height }; };
    const content = document.querySelector('.now-playing-panel .expanded-content');
    const nav = document.querySelector('.playlist-nav');
    return { viewport:{width:innerWidth,height:innerHeight}, scrollY, docWidth:document.documentElement.scrollWidth,
      header:rect('.topbar'), dock:rect('.now-playing-panel'), player:rect('.player'), sidebar:rect('.sidebar'),
      dockContent:{width:content.clientWidth,scrollWidth:content.scrollWidth},
      nav:{client:nav.clientHeight,scroll:nav.scrollHeight},
      overflowing: [...document.querySelectorAll('.now-playing-panel .expanded-details, .now-playing-panel .now-playing-discovery, .now-playing-panel .now-playing-lyric-preview')].filter(e => e.scrollWidth > e.clientWidth + 2).map(e => e.className) };
  });
}
function assertBounds(m) {
  assert.ok(m.docWidth <= m.viewport.width + 1, `Page overflow ${JSON.stringify(m)}`);
  assert.ok(m.header.top >= 0 && m.header.bottom < 100, 'Toolbar stays visible');
  assert.ok(m.dock.top >= m.header.bottom && m.dock.top - m.header.bottom <= 24, 'No vacant header gap above dock');
  assert.ok(m.dock.bottom <= m.player.top + 1, 'Dock does not overlap player');
  assert.ok(m.sidebar.bottom <= m.player.top + 1, 'Sidebar does not overlap player');
  assert.ok(m.dock.right <= m.viewport.width && m.player.right <= m.viewport.width, 'Panels fit window');
  assert.ok(m.dockContent.scrollWidth <= m.dockContent.width + 1, 'Dock cannot scroll horizontally');
  assert.deepEqual(m.overflowing, [], 'No clipped dock details or lyrics preview');
}
app.whenReady().then(async () => {
  await fs.mkdir(output, {recursive:true});
  const { startDesktopServer } = await import('../server/src/desktop-server.js');
  backend = await startDesktopServer({dataDir:path.join(root,'server',`test-temp-shell-${Date.now()}`)});
  win = new BrowserWindow({show:false,width:1440,height:900,webPreferences:{offscreen:true,sandbox:true,contextIsolation:true,backgroundThrottling:false}});
  win.setContentSize(1440,900); win.webContents.setAudioMuted(true);
  win.webContents.on('render-process-gone', (_e,details) => { require('node:fs').writeFileSync(path.join(output,'renderer-failure.json'),JSON.stringify(details)); app.exit(1); });
  const errors=[];
  win.webContents.on('console-message', e => { if(e.level === 'error') errors.push(e.message); });
  await win.loadURL(backend.url);
  await evaluate(async () => {
    const json = async (route,body) => { const r=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); if(!r.ok) throw new Error(await r.text()); return r.json(); };
    const credentials={name:'Shell QA',email:'shell@example.test',password:'ShellTest123!'};
    await json('/api/auth/register',credentials); await json('/api/auth/login',credentials);
    const c=document.createElement('canvas'); c.width=1600;c.height=1000; const ctx=c.getContext('2d');
    const g=ctx.createLinearGradient(0,0,1600,1000); g.addColorStop(0,'#213949');g.addColorStop(.5,'#766376');g.addColorStop(1,'#c9a58b');ctx.fillStyle=g;ctx.fillRect(0,0,1600,1000);
    ctx.fillStyle='#c5d2cf33';ctx.beginPath();ctx.arc(1100,300,480,0,Math.PI*2);ctx.fill();
    let form=new FormData();form.append('background',await new Promise(r=>c.toBlob(r)),'wallpaper.png');
    let r=await fetch('/api/account/background',{method:'PUT',body:form});if(!r.ok)throw new Error(await r.text());
    const titles=['Afterglow','Slow Tides','Home Again','An exceptionally long song title that should wrap cleanly in Now Playing without clipping its controls','Blue Hour','Small Hours','Open Water','Soft Focus','Distant Light','Summer Rain','Velvet Sky','Still Here','Sunday Morning','Evening Walk','Moonlit','Quiet Places'];
    const ids=[];
    for(let j=0;j<titles.length;j++){
      const rate=8000,count=rate*60,bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);
      const txt=(n,s)=>[...s].forEach((ch,i)=>v.setUint8(n+i,ch.charCodeAt(0)));
      txt(0,'RIFF');v.setUint32(4,36+count*2,true);txt(8,'WAVE');txt(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);txt(36,'data');v.setUint32(40,count*2,true);
      for(let k=0;k<count;k++)v.setInt16(44+k*2,Math.sin(k*Math.PI*2*(220+j*20)/rate)*2000,true);
      c.width=c.height=800;const grad=ctx.createLinearGradient(0,0,800,800);grad.addColorStop(0,['#2e414a','#584653','#294742'][j%3]);grad.addColorStop(1,['#b2c3c3','#d7a698','#afc09e'][j%3]);ctx.fillStyle=grad;ctx.fillRect(0,0,800,800);
      for(let k=0;k<10;k++){ctx.beginPath();ctx.arc(400,330,30+k*30,.4,5.5);ctx.strokeStyle='#ffffff24';ctx.lineWidth=10;ctx.stroke();}
      ctx.fillStyle='#fff';ctx.font='600 48px sans-serif';ctx.fillText(titles[j].length>25?'SOUND STUDIES':titles[j].toUpperCase(),44,690);ctx.font='20px sans-serif';ctx.fillText('SPMUSIC / LOCAL COLLECTION',44,738);
      form=new FormData();form.append('audio',new Blob([bytes],{type:'audio/wav'}),`${j}.wav`);form.append('cover',await new Promise(r=>c.toBlob(r)),`${j}.png`);form.append('title',titles[j]);form.append('artist','SPMusic Sound Studies');form.append('album','Quiet Places');
      r=await fetch('/api/tracks',{method:'POST',body:form});if(!r.ok)throw new Error(await r.text());ids.push((await r.json()).track.id);
    }
    for(const name of ['Evening collection','After hours','Slow mornings']) await json('/api/playlists',{name,trackIds:ids});
  });
  await new Promise(resolve=>{win.webContents.once('did-finish-load',resolve);win.reload();});
  await waitFor(()=>document.querySelector('.playlist-nav .nav-item'),'library');
  await click('.playlist-nav .nav-item');
  await waitFor(()=>document.querySelector('[aria-label="Phát Afterglow"]'),'playlist');
  await click('[aria-label="Phát Afterglow"]');
  await click('.player [aria-label="Đang phát"]');
  await waitFor(()=>document.querySelector('.now-playing-panel'),'dock');await delay(900);
  const results=[];
  for(const [width,height] of [[1440,900],[1024,768]]){
    win.setContentSize(width,height);await evaluate(()=>window.scrollTo(0,0));await delay(800);
    const start=await metrics();assertBounds(start);await shot(`${width}-top`);
    await evaluate(()=>window.scrollTo(0,Math.min(500,document.documentElement.scrollHeight-innerHeight)));await delay(400);
    const scrolled=await metrics();assertBounds(scrolled);assert.ok(scrolled.scrollY>100,'Fixture must scroll');
    assert.equal(scrolled.header.top,start.header.top,'Toolbar stable across page scroll');assert.equal(scrolled.dock.top,start.dock.top,'Dock stable across page scroll');
    await shot(`${width}-scrolled`);
    await evaluate(()=>document.querySelector('.now-playing-panel .expanded-content').scrollTo(0,1000));await delay(400);
    assertBounds(await metrics());await shot(`${width}-dock-scrolled`);
    await evaluate(()=>{window.scrollTo(0,0);document.querySelector('.now-playing-panel .expanded-content').scrollTo(0,0);});
    results.push({width,start,scrolled});
  }
  await click('[aria-label="Phát An exceptionally long song title that should wrap cleanly in Now Playing without clipping its controls"]');await delay(3500);assertBounds(await metrics());await shot('long-title');
  win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await click('[aria-label="Đóng Đang phát"]');await click('.player [aria-label="Đang phát"]');await delay(100);
  assert.equal(await evaluate(()=>getComputedStyle(document.querySelector('.now-playing-panel')).animationName),'none','Reduced motion disables panel entrance');assertBounds(await metrics());
  // User menu must remain above the dock, not be covered by a stacking context.
  await click('[aria-label="Menu người dùng"]');
  await waitFor(()=>document.querySelector('#user-dropdown'),'account menu');await delay(500);
  const menuHit=await evaluate(()=>{const b=[...document.querySelectorAll('#user-dropdown button')].find(e=>e.textContent.includes('Cài đặt'));const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));});
  await shot('account-menu');assert.ok(menuHit,'Settings menu remains clickable above dock');
  await click('[aria-label="Menu người dùng"]');
  for(const [label,selector] of [['Lời bài hát','.lyrics-panel'],['Danh sách phát','.queue-panel']]){
    await click('.player [aria-label="'+label+'"]');await delay(500);
    const bounds=await evaluate(sel=>{const r=document.querySelector(sel).getBoundingClientRect(),h=document.querySelector('.topbar').getBoundingClientRect(),p=document.querySelector('.player').getBoundingClientRect();return {top:r.top,bottom:r.bottom,headerBottom:h.bottom,playerTop:p.top};},selector);
    assert.ok(bounds.top>=bounds.headerBottom&&bounds.bottom<=bounds.playerTop+1,'Standalone '+label+' clears toolbar and player');
    await shot(selector.slice(1));await click('.player [aria-label="'+label+'"]');
  }
  await click('.player [aria-label="Đang phát"]');await delay(100);
  win.setContentSize(760,570);await delay(500);await shot('minimum-window');
  await evaluate(()=>document.querySelector('.sidebar').scrollTo(0,10000));await delay(100);
  const compact=await evaluate(()=>{const s=document.querySelector('.sidebar').getBoundingClientRect(),e=document.querySelector('.sidebar-library-summary').getBoundingClientRect();return {sidebarBottom:s.bottom,summaryBottom:e.bottom,docWidth:document.documentElement.scrollWidth,width:innerWidth};});
  assert.ok(compact.summaryBottom<=compact.sidebarBottom+1,'Sidebar summary remains inside compact sidebar');assert.ok(compact.docWidth<=compact.width+1,'Minimum window no horizontal overflow');
  await shot('minimum-sidebar-bottom');
  await evaluate(()=>document.querySelector('.sidebar').scrollTo(0,0));await delay(100);
  assert.ok(await evaluate(()=>{const s=document.querySelector('.sidebar').getBoundingClientRect(),a=document.querySelector('.sidebar-actions').getBoundingClientRect();return a.top>=s.top&&a.bottom<=s.bottom;}),'Short sidebar first action reachable');
  assert.ok(await evaluate(()=>{const p=document.querySelector('.player').getBoundingClientRect(),n=document.querySelector('.player .now-playing').getBoundingClientRect();return n.top>=p.top&&n.bottom<=p.bottom;}),'Now Playing metadata fits compact bottom player');
  win.setContentSize(1440,900);await evaluate(()=>{document.documentElement.dataset.theme='dark';window.scrollTo(0,0);});await delay(500);await shot('dark-theme');assertBounds(await metrics());
  await evaluate(()=>{document.documentElement.dataset.theme='pink';});
  win.setContentSize(375,812);await delay(500);await shot('mobile-dock');
  const mobile=await evaluate(()=>{const r=document.querySelector('.now-playing-panel').getBoundingClientRect(),p=document.querySelector('.player').getBoundingClientRect();return {docWidth:document.documentElement.scrollWidth,width:innerWidth,left:r.left,right:r.right,bottom:r.bottom,playerTop:p.top};});
  assert.ok(mobile.docWidth<=mobile.width+1&&mobile.left>=0&&mobile.right<=mobile.width&&mobile.bottom<=mobile.playerTop+1,'Mobile dock and player fit');
  await click('[aria-label="Đóng Đang phát"]');await click('.mobile-menu');await delay(500);await shot('mobile-sidebar');
  assert.ok(await evaluate(()=>{const r=document.querySelector('.sidebar').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}),'Mobile menu fits viewport');
  assert.deepEqual(errors,[],'No renderer errors');
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,results,errors},null,2));console.log('SHELL_QA_PASS',output);
  await backend.close();app.exit(0);
}).catch(async e=>{if(win && !win.isDestroyed()) await shot('failure').catch(()=>{});await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'failure.txt'),e.stack||String(e));console.error(e);await backend?.close();app.exit(1);});
setTimeout(()=>{console.error('Shell QA timeout');app.exit(1);},180000).unref();



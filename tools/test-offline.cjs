const {app,BrowserWindow}=require('electron');
const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict');
const out=path.resolve(__dirname,`../.runtime/offline-qa-${Date.now()}`);
app.setPath('userData',path.join(out,'profile'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
  await fs.mkdir(out,{recursive:true});
  const step=message=>require('fs').appendFileSync(path.join(out,'steps.log'),message+'\n');
  step('ready');
  setTimeout(()=>{step('timeout');app.exit(1)},180000);
  const {startDesktopServer}=await import('../server/src/desktop-server.js');
  const backend=await startDesktopServer({dataDir:path.resolve(__dirname,'../server',`test-temp-offline-${Date.now()}`)});
  step('server');
  const win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false,offscreen:true}});
  win.webContents.setAudioMuted(true);await win.loadURL(backend.url);step('loaded');
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const post=async(p,b)=>{const r=await fetch('/api'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok)throw new Error(await r.text());return r.json()};
    const credentials={name:'Online QA',email:'online'+Date.now()+'@example.test',password:'OnlineTest123!'};
    await post('/auth/register',credentials);await post('/auth/login',credentials);
    const data=await post('/tracks/online',{url:'https://youtu.be/${process.env.SPMUSIC_QA_VIDEO || 'jNQXAC9IVRw'}',title:'Online playback verification',artist:'Jawed'});
    const again=await post('/tracks/online',{url:'https://youtu.be/${process.env.SPMUSIC_QA_VIDEO || 'jNQXAC9IVRw'}',title:'Online playback verification',artist:'Jawed'});
    const p=await post('/playlists',{name:'Online QA',trackIds:[data.track.id]});
    return {id:data.track.id,duplicate:again.track.id===data.track.id,playlist:p.playlist.trackIds.includes(data.track.id)};
  })()`);
  step('saved');
  const offline=await win.webContents.executeJavaScript(`(async()=>{
    const r=await fetch('/api/youtube/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://youtu.be/${process.env.SPMUSIC_QA_VIDEO || 'jNQXAC9IVRw'}',licensed:true})});const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));
    for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,1000));const j=(await (await fetch('/api/youtube/jobs/'+data.job.id)).json()).job;if(j.status==='failed')throw Error(j.message);if(j.status==='completed')return {id:j.track.id,online:j.track.isOnline};}throw Error('download timeout');
  })()`);
  assert.equal(offline.id,result.id);assert.equal(offline.online,false);
  win.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(backend.url)&&!details.url.startsWith('data:')}));
  step('downloaded; external connections blocked');
  assert.ok(result.duplicate&&result.playlist);
  win.reload();await delay(2500);
  await win.webContents.executeJavaScript(`(()=>{const b=document.querySelector('button[aria-label="Phát Online playback verification"]');if(!b)throw new Error('Track missing');b.click()})()`);
  step('clicked');
  step(JSON.stringify(await win.webContents.executeJavaScript(`(async()=>{const a=document.querySelector('audio');const r=await fetch(a.src);const b=new Uint8Array(await r.arrayBuffer());return {url:a.src,status:r.status,type:r.headers.get('content-type'),length:b.length,header:Array.from(b.slice(0,12)),support:a.canPlayType('audio/mpeg')}})()`)));
  let playback;
  for(let i=0;i<20;i++){
    await delay(1000);
    playback=await win.webContents.executeJavaScript(`([...document.querySelectorAll('audio')].map(a=>({time:a.currentTime,duration:a.duration,paused:a.paused,error:a.error?.code})))`);
    if(playback.some(a=>a.time>1&&!a.paused))break;
  }
  assert.ok(playback.some(a=>a.time>1&&!a.paused),JSON.stringify(playback));
  await win.webContents.executeJavaScript(`(()=>{const a=[...document.querySelectorAll('audio')].find(a=>!a.paused);a.currentTime=10})()`);
  await delay(2500);
  const seek=await win.webContents.executeJavaScript(`([...document.querySelectorAll('audio')].some(a=>a.currentTime>10&&!a.paused))`);
  assert.ok(seek);
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify({result,playback,seek},null,2));
  await fs.writeFile(path.join(out,'library.png'),(await win.webContents.capturePage()).toPNG());
  win.webContents.session.webRequest.onBeforeRequest(null);
  await win.webContents.executeJavaScript(`[...document.querySelectorAll('.sidebar button')].find(b=>b.textContent.trim()==='Tìm kiếm').click()`);await delay(600);
  await win.webContents.executeJavaScript(`(()=>{
    const original=window.fetch.bind(window);window.fetch=(url,options)=>String(url).includes('/api/discover/youtube')?Promise.resolve(new Response(JSON.stringify({configured:true,results:[{id:'${process.env.SPMUSIC_QA_VIDEO || 'jNQXAC9IVRw'}',title:'Online playback verification',artist:'Jawed',sourceUrl:'https://youtu.be/${process.env.SPMUSIC_QA_VIDEO || 'jNQXAC9IVRw'}',thumbnail:'https://i.ytimg.com/vi/${process.env.SPMUSIC_QA_VIDEO || 'jNQXAC9IVRw'}/hqdefault.jpg'}]}),{headers:{'Content-Type':'application/json'}})):original(url,options);
    const input=document.querySelector('input[placeholder*="Tìm bài"]');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'verification');input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);await delay(1500);
  await fs.writeFile(path.join(out,'search.png'),(await win.webContents.capturePage()).toPNG());
  win.setContentSize(1024,768);await delay(500);
  await fs.writeFile(path.join(out,'search-compact.png'),(await win.webContents.capturePage()).toPNG());
  assert.ok(await win.webContents.executeJavaScript('document.documentElement.scrollWidth <= innerWidth'));
  const button=await win.webContents.executeJavaScript(`(()=>{const b=document.querySelector('.discover-offline');if(!b)return false;b.click();return true})()`);assert.ok(button);await delay(500);
  await fs.writeFile(path.join(out,'download-dialog.png'),(await win.webContents.capturePage()).toPNG());
  win.destroy();await backend.close();app.exit(0);
}).catch(async e=>{console.error(e);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'error.txt'),e.stack);app.exit(1)});

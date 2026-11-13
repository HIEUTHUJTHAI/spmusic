const {app,BrowserWindow}=require('electron');
const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict');
const out=path.resolve(__dirname,`../.runtime/online-qa-${Date.now()}`);
app.setPath('userData',path.join(out,'profile'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{
  await fs.mkdir(out,{recursive:true});
  const step=message=>require('fs').appendFileSync(path.join(out,'steps.log'),message+'\n');
  step('ready');
  setTimeout(()=>{step('timeout');app.exit(1)},120000);
  const {startDesktopServer}=await import('../server/src/desktop-server.js');
  const backend=await startDesktopServer({dataDir:path.join(out,'data')});
  step('server');
  const win=new BrowserWindow({show:false,width:1440,height:900,webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false,offscreen:true}});
  win.webContents.setAudioMuted(true);await win.loadURL(backend.url);step('loaded');
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const post=async(p,b)=>{const r=await fetch('/api'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok)throw new Error(await r.text());return r.json()};
    const credentials={name:'Online QA',email:'online'+Date.now()+'@example.test',password:'OnlineTest123!'};
    await post('/auth/register',credentials);await post('/auth/login',credentials);
    const data=await post('/tracks/online',{url:'https://youtu.be/jNQXAC9IVRw',title:'Online playback verification',artist:'Jawed'});
    const again=await post('/tracks/online',{url:'https://youtu.be/jNQXAC9IVRw',title:'Online playback verification',artist:'Jawed'});
    const p=await post('/playlists',{name:'Online QA',trackIds:[data.track.id]});
    return {id:data.track.id,duplicate:again.track.id===data.track.id,playlist:p.playlist.trackIds.includes(data.track.id)};
  })()`);
  step('saved');
  assert.ok(result.duplicate&&result.playlist);
  win.reload();await delay(2500);
  await win.webContents.executeJavaScript(`(()=>{const b=document.querySelector('button[aria-label="Phát Online playback verification"]');if(!b)throw new Error('Track missing');b.click()})()`);
  step('clicked');
  let playback;
  for(let i=0;i<100;i++){
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
  win.destroy();await backend.close();app.exit(0);
}).catch(async e=>{console.error(e);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'error.txt'),e.stack);app.exit(1)});

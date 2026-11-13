import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createDatabase } from '../src/db.js';
import { createYoutubeImporter } from '../src/youtube.js';

test('offline download upgrades online row without losing playlist or edited metadata', async () => {
 const db=await createDatabase();const dir=await fs.mkdtemp(path.resolve('server/test-offline-'));
 for(const name of ['temp','audio','covers'])await fs.mkdir(path.join(dir,name));
 const key=JSON.stringify(['youtube','jNQXAC9IVRw']);
 await db.query("INSERT INTO users(id,name,email,password_hash) VALUES('owner','Test','offline@test','x')");
 await db.query(`INSERT INTO tracks(id,owner_id,title,artist,audio_file,source_key,source_info,cover_file,lyrics_file)
 VALUES('track','owner','Edited title','Edited artist','online-jNQXAC9IVRw',$1,$2,'custom.jpg','lyrics.lrc')`,[key,JSON.stringify({online:true,videoId:'jNQXAC9IVRw'})]);
 await db.query("INSERT INTO playlists(id,owner_id,name,track_ids) VALUES('list','owner','List',ARRAY['track'])");
 let downloads=0;
 const service=createYoutubeImporter({db,uploadsDir:dir,trackView:r=>r,
 inspect:async()=>({id:'jNQXAC9IVRw',title:'Source title',duration:1}),
 download:async(_url,directory)=>{downloads++;const file=path.join(directory,'audio.mp3');await fs.copyFile('server/test/fixtures/silence.mp3',file);return file;},
 prepare:async()=>({ext:'.mp3',format:'MP3',duration:1,sampleRate:44100,bitDepth:null})});
 const wait=async job=>{for(let i=0;i<100;i++){const j=service.status(job.id,'owner');if(['completed','failed'].includes(j.status)&&!service.active('owner'))return j;await new Promise(r=>setTimeout(r,20));}throw Error('timeout');};
 try {
  const job=await wait(service.start('owner',{url:'https://youtu.be/jNQXAC9IVRw',licensed:true}));
  assert.equal(job.status,'completed',job.message);assert.equal(job.track.id,'track');
  assert.equal(job.track.title,'Edited title');assert.equal(job.track.artist,'Edited artist');assert.equal(job.track.cover_file,'custom.jpg');assert.equal(job.track.lyrics_file,'lyrics.lrc');assert.ok(!job.track.source_info.online);
  assert.ok((await fs.stat(path.join(dir,'audio',job.track.audio_file))).size>0);
  assert.deepEqual((await db.query("SELECT track_ids FROM playlists WHERE id='list'")).rows[0].track_ids,['track']);
  const again=await wait(service.start('owner',{url:'https://youtu.be/jNQXAC9IVRw',licensed:true}));assert.equal(again.existing,true);assert.equal(downloads,1);
 } finally {await service.close();await db.close();await fs.rm(dir,{recursive:true,force:true});}
});

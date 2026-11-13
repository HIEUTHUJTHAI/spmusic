import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createDatabase } from '../src/db.js';
import { onlineRoutes, safeStreamUrl } from '../src/online.js';

test('online sources only allow HTTPS YouTube media hosts', () => {
  assert.equal(safeStreamUrl('https://rr1.googlevideo.com/videoplayback'), 'https://rr1.googlevideo.com/videoplayback');
  for (const url of ['http://rr1.googlevideo.com/a','https://googlevideo.com.evil.test/a','https://127.0.0.1/a','https://user@rr1.googlevideo.com/a']) assert.throws(() => safeStreamUrl(url));
});
test('online library persists once per owner and retries expired streams with Range', async () => {
  const db = await createDatabase();
  await db.query("INSERT INTO users(id,name,email,password_hash) VALUES('a','A','a@test','x'),('b','B','b@test','x')");
  const app = express(); app.use(express.json());
  let resolves = 0, requests = 0;
  const service = onlineRoutes(app, { db, requireAuth: (req,res,next) => {req.user={id:req.headers['x-owner'] || 'a'};next();}, trackView: r => r,
    resolve: async () => {resolves++;return {url:'https://rr1.googlevideo.com/videoplayback'};},
    request: async (_url, options) => { assert.equal(options.headers.Range,'bytes=0-3'); requests++;return requests === 1 ? new Response('',{status:403}) : new Response('abcd',{status:206,headers:{'content-type':'audio/webm','content-range':'bytes 0-3/4'}}); }
  });
  app.get('/stream', (req,res,next) => service.stream(req,res,{source_info:{videoId:'jNQXAC9IVRw'}}).catch(next));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const add = async owner => {const r=await fetch(base+'/api/tracks/online',{method:'POST',headers:{'content-type':'application/json','x-owner':owner},body:JSON.stringify({url:'https://youtu.be/jNQXAC9IVRw',title:'Test online',artist:'Test'})});assert.ok(r.ok);return r.json();};
    const first=await add('a'),second=await add('a'),other=await add('b');
    assert.equal(first.track.id,second.track.id);assert.equal(second.existing,true);assert.notEqual(first.track.id,other.track.id);
    assert.equal(first.track.source_info.online,true);
    const response=await fetch(base+'/stream',{headers:{Range:'bytes=0-3'}});
    assert.equal(response.status,206);assert.equal(await response.text(),'abcd');assert.equal(resolves,2);
    await fetch(base+'/stream',{headers:{Range:'bytes=0-3'}}).then(r=>r.text());assert.equal(resolves,2);
  } finally {await new Promise(r=>server.close(r));await db.close();}
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { discoveryRoutes } from '../src/discovery.js';

test('YouTube charts validate regions, handle missing key and use music chart for the selected country', async () => {
  const originalFetch = globalThis.fetch, previous = process.env.YOUTUBE_API_KEY;
  const app = express(); discoveryRoutes(app);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    delete process.env.YOUTUBE_API_KEY;
    assert.equal((await originalFetch(`${base}/api/discover/youtube-chart?region=XX`)).status, 400);
    assert.deepEqual(await (await originalFetch(`${base}/api/discover/youtube-chart?region=VN`)).json(), { configured: false, results: [] });
    process.env.YOUTUBE_API_KEY = 'test-key';
    let requested;
    globalThis.fetch = async (url) => { requested = new URL(url); return { ok: true, json: async () => ({ items: [{ id: 'AbCdEfGh123', snippet: { title: 'Demo', channelTitle: 'Artist' }, statistics: { viewCount: '123' } }] }) }; };
    const data = await (await originalFetch(`${base}/api/discover/youtube-chart?region=VN`)).json();
    assert.equal(requested.searchParams.get('chart'), 'mostPopular');
    assert.equal(requested.searchParams.get('videoCategoryId'), '10');
    assert.equal(requested.searchParams.get('regionCode'), 'VN');
    assert.equal(data.results[0].title, 'Demo');
    assert.equal(JSON.stringify(data).includes('test-key'), false);
    let calls = 0;
    globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ items: [{ id: 'AbCdEfGh123', snippet: { title: 'Demo' } }] }) }; };
    const combined = await (await originalFetch(`${base}/api/discover/youtube-chart?region=INTL`)).json();
    assert.equal(calls, 6);
    assert.equal(combined.results.length, 1);
    assert.equal(combined.results[0].appearances, 6);
    assert.equal(combined.sourceCountries.length, 6);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY = previous;
    await new Promise((resolve) => server.close(resolve));
  }
});

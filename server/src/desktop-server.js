import fs from 'node:fs/promises';
import path from 'node:path';
import { createDatabase } from './db.js';
import { createApp } from './app.js';

export async function startDesktopServer({ dataDir }) {
  await fs.mkdir(dataDir, { recursive: true });
  const db = await createDatabase({ dataDir });
  let app;
  let server;
  try {
    app = await createApp({ db, dataDir });
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
      instance.once('error', reject);
    });
  } catch (error) {
    await app?.locals.openMusic?.close();
    await db.close();
    throw error;
  }
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  let closed = false;
  return {
    url,
    async close() {
      if (closed) return;
      closed = true;
      app.locals.lyricsAI.close();
      await app.locals.openMusic.close();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await db.close();
    },
  };
}

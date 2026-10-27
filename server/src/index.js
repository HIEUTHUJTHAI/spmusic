import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './db.js';
import { createApp } from './app.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });
const dataDir = path.resolve(serverRoot, process.env.DATA_DIR || 'data');
const db = await createDatabase({ dataDir });
const app = await createApp({ db, dataDir });
const port = Number(process.env.PORT || 3001),
  host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () =>
  console.log(`SPMusic API: http://${host}:${port} (${db.engine})`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    app.locals.lyricsAI.close();
    server.close(async () => {
      await app.locals.openMusic.close();
      await app.locals.youtube.close();
      await db.close();
      process.exit(0);
    });
  });

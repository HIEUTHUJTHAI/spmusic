import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { NodeFS } from '@electric-sql/pglite/nodefs';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function createDatabase({ databaseUrl = process.env.DATABASE_URL, dataDir } = {}) {
  let client;
  if (databaseUrl) {
    client = new pg.Pool({ connectionString: databaseUrl, max: 5 });
  } else {
    if (dataDir) await fs.mkdir(dataDir, { recursive: true });
    // Explicit NodeFS also handles absolute Windows drive paths correctly.
    client = dataDir
      ? new PGlite({ fs: new NodeFS(path.join(dataDir, 'postgres')) })
      : new PGlite();
    await client.waitReady;
  }
  const query = (sql, params = []) => client.query(sql, params);
  const schema = await fs.readFile(path.join(here, 'schema.sql'), 'utf8');
  // PGlite's extended query protocol accepts one statement at a time.
  for (const statement of schema
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await query(statement);
  return {
    query,
    close: () => (databaseUrl ? client.end() : client.close()),
    engine: databaseUrl ? 'postgresql' : 'pglite',
  };
}

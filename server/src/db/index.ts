// DB 연결 — DATABASE_URL 이 있으면 PostgreSQL(운영·Railway), 없으면 내장 PGlite(로컬 개발·테스트, 설치 불필요).
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleLite } from 'drizzle-orm/pglite';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import * as schema from './schema.ts';

export type Db = ReturnType<typeof drizzleLite<typeof schema>>; // 칼럼 이름은 snake_case
const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

// dir: 'memory' 이면 메모리 DB(테스트)
export async function openDb(opts: { url?: string; dir?: string } = {}): Promise<{ db: Db; close: () => Promise<void> }> {
  const url = opts.url ?? process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: 10 });
    const db = drizzlePg(client, { schema, casing: 'snake_case' }) as unknown as Db;
    await migratePg(db as any, { migrationsFolder: MIGRATIONS });
    return { db, close: () => client.end() };
  }
  const dir = opts.dir ?? process.env.PGLITE_DIR ?? fileURLToPath(new URL('../../.data/pglite', import.meta.url));
  if (dir !== 'memory') mkdirSync(dir, { recursive: true });
  const client = dir === 'memory' ? new PGlite() : new PGlite(dir);
  const db = drizzleLite(client, { schema, casing: 'snake_case' });
  await migrateLite(db, { migrationsFolder: MIGRATIONS });
  return { db, close: () => client.close() };
}
export { schema };

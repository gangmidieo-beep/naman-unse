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
    // Railway 내부망(postgres.railway.internal)은 컨테이너가 뜬 직후 몇 초 동안 이름이 안 풀릴 수 있다(2026-10-22 실제 발생: 서버가 바로 죽고 재시작 반복).
    // 연결·이름 풀이 실패면 최대 90초(3초 × 30회) 다시 시도하고, 그래도 안 되면 그때 종료
    for (let i = 1; ; i++) {
      try { await migratePg(db as any, { migrationsFolder: MIGRATIONS }); break; }
      catch (e) {
        const code = (e as any)?.cause?.code ?? (e as any)?.code;
        if (i >= 30 || !['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ETIMEDOUT', 'CONNECT_TIMEOUT'].includes(code)) throw e;
        console.warn(`[db] 연결 대기 ${i}/30 (${code}) — 3초 뒤 다시`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
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

// 서버 시작 — PORT(기본 8791). DEMO_DATA=true 면 관리자 확인용 데모 데이터(개발 전용).
import { buildApp } from './app.ts';
import { openDb } from './db/index.ts';
import { createAdmin } from './services/seed.ts';
import { schema as S } from './db/index.ts';
import { startReadingWorker } from './services/reading/generate.ts';

// 첫 배포용: ADMIN_EMAIL + ADMIN_INIT_PASSWORD 가 있고 관리자가 한 명도 없을 때만 한 번 만든다.
// (양도 때 이전 관리자를 지워도 재시작하면서 다시 생기지 않게 — 이후 계정·비밀번호는 관리자 화면 「관리자 계정」에서)
if (process.env.ADMIN_EMAIL && process.env.ADMIN_INIT_PASSWORD) {
  const { db, close } = await openDb();
  const email = process.env.ADMIN_EMAIL.toLowerCase();
  const [any] = await db.select({ id: S.admins.id }).from(S.admins).limit(1);
  if (!any && process.env.ADMIN_INIT_PASSWORD.length >= 10) await createAdmin(db, email, process.env.ADMIN_INIT_PASSWORD, 'super');
  await close();
}

const { app, db } = await buildApp({ logger: true, demo: process.env.DEMO_DATA === 'true' });
const port = Number(process.env.PORT || 8791);
await app.listen({ port, host: '0.0.0.0' });
// 결제된 풀이를 3초마다 생성(동시 3개)
startReadingWorker(db, app.log);

// 서버 시작 — PORT(기본 8791). DEMO_DATA=true 면 관리자 확인용 데모 데이터(개발 전용).
import { buildApp } from './app.ts';
import { openDb } from './db/index.ts';
import { createAdmin } from './services/seed.ts';
import { schema as S } from './db/index.ts';
import { eq } from 'drizzle-orm';
import { startReadingWorker } from './services/reading/generate.ts';

// 첫 배포용: ADMIN_EMAIL + ADMIN_INIT_PASSWORD 가 있고 그 관리자가 아직 없을 때만 한 번 만든다(이후 비밀번호는 관리자 화면·CLI 로 변경)
if (process.env.ADMIN_EMAIL && process.env.ADMIN_INIT_PASSWORD) {
  const { db, close } = await openDb();
  const email = process.env.ADMIN_EMAIL.toLowerCase();
  const [found] = await db.select({ id: S.admins.id }).from(S.admins).where(eq(S.admins.email, email));
  if (!found && process.env.ADMIN_INIT_PASSWORD.length >= 10) await createAdmin(db, email, process.env.ADMIN_INIT_PASSWORD, 'super');
  await close();
}

const { app, db } = await buildApp({ logger: true, demo: process.env.DEMO_DATA === 'true' });
const port = Number(process.env.PORT || 8791);
await app.listen({ port, host: '0.0.0.0' });
// 결제된 풀이를 3초마다 생성(동시 3개)
startReadingWorker(db, app.log);

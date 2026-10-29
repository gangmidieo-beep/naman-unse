// 서버 시작 — PORT(기본 8791). DEMO_DATA=true 면 관리자 확인용 데모 데이터(개발 전용).
import { buildApp } from './app.ts';
import { openDb } from './db/index.ts';
import { createAdmin } from './services/seed.ts';
import { schema as S } from './db/index.ts';
import { startReadingWorker } from './services/reading/generate.ts';
import { aiStatus, normalizeAiEnv } from './services/env.ts';

// AI 변수 값 정리(앞뒤 공백·따옴표·대소문자) — 대표님이 Railway 화면에서 직접 넣은 값이 조금 달라도 켜지게
normalizeAiEnv();
console.log('[AI] 상태', JSON.stringify(aiStatus()));

// 운영 필수값 점검 — 비밀키 없이 떠서 첫 로그인 때 죽는 일이 없게 시작 전에 거부
if ((process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') && !process.env.JWT_SECRET) { console.error('JWT_SECRET 이 없어요 — Railway 변수(또는 .env)에 32자 이상 임의 문자열을 넣어 주세요'); process.exit(1); }
// 운영에서 이 값이 없으면 조용히 잘못 돈다(DB 없으면 컨테이너 디스크에 저장 → 배포 때 전부 사라짐, 주소 없으면 결제 통보가 localhost 로 감) → 시작 거부
if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
  const need = ['DATABASE_URL', 'API_ORIGIN', 'PUBLIC_WEB_ORIGIN'].filter((k) => !process.env[k]);
  if (need.length) { console.error(`운영 필수 변수가 없어요: ${need.join(', ')} — Railway › server › Variables 에 넣어 주세요`); process.exit(1); }
}
// 잡히지 않은 비동기 오류는 로그만 남기고 서버는 계속(Node 는 기본으로 프로세스를 끝내 버림)
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));

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

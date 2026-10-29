// 나만의 운세 서버 — Fastify. 공개 API + 관리자 API(/admin/api). MOCK_MODE 면 결제·로그인·푸시를 가짜로 처리한다.
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { mockMode } from './services/mock.ts';
import { aiDiag, aiErrorHint, aiStatus } from './services/env.ts';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import bcrypt from 'bcryptjs';
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { openDb, schema as S, type Db } from './db/index.ts';
import { seedBase, seedDemo } from './services/seed.ts';
import { newId, signAdmin, signPdf, signUser, verify, verifyPdf, type AdminClaims, type UserClaims } from './services/auth.ts';
import { readingHtml, renderPdf } from './services/reading/pdf.ts';
import { exchange, isConfigured, isProvider, startUrl, takeState } from './services/oauth.ts';
import { contentStats, dashboard, memberDetail, members, payments, range, subscriptionStats, toCsv } from './services/stats.ts';
import { shareCard } from './services/card.ts';
import { fulfillOrder, revokeOrder } from './services/payments/fulfill.ts';
import { nextRebillDate, normalizePhone, parsePayappFeedback, payappCancel, payappEnv, payappRebillCancel, payappRebillRegist, payappRequest, rebillDay } from './services/payments/payapp.ts';
import { playConfigured, readRtdn, subscriptionUsable, verifyProduct, verifyPubsubToken, verifySubscription } from './services/payments/google-play.ts';
import { fcmConfigured, sendPush } from './services/push/fcm.ts';
import { runDailyPush, runExpiryReminders } from './services/push/daily.ts';
import { costCap, liveAI } from './services/reading/generate.ts';
import { generateTarot, type TarotInput } from './services/tarot.ts';
import brand from '../../brand.config.json' with { type: 'json' };
import { analyzePhoto, babyLive, generateBaby, photoLive, sampleBaby, samplePhoto } from './services/photo.ts';

const WEB = () => process.env.PUBLIC_WEB_ORIGIN || 'http://localhost:5391';
// 회원가(관리자가 따로 정하지 않은 상품) = 정가 × (1 − 할인율), 100원 단위 내림. 할인율은 brand.config.json
const memberPrice = (price: number) => Math.floor((price * (1 - ((brand as any).subscription?.memberDiscountRate ?? 0.1))) / 100) * 100;

const payReturnUrl = (orderId: string) => `${API()}/pay/payapp/return?order=${orderId}`;
const API = () => process.env.API_ORIGIN || `http://localhost:${process.env.PORT || 8791}`;
const UPLOADS = fileURLToPath(new URL('../.data/uploads', import.meta.url));

export async function buildApp(opts: { db?: Db; demo?: boolean; logger?: boolean; mock?: boolean; http?: typeof fetch } = {}) {
  // 시험 모드(결제 없이 바로 지급)는 MOCK_MODE=true 라고 똑똑히 적었을 때만. 변수가 없거나 오타면 '운영'으로 본다(예전엔 반대라 변수를 지우면 공짜 지급이 됐음)
  const MOCK = opts.mock ?? mockMode();
  if (MOCK && (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production')) console.warn('[경고] 운영 환경인데 MOCK_MODE=true — 결제 없이 상품이 지급됩니다. Railway 변수 MOCK_MODE 를 false 로 바꾸세요.');
  const http = opts.http ?? fetch;
  // trustProxy: Railway 프록시 뒤라 손님 IP 를 X-Forwarded-For 에서 읽어야 함(없으면 모든 손님이 같은 IP → 요청 제한이 사이트 전체 합계가 됨)
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 6 * 1024 * 1024, trustProxy: true });
  // 서버 오류 문구(SQL 등)를 손님에게 보이지 않게 — 기록은 로그에만
  app.setErrorHandler((err: any, req, rep) => {
    const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    if (code >= 500) { req.log.error(err); return rep.code(code).send({ error: '잠시 후 다시 시도해 주세요' }); }
    return rep.code(code).send({ error: code === 429 ? '요청이 많아요. 잠시 후 다시 시도해 주세요' : err.message });
  });
  const db = opts.db ?? (await openDb()).db;
  await seedBase(db);
  if (opts.demo) await seedDemo(db);
  const origins = [WEB(), 'https://localhost', 'capacitor://localhost', 'http://localhost', /^http:\/\/localhost:\d+$/]; // 앱(Capacitor 안드로이드)은 https://localhost
  // methods 를 꼭 적어야 함 — @fastify/cors 기본값은 GET·HEAD·POST 뿐이라 브라우저가 PATCH·PUT·DELETE 를 막음
  // (2026-10-27 대표님 제보: 관리자 상품 가격·이미지 저장 안 됨, 광고 설정·배너 삭제·관리자 삭제·내 사주 삭제도 같은 원인)
  await app.register(cors, { origin: origins, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(rateLimit, { global: false });
  // PayApp 결제 통보는 form(x-www-form-urlencoded) 으로 온다
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    try { done(null, Object.fromEntries(new URLSearchParams(String(body)))); } catch (e) { done(e as Error, undefined); }
  });

  /* ---------- 인증 도우미 ---------- */
  const bearer = (req: FastifyRequest) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const userOf = async (req: FastifyRequest) => {
    const c = await verify<UserClaims>(bearer(req));
    return c?.kind === 'user' ? c.sub : null;
  };
  const needUser = async (req: FastifyRequest, rep: FastifyReply) => {
    const id = await userOf(req);
    if (!id) { rep.code(401).send({ error: '로그인이 필요해요' }); return null; }
    const [u] = await db.update(S.users).set({ lastSeenAt: new Date() }).where(and(eq(S.users.id, id), isNull(S.users.deletedAt))).returning({ id: S.users.id });
    if (!u) { rep.code(401).send({ error: '탈퇴한 계정이에요', code: 'deleted' }); return null; }
    return id;
  };
  const isPremium = async (userId: string) =>
    !!(await db.select({ id: S.subscriptions.id }).from(S.subscriptions)
      .where(and(eq(S.subscriptions.userId, userId), inArray(S.subscriptions.status, ['active', 'grace']), gt(S.subscriptions.expiresAt, new Date()))).limit(1))[0];

  // ai: 유료 풀이(reading)·손금관상(photo)·2세(baby) 켜짐 여부 + 빠진 변수 이름(값은 안 보임) — 양도 후 대표님 키 입력 확인용
  app.get('/health', async () => ({ ok: true, mock: MOCK, ai: { ...aiStatus(), lastOkAt: aiDiag.lastOkAt, lastError: aiDiag.lastError, hint: aiErrorHint(aiDiag.lastError) } }));
  // 운세함 '공지사항' — 아직 관리자 공지 기능이 없어 빈 목록(화면은 "공지가 없어요"). 2026-10-23 양도 전 점검: 404 로그 제거
  app.get('/notices', async () => [] as { id: string; title: string; body: string; createdAt: string }[]);
  // 화면이 "어떤 로그인을 보여줄지·결제 전에 로그인을 요구할지" 정할 때 씀(키가 등록된 것만)
  app.get('/auth/providers', async () => ({ providers: MOCK ? ['google', 'kakao', 'naver'] : (['google', 'kakao', 'naver'] as const).filter((p) => isConfigured(p)) }));

  /* ---------- 게스트·로그인 ---------- */
  app.post('/auth/guest', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const { deviceId, platform } = (req.body ?? {}) as { deviceId?: string; platform?: string };
    const dev = deviceId || newId('d_');
    let [u] = await db.select().from(S.users).where(and(eq(S.users.deviceId, dev), isNull(S.users.provider)));
    if (!u) [u] = await db.insert(S.users).values({ id: newId('u_'), deviceId: dev, platform: platform ?? 'web' }).returning();
    return { token: await signUser(u.id), userId: u.id, deviceId: dev };
  });

  const finishLogin = async (rep: FastifyReply, provider: string, info: { providerId: string; name: string; email: string | null }, back: string, nonce = '') => {
    let [u] = await db.select().from(S.users).where(and(eq(S.users.provider, provider), eq(S.users.providerId, info.providerId)));
    if (!u) [u] = await db.insert(S.users).values({ id: newId('u_'), provider, providerId: info.providerId, name: info.name, email: info.email }).returning();
    const token = await signUser(u.id);
    const q = new URLSearchParams({ token, provider, name: u.name ?? info.name, uid: u.id, back, ...(nonce ? { nonce } : {}) });
    return rep.redirect(`${WEB()}/auth/callback?${q}`);
  };
  app.get('/auth/:provider/start', async (req, rep) => {
    const { provider } = req.params as { provider: string };
    const { redirect = WEB(), nonce: rawNonce = '' } = req.query as { redirect?: string; nonce?: string };
    const nonce = /^[A-Za-z0-9_-]{8,64}$/.test(rawNonce) ? rawNonce : '';
    if (!isProvider(provider)) return rep.code(404).send({ error: '지원하지 않는 로그인' });
    const back = (() => { try { const u = new URL(redirect); return u.pathname + u.search; } catch { return '/box'; } })();
    if (!isConfigured(provider)) {
      if (!MOCK) return rep.code(503).send({ error: `${provider} 로그인 키가 아직 없어요` });
      return finishLogin(rep, provider, { providerId: `mock-${provider}`, name: `${provider} 테스트 계정`, email: null }, back, nonce);
    }
    return rep.redirect(startUrl(provider, `${API()}/auth/${provider}/callback`, back, nonce));
  });
  app.get('/auth/:provider/callback', async (req, rep) => {
    const { provider } = req.params as { provider: string };
    const { code, state } = req.query as { code?: string; state?: string };
    const st = state ? takeState(state) : null;
    if (!isProvider(provider) || !code || !st) return rep.redirect(`${WEB()}/auth/callback?error=1`);
    try {
      const info = await exchange(provider, code, `${API()}/auth/${provider}/callback`, state!);
      return await finishLogin(rep, provider, info, st.redirect, st.nonce);
    } catch (e) { // 제공자 쪽 오류(코드 만료·키 불일치 등) — 500 대신 로그인 화면으로
      req.log.warn(`[oauth ${provider}] ${(e as Error).message}`);
      return rep.redirect(`${WEB()}/auth/callback?error=1`);
    }
  });
  // 로그인 연장 — 쓰는 동안은 30일마다 다시 로그인하지 않게(화면이 하루 한 번 부름). 탈퇴·합쳐진 계정은 안 됨
  app.post('/auth/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = await needUser(req, rep);
    if (!id) return;
    const [u] = await db.select().from(S.users).where(eq(S.users.id, id));
    if (!u || u.deletedAt || u.mergedInto) return rep.code(401).send({ error: '다시 로그인해 주세요' });
    return { token: await signUser(id) };
  });
  // 게스트로 쓰던 사주·구매·부적·구독·이벤트를 로그인 계정으로 합치기
  app.post('/auth/merge', async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const { guestToken } = (req.body ?? {}) as { guestToken?: string };
    const g = guestToken ? await verify<UserClaims>(guestToken) : null;
    if (!g || g.sub === userId) return { merged: 0 };
    const guestId = g.sub;
    // 합칠 수 있는 건 '로그인 안 한 게스트'뿐 — 다른 회원 계정·이미 합쳐진·탈퇴한 계정의 기록은 옮기지 않는다
    const [gu] = await db.select().from(S.users).where(eq(S.users.id, guestId));
    if (!gu || gu.provider || gu.mergedInto || gu.deletedAt) return { merged: 0 };
    let merged = 0;
    for (const t of [S.profiles, S.orders, S.talismans, S.subscriptions] as const) {
      const r = await db.update(t as any).set({ userId }).where(eq((t as any).userId, guestId)).returning();
      merged += r.length;
    }
    await db.update(S.events).set({ userId }).where(eq(S.events.userId, guestId));
    await db.update(S.users).set({ mergedInto: userId }).where(eq(S.users.id, guestId));
    return { merged };
  });

  /* ---------- 내 정보·사주 ---------- */
  app.get('/me', async (req, rep) => {
    const id = await needUser(req, rep);
    if (!id) return;
    const [u] = await db.select().from(S.users).where(eq(S.users.id, id));
    return { user: u, premium: await isPremium(id) };
  });
  // 회원 탈퇴 — 개인정보(사주·부적 각인·풀이 본문·공유 링크·푸시)는 바로 지우고, 결제 기록은 전자상거래법에 따라 5년 보관(개인 식별 정보 없이).
  // 같은 구글·카카오·네이버 계정으로 다시 들어오면 새 계정으로 시작. Play 구독은 구글 플레이에서 따로 해지해야 함.
  app.post('/me/delete', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, rep) => {
    const id = await needUser(req, rep);
    if (!id) return;
    const ids = [id, ...(await db.select({ id: S.users.id }).from(S.users).where(eq(S.users.mergedInto, id))).map((x) => x.id)]; // 합쳐진 게스트 기록까지
    await stopRebills(ids, '회원 탈퇴').catch((e) => req.log.error(`[payapp rebill] 탈퇴 해지 실패 user=${id} ${e.message}`)); // 웹 월 자동결제가 있으면 다음 달부터 결제되지 않게 해지
    const orderIds = (await db.select({ id: S.orders.id }).from(S.orders).where(inArray(S.orders.userId, ids))).map((x) => x.id);
    if (orderIds.length) await db.update(S.readings).set({ content: null, profileId: null }).where(inArray(S.readings.orderId, orderIds));
    await db.update(S.orders).set({ profileId: null }).where(inArray(S.orders.userId, ids));
    await db.delete(S.profiles).where(inArray(S.profiles.userId, ids));
    await db.delete(S.talismans).where(inArray(S.talismans.userId, ids));
    await db.delete(S.shareLinks).where(inArray(S.shareLinks.userId, ids));
    await db.update(S.events).set({ userId: null }).where(inArray(S.events.userId, ids));
    await db.update(S.users).set({ deletedAt: new Date(), deviceId: null, provider: null, providerId: null, email: null, name: null, pushToken: null, pushConsent: false })
      .where(inArray(S.users.id, ids));
    return { ok: true };
  });
  // 앱 푸시 토큰·동의·받을 시각 저장(앱이 알림 허용 직후 부름)
  app.post('/me/push', async (req, rep) => {
    const id = await needUser(req, rep);
    if (!id) return;
    const b = (req.body ?? {}) as { token?: string; consent?: boolean; time?: string };
    // 보낸 값만 바꾼다(운세함에서 알림 시간·켜고 끄기만 바꿀 때 토큰을 지우지 않게)
    const set: Partial<typeof S.users.$inferInsert> = { platform: 'android' };
    if (b.token !== undefined) set.pushToken = b.token ? String(b.token).slice(0, 400) : null;
    if (b.consent !== undefined) set.pushConsent = !!b.consent;
    if (b.time !== undefined) set.pushTime = /^\d{2}:\d{2}$/.test(b.time) ? b.time : '07:00';
    await db.update(S.users).set(set).where(eq(S.users.id, id));
    return { ok: true };
  });
  app.get('/profiles', async (req, rep) => {
    const id = await needUser(req, rep);
    if (!id) return;
    return db.select().from(S.profiles).where(eq(S.profiles.userId, id)).orderBy(asc(S.profiles.createdAt));
  });
  app.post('/profiles', async (req, rep) => {
    const id = await needUser(req, rep);
    if (!id) return;
    const b = (req.body ?? {}) as any;
    const y = +b.year, m = +b.month, d = +b.day, hh = b.hour == null || b.hour === '' ? null : +b.hour;
    if (!String(b.name ?? '').trim() || !Number.isInteger(y) || y < 1900 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(d) || d < 1 || d > 31 || (hh != null && (!Number.isInteger(hh) || hh < 0 || hh > 23)))
      return rep.code(400).send({ error: '이름·생년월일을 확인해 주세요', code: 'profile_invalid' });
    if (b.id != null && !/^[A-Za-z0-9_-]{1,40}$/.test(String(b.id))) return rep.code(400).send({ error: '사주 정보를 확인해 주세요', code: 'profile_invalid' });
    const count = (await db.select({ id: S.profiles.id }).from(S.profiles).where(eq(S.profiles.userId, id))).length;
    const exists = b.id && (await db.select({ id: S.profiles.id }).from(S.profiles).where(and(eq(S.profiles.id, b.id), eq(S.profiles.userId, id))))[0];
    // 저장 가능한 사주: 일반 2개 / 프리미엄 무제한
    if (!exists && count >= 2 && !(await isPremium(id))) return rep.code(402).send({ error: '일반 회원은 사주를 2개까지 저장할 수 있어요', code: 'profile_limit' });
    // 같은 id 가 다른 계정 것이면(같은 폰을 여러 사람이 쓴 경우) 덮어쓰지 않고 새 id 로 저장 — 화면이 돌려받은 id 로 바꾼다
    const taken = !exists && b.id && (await db.select({ id: S.profiles.id }).from(S.profiles).where(eq(S.profiles.id, b.id)))[0];
    const v = {
      id: taken || !b.id ? newId('p_') : String(b.id), userId: id, name: String(b.name).trim().slice(0, 20), relation: b.relation ? String(b.relation).slice(0, 20) : null, gender: b.gender === 'M' ? 'M' : 'F',
      birthYear: y, birthMonth: m, birthDay: d, calendar: b.calendar === 'lunar' ? 'lunar' : 'solar', leap: !!b.leap,
      birthHour: hh, bloodType: b.bloodType ? String(b.bloodType).slice(0, 4) : null, mbti: b.mbti ? String(b.mbti).slice(0, 4) : null, isMain: !!b.isMain,
    };
    if (exists) await db.update(S.profiles).set(v).where(eq(S.profiles.id, v.id));
    else await db.insert(S.profiles).values(v);
    return v;
  });
  app.delete('/profiles/:pid', async (req, rep) => {
    const id = await needUser(req, rep);
    if (!id) return;
    await db.delete(S.profiles).where(and(eq(S.profiles.id, (req.params as any).pid), eq(S.profiles.userId, id)));
    return { ok: true };
  });

  /* ---------- 상품·배너·광고 설정 (앱이 읽는 값) ---------- */
  app.get('/products', async () => db.select().from(S.products).where(eq(S.products.visible, true)).orderBy(asc(S.products.kind), asc(S.products.sort)));
  app.get('/banners', async (req) => {
    const { slot = 'home' } = req.query as { slot?: string };
    const now = new Date();
    return db.select().from(S.banners).where(and(eq(S.banners.slot, slot), eq(S.banners.active, true),
      or(isNull(S.banners.startsAt), lte(S.banners.startsAt, now)), or(isNull(S.banners.endsAt), gt(S.banners.endsAt, now)))).orderBy(asc(S.banners.sort));
  });
  app.get('/ads', async () => db.select().from(S.adSettings));
  app.get('/categories', async () => db.select().from(S.categories).where(eq(S.categories.visible, true)).orderBy(asc(S.categories.tab), asc(S.categories.sort)));
  // 사진운세 — 사진은 메모리에서만 처리하고 저장·로그하지 않는다(logLevel silent). 결과 글·2세 그림만 그 주문의 readings 에 보관.
  // 결제한 주문(orderId)이 있고 AI 키가 있으면 실제 분석, 아니면 예시 결과. 같은 주문은 한 번 만든 결과를 다시 돌려준다(비용 보호).
  const photoOrder = async (req: FastifyRequest, rep: FastifyReply, orderId: string, productId: string) => {
    const userId = await needUser(req, rep);
    if (!userId) return null;
    const [o] = await db.select().from(S.orders).where(and(eq(S.orders.id, orderId), eq(S.orders.userId, userId)));
    if (!o || o.status !== 'paid' || o.productId !== productId) { rep.code(404).send({ error: '결제된 주문을 찾지 못했어요' }); return null; }
    const [r] = await db.select().from(S.readings).where(eq(S.readings.orderId, o.id));
    return { o, r };
  };
  const saveResult = async (o: { id: string; profileId: string | null; productId: string }, r: { id: string } | undefined, content: unknown, model: string | null) => {
    if (r) await db.update(S.readings).set({ status: 'done', content: content as any, model, doneAt: new Date() }).where(eq(S.readings.id, r.id));
    else await db.insert(S.readings).values({ id: newId('r_'), orderId: o.id, profileId: o.profileId, productId: o.productId, status: 'done', content: content as any, model, doneAt: new Date() });
  };
  const IMG = /^data:image\/(png|jpe?g|webp|heic|svg\+xml);base64,/;
  app.post('/photo/analyze', { bodyLimit: 8 * 1024 * 1024, logLevel: 'silent', config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, rep) => {
    const { kind, image, orderId } = (req.body ?? {}) as { kind?: string; image?: string; orderId?: string };
    if ((kind !== 'palm' && kind !== 'face') || typeof image !== 'string' || !IMG.test(image)) return rep.code(400).send({ error: '사진 형식을 확인해 주세요' });
    if (!orderId) return samplePhoto(kind); // 예전 화면·시안: 예시 결과
    const found = await photoOrder(req, rep, orderId, kind);
    if (!found) return;
    if ((found.r?.content as any)?.photo) return (found.r!.content as any).photo;
    if (!photoLive()) { const res = samplePhoto(kind); await saveResult(found.o, found.r, { photo: res }, 'sample'); return res; }
    try {
      const res = await analyzePhoto(kind, image, http); // image 는 이 요청이 끝나면 버려진다
      if ('error' in res) return rep.code(422).send({ error: kind === 'palm' ? '손바닥이 잘 보이게 밝은 곳에서 다시 찍어 주세요' : '얼굴 정면이 잘 보이게 다시 찍어 주세요', code: 'unclear' });
      await saveResult(found.o, found.r, { photo: res }, process.env.PHOTO_AI_MODEL || 'claude-sonnet-5-5');
      return res;
    } catch { return rep.code(502).send({ error: '풀이가 잠시 지연되고 있어요. 조금 뒤 다시 시도해 주세요.' }); }
  });
  app.post('/photo/baby', { bodyLimit: 16 * 1024 * 1024, logLevel: 'silent', config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req, rep) => {
    const { a, b, orderId } = (req.body ?? {}) as { a?: string; b?: string; orderId?: string };
    if (typeof a !== 'string' || typeof b !== 'string' || !IMG.test(a) || !IMG.test(b)) return rep.code(400).send({ error: '두 사람의 사진을 확인해 주세요' });
    if (!orderId) return sampleBaby();
    const found = await photoOrder(req, rep, orderId, 'baby');
    if (!found) return;
    if ((found.r?.content as any)?.baby) return (found.r!.content as any).baby;
    if (!babyLive()) return sampleBaby(); // 키 없음: 예시 그림(보관하지 않음 — 키가 들어오면 다시 만들 수 있게)
    try {
      const res = await generateBaby(a, b, http);
      await saveResult(found.o, found.r, { baby: res }, process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image');
      return res;
    } catch { return rep.code(502).send({ error: '아이 얼굴을 그리는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' }); }
  });

  /* ---------- 주문(결제) ----------
     channel: web(PayApp) | google(Play) | mock. 서버가 상품 가격으로 금액을 정한다(화면이 보낸 금액은 믿지 않음).
     MOCK 이면 바로 결제 완료. 실결제는 pending 주문 → 결제사 확인(통보·검증) → fulfillOrder. */
  const PG = () => (process.env.PG_PROVIDER ?? 'mock').toLowerCase();
  app.post('/orders', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const b = (req.body ?? {}) as { productId: string; profileId?: string; method?: string; channel?: string; phone?: string; inApp?: boolean };
    const [p] = await db.select().from(S.products).where(eq(S.products.id, String(b.productId)));
    if (!p || !p.visible) return rep.code(404).send({ error: '없는 상품이에요' });
    // 풀이에 쓸 사주는 반드시 이 계정에 저장된 것 — 남의 사주 id 로 풀이를 받거나, 저장 실패한 사주로 결제돼 풀이가 안 써지는 일 막기
    const pids = String(b.profileId ?? '').split('+').filter(Boolean);
    if (pids.length) {
      const own = await db.select({ id: S.profiles.id }).from(S.profiles).where(and(inArray(S.profiles.id, pids), eq(S.profiles.userId, userId)));
      if (own.length < new Set(pids).size) return rep.code(400).send({ error: '사주 정보가 저장되지 않았어요. 사주를 다시 저장한 뒤 결제해 주세요.', code: 'profile_missing' });
    }
    const premium = await isPremium(userId);
    const amount = p.kind !== 'subscription' && premium ? p.memberPrice ?? memberPrice(p.price) : p.price;
    const kind = p.kind === 'talisman' ? 'talisman' : p.kind === 'subscription' ? 'subscription' : 'reading';
    const channel = MOCK ? 'mock' : b.channel === 'google' ? 'google' : 'pg';
    const base = { id: newId('O'), userId, profileId: b.profileId ?? null, productId: p.id, kind, amount, discount: p.price - amount, method: b.method ?? (channel === 'google' ? 'google' : 'card'), channel, status: 'pending' as const };

    if (channel === 'mock') {
      const [o] = await db.insert(S.orders).values(base).returning();
      return fulfillOrder(db, o);
    }
    // 실결제인데 AI 풀이가 꺼져 있으면 유료 풀이는 팔지 않는다(돈 받고 예시 풀이가 나가는 사고 방지). 부적·구독은 그대로 판매
    // 사주 풀이는 Claude, 손금·관상은 Claude(사진), 2세는 Gemini 키가 있어야 판매. 타로는 카드 풀이라 언제나 판매
    const aiReady = p.kind === 'reading' ? liveAI() : p.kind === 'photo' ? (p.id === 'baby' ? babyLive() : photoLive()) : true;
    if (kind === 'reading' && !aiReady) return rep.code(503).send({ error: '풀이 서비스를 준비하고 있어요. 조금만 기다려 주세요.', code: 'reading_off' });
    if (channel === 'google') {
      if (!playConfigured()) return rep.code(503).send({ error: 'Google Play 결제 준비 중이에요' });
      const [o] = await db.insert(S.orders).values(base).returning();
      return o; // 앱이 Google 결제를 마친 뒤 /billing/google/verify 로 확정
    }
    // 웹 — PayApp
    const env = payappEnv();
    if (PG() !== 'payapp' || !env) return rep.code(503).send({ error: '웹 결제 준비 중이에요. 잠시 후 다시 시도해 주세요.' });
    const phone = normalizePhone(b.phone ?? '');
    if (!phone) return rep.code(400).send({ error: '휴대폰 번호를 확인해 주세요 (예: 010-1234-5678)', code: 'phone' });
    if (kind === 'subscription') {
      // 이미 웹 월 자동결제 중이면 중복 결제 막기(연간으로 바꾸려면 먼저 해지)
      const [auto] = await db.select({ id: S.subscriptions.id }).from(S.subscriptions)
        .where(and(eq(S.subscriptions.userId, userId), eq(S.subscriptions.channel, 'pg'), eq(S.subscriptions.autoRenew, true), gt(S.subscriptions.expiresAt, new Date())));
      if (auto) return rep.code(409).send({ error: '이미 월 자동결제로 이용 중이에요. 바꾸시려면 운세함 › 구독에서 자동결제를 해지한 뒤 다시 선택해 주세요.', code: 'sub_active' });
      // 이용권 기간이 남아 있으면 월 자동결제는 기간이 끝난 뒤에(겹쳐서 두 번 내지 않게). 연간 이용권 연장은 언제든 가능
      if (!p.id.includes('yearly')) {
        const [pass] = await db.select({ until: S.subscriptions.expiresAt }).from(S.subscriptions)
          .where(and(eq(S.subscriptions.userId, userId), inArray(S.subscriptions.status, ['active', 'grace']), gt(S.subscriptions.expiresAt, new Date())));
        if (pass) return rep.code(409).send({ error: `프리미엄 이용 기간이 ${pass.until.toISOString().slice(0, 10)}까지 남아 있어요. 기간이 끝난 뒤 월 자동결제를 시작하시거나, 지금은 연간 이용권으로 연장해 주세요.`, code: 'pass_active' });
      }
    }
    if (kind === 'subscription' && !p.id.includes('yearly')) {
      // 월 구독 = PayApp 정기결제(매월 같은 날 자동 승인). 연간은 PayApp 에 연 단위 정기결제가 없어 1년 이용권으로 판매
      const [o] = await db.insert(S.orders).values({ ...base, method: 'card' }).returning();
      try {
        const r = await payappRebillRegist({
          orderId: o.id, amount, goodName: `나만의 운세 ${p.title}`, phone,
          returnUrl: payReturnUrl(o.id), feedbackUrl: `${API()}/pay/payapp/feedback`, failUrl: `${API()}/pay/payapp/rebill-fail`,
        }, env, http);
        await db.update(S.orders).set({ providerRef: `R${r.rebillNo}` }).where(eq(S.orders.id, o.id)); // 1회차 승인 통보가 오면 결제번호(mul_no)로 바뀜
        return { ...o, providerRef: `R${r.rebillNo}`, payUrl: r.payUrl, autoRenew: true };
      } catch (e: any) {
        await db.update(S.orders).set({ status: 'failed' }).where(eq(S.orders.id, o.id));
        return rep.code(e.status ?? 502).send({ error: e.message });
      }
    }
    const [o] = await db.insert(S.orders).values(base).returning();
    try {
      const r = await payappRequest({
        orderId: o.id, amount, goodName: `나만의 운세 ${p.title}`, phone,
        returnUrl: payReturnUrl(o.id), feedbackUrl: `${API()}/pay/payapp/feedback`,
        openpaytype: b.inApp ? 'kakaopay' : ['kakaopay', 'naverpay'].includes(b.method ?? '') ? b.method : undefined, // 카카오톡·인스타 안 브라우저는 카드창이 막혀서 카카오페이로
      }, env, http);
      await db.update(S.orders).set({ providerRef: r.mulNo }).where(eq(S.orders.id, o.id));
      return { ...o, providerRef: r.mulNo, payUrl: r.payUrl };
    } catch (e: any) {
      await db.update(S.orders).set({ status: 'failed' }).where(eq(S.orders.id, o.id));
      return rep.code(e.status ?? 502).send({ error: e.message });
    }
  });
  // 결제 후 돌아온 화면이 상태를 묻는다(통보가 늦을 수 있어 몇 초간 반복 조회)
  app.get('/orders/:oid', async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const [o] = await db.select().from(S.orders).where(and(eq(S.orders.id, (req.params as any).oid), eq(S.orders.userId, userId)));
    return o ?? rep.code(404).send({ error: '주문이 없어요' });
  });
  // PayApp 결제 통보 — 아이디·연동키·연동값 검증 → 금액 대조 → 확정/취소. 응답은 반드시 SUCCESS(재전송 멈춤)
  /* 결제창에서 돌아오는 주소 — 2026-10-29 대표님 실결제 제보: 결제는 됐는데 풀이·부적이 안 열리고 결제창에 "잘못된 경로" 경고.
     PayApp(헥토 결제창)은 returnurl 로 POST 로 돌아오는데, 웹(www)은 정적 파일 서버라 POST 에 405 를 돌려줘서
     결제 확인 화면(/pay/return)이 아예 열리지 않았다. → 서버가 GET·POST 를 모두 받아 웹 확인 화면으로 303(GET) 넘겨 준다. */
  app.route({ method: ['GET', 'POST'], url: '/pay/payapp/return', handler: async (req, rep) => {
    const q = req.query as { order?: string };
    const order = /^[A-Za-z0-9_-]{1,64}$/.test(q.order ?? '') ? q.order! : '';
    return rep.redirect(order ? `${WEB()}/pay/return?order=${order}` : `${WEB()}/box`, 303);
  } });
  app.post('/pay/payapp/feedback', { logLevel: 'warn' }, async (req, rep) => {
    const env = payappEnv();
    const f = env ? parsePayappFeedback((req.body ?? {}) as Record<string, unknown>, env, (m) => req.log.warn(m)) : null;
    if (!f) return rep.code(400).type('text/plain').send('FAIL');
    if (f.rebillNo) { await rebillFeedback(f, req.log); return rep.type('text/plain').send('SUCCESS'); }
    const [o] = await db.select().from(S.orders).where(eq(S.orders.id, f.orderId));
    if (!o || o.channel !== 'pg') return rep.type('text/plain').send('SUCCESS'); // 모르는 주문은 기록만 하고 재전송은 멈춘다
    if (f.state === 'partial') { // 부분 환불 — 이용은 그대로, 기록만
      req.log.warn(`[payapp] 부분 환불 order=${o.id} 금액=${f.amount}`);
      await db.update(S.orders).set({ refundStatus: 'partial' }).where(eq(S.orders.id, o.id));
      return rep.type('text/plain').send('SUCCESS');
    }
    if (f.state === 'paid') {
      // 24시간 미결제 정리로 취소된 주문에 늦게 결제 완료가 오면(가상계좌 등) 돈은 받았으니 지급한다
      if (o.status === 'cancelled' && !o.paidAt && f.amount === o.amount) {
        req.log.warn(`[payapp] 정리된 주문에 늦은 결제 완료 → 지급 order=${o.id}`);
        const [back] = await db.update(S.orders).set({ status: 'pending' }).where(and(eq(S.orders.id, o.id), eq(S.orders.status, 'cancelled'))).returning();
        if (back) await fulfillOrder(db, back, { ref: f.mulNo, method: f.method });
        return rep.type('text/plain').send('SUCCESS');
      }
      if (o.status !== 'pending') return rep.type('text/plain').send('SUCCESS'); // 이미 확정·취소된 주문에 온 재전송 — 상태를 건드리지 않음
      if (f.amount !== o.amount) { // 금액 위변조 — 확정하지 않음
        req.log.error(`[payapp] 금액 불일치 order=${o.id} 주문=${o.amount} 통보=${f.amount}`);
        await db.update(S.orders).set({ status: 'failed' }).where(eq(S.orders.id, o.id));
        return rep.type('text/plain').send('SUCCESS');
      }
      await fulfillOrder(db, o, { ref: f.mulNo, method: f.method });
    } else if (f.state === 'refunded' || f.state === 'cancelled') {
      await revokeOrder(db, o, o.status === 'paid' ? 'refunded' : 'cancelled');
    }
    return rep.type('text/plain').send('SUCCESS');
  });
  /* 웹 월 자동결제(PayApp 정기결제) 통보
     - 1회차: var1 = 처음 만든 주문 → 그 주문을 확정하고 구독에 rebill_no 를 붙인다
     - 2회차부터: 같은 rebill_no 로 새 결제번호(mul_no)가 온다 → 갱신 주문을 새로 만들어 확정(이용 기간 = 다음 결제일 + 2일)
     - 취소·환불: 해당 결제번호의 주문만 되돌린다 */
  type Feedback = NonNullable<ReturnType<typeof parsePayappFeedback>>;
  const rebillUntil = () => new Date(nextRebillDate(new Date(), rebillDay()).getTime() + 2 * 86_400_000);
  async function rebillFeedback(f: Feedback, log: { warn: (m: string) => void; error: (m: string) => void }) {
    // 처음 주문은 var1 로 찾고, 2회차 통보에 var1 이 비어 와도 rebill_no 로 구독을 찾아 이어 간다
    const [first] = f.orderId ? await db.select().from(S.orders).where(and(eq(S.orders.id, f.orderId), eq(S.orders.channel, 'pg'), eq(S.orders.kind, 'subscription'))) : [];
    const [sub] = await db.select().from(S.subscriptions).where(and(eq(S.subscriptions.rebillNo, f.rebillNo), eq(S.subscriptions.channel, 'pg'))).orderBy(desc(S.subscriptions.expiresAt)).limit(1);
    const userId = first?.userId ?? sub?.userId;
    if (!userId) { log.warn(`[payapp rebill] 모르는 정기결제 rebill=${f.rebillNo}`); return; }
    const [same] = f.mulNo ? await db.select().from(S.orders).where(and(eq(S.orders.providerRef, f.mulNo), eq(S.orders.userId, userId))) : [];
    if (f.state === 'partial') { if (same) await db.update(S.orders).set({ refundStatus: 'partial' }).where(eq(S.orders.id, same.id)); return; }
    if (f.state === 'refunded' || f.state === 'cancelled') {
      const target = same ?? (first?.status === 'pending' ? first : null);
      if (target) await revokeOrder(db, target, target.status === 'paid' ? 'refunded' : 'cancelled');
      // PayApp 판매자 사이트에서 환불해도 다음 달 자동결제는 계속 나간다 → 함께 해지(손님 화면엔 '해지할 자동결제가 없어요'로 막혀 있었음)
      if (target?.status === 'paid') {
        const env = payappEnv();
        try { if (env) await payappRebillCancel(f.rebillNo, env, http); } catch (e: any) { log.error(`[payapp rebill] 환불 후 자동결제 해지 실패 rebill=${f.rebillNo} ${e.message} — PayApp 판매자 사이트에서 직접 해지 필요`); }
        await db.update(S.subscriptions).set({ autoRenew: false, canceledAt: new Date() }).where(eq(S.subscriptions.rebillNo, f.rebillNo));
      }
      return;
    }
    if (f.state === 'failed') { log.warn(`[payapp rebill] 자동결제 실패 rebill=${f.rebillNo} user=${userId}`); await markRebillFailed(f.rebillNo); return; }
    if (f.state !== 'paid') return;
    const expected = first?.amount ?? sub!.amount;
    if (f.amount !== expected) { log.error(`[payapp rebill] 금액 불일치 rebill=${f.rebillNo} 주문=${expected} 통보=${f.amount}`); return; }
    if (same?.status === 'paid') return; // 같은 통보가 다시 옴
    const opts = { ref: f.mulNo, method: f.method, expiresAt: rebillUntil(), rebillNo: f.rebillNo, autoRenew: true };
    if (first?.status === 'pending') {
      // 같은 사람이 탭 두 개·두 번 눌러 월 자동결제를 두 개 등록한 경우: 먼저 것만 두고 새 것은 해지·환불(매달 두 번 빠지던 문제)
      const [dup] = await db.select().from(S.subscriptions).where(and(eq(S.subscriptions.userId, userId), eq(S.subscriptions.channel, 'pg'), eq(S.subscriptions.autoRenew, true), gt(S.subscriptions.expiresAt, new Date())));
      if (dup?.rebillNo && dup.rebillNo !== f.rebillNo) {
        const env = payappEnv();
        log.error(`[payapp rebill] 중복 월 자동결제 → 새 것 해지·환불 user=${userId} 기존=${dup.rebillNo} 새=${f.rebillNo}`);
        try { if (env) { await payappRebillCancel(f.rebillNo, env, http); if (f.mulNo) await payappCancel(f.mulNo, '중복 자동결제 자동 환불', env, http); } }
        catch (e: any) { log.error(`[payapp rebill] 중복 해지·환불 실패 rebill=${f.rebillNo} ${e.message} — PayApp 판매자 사이트에서 직접 처리 필요`); }
        await db.update(S.orders).set({ status: 'refunded', refundStatus: 'done', providerRef: f.mulNo ?? first.providerRef, paidAt: new Date() }).where(eq(S.orders.id, first.id));
        return;
      }
      await fulfillOrder(db, first, opts); return;
    }
    // 다음 달 자동 승인 → 갱신 주문
    const [renew] = await db.insert(S.orders).values({ id: newId('O'), userId, productId: first?.productId ?? (brand as any).subscription?.monthly?.id ?? 'premium_monthly', kind: 'subscription', amount: f.amount, discount: 0, method: 'card', channel: 'pg', status: 'pending', providerRef: f.mulNo }).returning();
    await fulfillOrder(db, renew, opts);
  }
  // 2회차 이후 자동 승인이 실패하면 PayApp 이 failurl 로 알려준다(pay_state=99). 기간이 끝나면 자연히 일반 회원으로 돌아간다.
  app.post('/pay/payapp/rebill-fail', { logLevel: 'warn' }, async (req, rep) => {
    const env = payappEnv();
    const f = env ? parsePayappFeedback((req.body ?? {}) as Record<string, unknown>, env, (m) => req.log.warn(m)) : null;
    if (!f) return rep.code(400).type('text/plain').send('FAIL');
    req.log.warn(`[payapp rebill] 자동결제 승인 실패 rebill=${f.rebillNo} order=${f.orderId}`);
    await markRebillFailed(f.rebillNo);
    return rep.type('text/plain').send('SUCCESS');
  });
  // 자동결제 승인 실패: 구독을 '유예(grace)'로 표시(이미 낸 기간까지는 그대로 이용, 관리자 구독 화면에 보임). PayApp 이 다시 승인하면 갱신 통보로 active 로 돌아온다
  async function markRebillFailed(rebillNo?: string) {
    if (!rebillNo) return;
    await db.update(S.subscriptions).set({ status: 'grace' }).where(and(eq(S.subscriptions.rebillNo, rebillNo), eq(S.subscriptions.status, 'active')));
  }
  // 자동결제 해지(웹) — PayApp 정기결제를 해지하고, 이미 낸 기간까지는 그대로 이용
  async function stopRebills(userIds: string[], why: string) {
    const env = payappEnv();
    const subs = await db.select().from(S.subscriptions).where(and(inArray(S.subscriptions.userId, userIds), eq(S.subscriptions.channel, 'pg'), eq(S.subscriptions.autoRenew, true)));
    for (const s of subs) {
      if (s.rebillNo) {
        if (!env) throw Object.assign(new Error('PayApp 연결 정보가 없어요'), { status: 503 });
        await payappRebillCancel(s.rebillNo, env, http);
      }
      await db.update(S.subscriptions).set({ autoRenew: false, canceledAt: new Date() }).where(eq(S.subscriptions.id, s.id));
      app.log.info(`[payapp rebill] 해지 sub=${s.id} (${why})`);
    }
    return subs.length;
  }
  app.post('/me/subscription/cancel', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const [g] = await db.select({ id: S.subscriptions.id }).from(S.subscriptions)
      .where(and(eq(S.subscriptions.userId, userId), eq(S.subscriptions.channel, 'google'), eq(S.subscriptions.autoRenew, true), gt(S.subscriptions.expiresAt, new Date())));
    try {
      const n = await stopRebills([userId], '사용자 해지');
      if (!n && g) return rep.code(409).send({ error: '앱에서 결제한 구독은 Google Play › 결제 및 구독에서 해지해 주세요.', code: 'google' });
      if (!n) return rep.code(404).send({ error: '해지할 자동결제가 없어요' });
    } catch (e: any) { return rep.code(e.status ?? 502).send({ error: e.message }); }
    const [s] = await db.select().from(S.subscriptions).where(eq(S.subscriptions.userId, userId)).orderBy(desc(S.subscriptions.expiresAt));
    return { ok: true, subscription: s ?? null };
  });
  // Google Play — 앱이 받은 purchaseToken 을 서버에서 Google 에 다시 확인
  app.post('/billing/google/verify', async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const b = (req.body ?? {}) as { orderId?: string; productId?: string; purchaseToken?: string; profileId?: string };
    if (!b.purchaseToken || !b.productId) return rep.code(400).send({ error: '구매 정보가 없어요' });
    if (!playConfigured()) return rep.code(503).send({ error: 'Google Play 결제 준비 중이에요' });
    const [dup] = await db.select().from(S.orders).where(and(eq(S.orders.providerRef, b.purchaseToken), eq(S.orders.status, 'paid')));
    if (dup) return dup.userId === userId ? dup : rep.code(409).send({ error: '이미 다른 계정에서 사용된 구매예요' });
    const [o] = b.orderId ? await db.select().from(S.orders).where(and(eq(S.orders.id, b.orderId), eq(S.orders.userId, userId))) : [];
    // "<id>_m" = 프리미엄 회원가로 따로 등록한 Play 상품(같은 상품, 가격만 회원가)
    const playId = String(b.productId);
    const member = playId.endsWith('_m');
    const [p] = await db.select().from(S.products).where(eq(S.products.id, member ? playId.slice(0, -2) : playId));
    if (!p || (member && p.kind === 'subscription')) return rep.code(404).send({ error: '없는 상품이에요' });
    // 싼 상품 구매로 비싼 주문을 여는 것 막기 — 주문과 Play 상품이 같아야 함
    if (o && (o.productId !== p.id || o.channel !== 'google' || o.status !== 'pending')) return rep.code(409).send({ error: '주문과 구매 상품이 달라요' });
    if (member && !(await isPremium(userId))) return rep.code(402).send({ error: '프리미엄 회원가는 회원만 구매할 수 있어요' });
    const amount = member ? p.memberPrice ?? memberPrice(p.price) : p.price;
    const order = o ?? (await db.insert(S.orders).values({ id: newId('O'), userId, profileId: b.profileId ?? null, productId: p.id, kind: p.kind === 'talisman' ? 'talisman' : p.kind === 'subscription' ? 'subscription' : 'reading', amount, discount: p.price - amount, channel: 'google', method: 'google', status: 'pending' }).returning())[0];
    try {
      if (p.kind === 'subscription') {
        const s = await verifySubscription(b.purchaseToken, http);
        if (!subscriptionUsable(s.status, s.expiresAt)) return rep.code(402).send({ error: '구독이 활성 상태가 아니에요' });
        if (s.productId && s.productId !== playId) return rep.code(402).send({ error: '구매한 구독 상품과 달라요' }); // 월 구독 토큰으로 연 구독 신고 못 하게
        return fulfillOrder(db, order, { ref: b.purchaseToken, expiresAt: s.expiresAt, subStatus: s.status });
      }
      const c = await verifyProduct(playId, b.purchaseToken, http);
      if (!c.ok) return rep.code(402).send({ error: c.reason });
      return fulfillOrder(db, order, { ref: b.purchaseToken });
    } catch (e: any) {
      return rep.code(e.status ?? 502).send({ error: e.message });
    }
  });
  // RTDN — 갱신·해지·환불 등 Google 이 알려주면 다시 조회해서 반영
  app.post('/billing/google/rtdn', async (req, rep) => {
    if (!(await verifyPubsubToken(req.headers.authorization))) return rep.code(401).send();
    const n = readRtdn(req.body);
    if (n.kind !== 'subscription' || !n.purchaseToken || !playConfigured()) return { ok: true };
    const [o] = await db.select().from(S.orders).where(eq(S.orders.providerRef, n.purchaseToken));
    if (!o) return { ok: true };
    const s = await verifySubscription(n.purchaseToken, http);
    await db.update(S.subscriptions).set({ status: s.status, expiresAt: s.expiresAt, renewedAt: new Date(), canceledAt: s.status === 'canceled' ? new Date() : null, autoRenew: s.status === 'active' || s.status === 'grace' })
      .where(and(eq(S.subscriptions.userId, o.userId), eq(S.subscriptions.channel, 'google')));
    if (n.type === 12) await revokeOrder(db, o, 'refunded'); // SUBSCRIPTION_REVOKED = 환불
    return { ok: true };
  });
  // 풀이 결과 — 화면이 3초마다 조회(queued → generating → done)
  app.get('/readings/:oid', async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const [o] = await db.select().from(S.orders).where(and(eq(S.orders.id, (req.params as any).oid), eq(S.orders.userId, userId)));
    if (!o || o.status !== 'paid') return rep.code(404).send({ error: '결제된 풀이가 없어요' });
    const [r] = await db.select().from(S.readings).where(eq(S.readings.orderId, o.id));
    if (!r) return rep.code(404).send({ error: '풀이를 찾지 못했어요' });
    const { tokensIn, tokensOut, costKrw, model, ...pub } = r; void tokensIn; void tokensOut; void costKrw; void model; // 원가는 관리자만
    return pub;
  });
  // 실패한 풀이 다시 쓰기 — 자동 재시도 3번이 끝난 뒤(키·잔액 문제를 고친 다음 등) 손님 화면의 [다시 시도] 버튼. 끝난 장은 이어서 씀
  app.post('/readings/:oid/retry', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const [o] = await db.select().from(S.orders).where(and(eq(S.orders.id, (req.params as any).oid), eq(S.orders.userId, userId)));
    if (!o || o.status !== 'paid') return rep.code(404).send({ error: '결제된 풀이가 없어요' });
    // 원가 상한을 넘은 건은 손님이 계속 눌러도 다시 쓰지 않는다(관리자 확인 후 환불·재생성) — 2026-10-29 1건 10달러 사고 재발 방지
    const [cur] = await db.select().from(S.readings).where(eq(S.readings.orderId, o.id));
    if (cur?.status === 'failed' && (cur.costKrw ?? 0) >= costCap()) return rep.code(409).send({ error: '풀이를 쓰는 데 문제가 있어 확인 중이에요. 고객센터로 문의해 주시면 바로 도와드릴게요.', code: 'cost_cap' });
    const [r] = await db.update(S.readings).set({ status: 'queued', attempts: 0 }).where(and(eq(S.readings.orderId, o.id), eq(S.readings.status, 'failed'))).returning();
    return { status: r ? 'queued' : 'unchanged' };
  });
  // 정통 감정서 A4 PDF — 화면에서 링크를 받아(10분짜리) 주소를 열면 내려받기. 같은 풀이는 메모리에 잠깐 보관해 다시 만들지 않음
  const pdfCache = new Map<string, Buffer>();
  app.post('/readings/:oid/pdf-link', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const [o] = await db.select().from(S.orders).where(and(eq(S.orders.id, (req.params as any).oid), eq(S.orders.userId, userId)));
    if (!o || o.status !== 'paid') return rep.code(404).send({ error: '결제된 풀이가 없어요' });
    const [r] = await db.select().from(S.readings).where(eq(S.readings.orderId, o.id));
    if (!r || r.status !== 'done' || (r.content as any)?.version !== 2) return rep.code(409).send({ error: '감정서가 완성된 뒤에 PDF 로 받을 수 있어요' });
    return { url: `${API()}/pdf?t=${await signPdf(o.id)}` }; // 경로 파라미터는 길이 제한(100자)이 있어 쿼리로
  });
  // 유료 타로 AI 풀이 — 처음 한 번 질문(선택지 A·B)과 함께 만들고 저장, 다시 열면 저장된 풀이. AI 가 꺼져 있으면 503(화면은 카드 기본 문장으로 대신)
  const tarotBusy = new Set<string>();
  app.post('/tarot/:oid/reading', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const [o] = await db.select().from(S.orders).where(and(eq(S.orders.id, (req.params as any).oid), eq(S.orders.userId, userId)));
    if (!o || o.status !== 'paid') return rep.code(404).send({ error: '결제된 타로가 없어요' });
    const [p] = await db.select().from(S.products).where(eq(S.products.id, o.productId));
    const positions = ((p?.meta as any)?.positions ?? []) as string[];
    if (!p || p.kind !== 'tarot' || !positions.length) return rep.code(404).send({ error: '타로 상품이 아니에요' });
    const [r] = await db.select().from(S.readings).where(eq(S.readings.orderId, o.id));
    const saved = (r?.content as any)?.ai;
    if (saved) return { ai: saved, input: (r!.content as any).input ?? {} };
    if (!liveAI()) return rep.code(503).send({ error: 'AI 풀이 준비 중', code: 'ai_off' });
    if (tarotBusy.has(o.id)) return rep.code(409).send({ error: '풀이를 쓰는 중이에요. 잠시 후 다시 열어 주세요' });
    const b = (req.body ?? {}) as TarotInput;
    const input: TarotInput = { question: String(b.question ?? '').slice(0, 200), a: String(b.a ?? '').slice(0, 60), b: String(b.b ?? '').slice(0, 60) };
    const [pf] = o.profileId ? await db.select().from(S.profiles).where(eq(S.profiles.id, o.profileId)) : [];
    tarotBusy.add(o.id);
    try {
      const g = await generateTarot({ id: p.id, title: p.title, positions }, o.id, input, pf?.name ?? '');
      const content = { ...((r?.content as any) ?? {}), local: 'tarot', ai: g.ai, input };
      if (r) await db.update(S.readings).set({ status: 'done', content: content as any, model: process.env.ANTHROPIC_MODEL ?? null, tokensIn: g.tokensIn, tokensOut: g.tokensOut, costKrw: g.costKrw, doneAt: new Date() }).where(eq(S.readings.id, r.id));
      else await db.insert(S.readings).values({ id: newId('r_'), orderId: o.id, profileId: o.profileId, productId: o.productId, status: 'done', content: content as any, model: process.env.ANTHROPIC_MODEL ?? null, tokensIn: g.tokensIn, tokensOut: g.tokensOut, costKrw: g.costKrw, doneAt: new Date() });
      return { ai: g.ai, input };
    } catch (e) {
      req.log.warn({ err: (e as Error).message, order: o.id }, 'tarot ai failed');
      return rep.code(502).send({ error: '풀이를 만들지 못했어요. 잠시 후 다시 열어 주세요', code: 'ai_failed' });
    } finally { tarotBusy.delete(o.id); }
  });
  app.get('/pdf', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, rep) => {
    const oid = await verifyPdf(String((req.query as any).t ?? ''));
    if (!oid) return rep.code(410).type('text/plain; charset=utf-8').send('링크가 만료됐어요. 풀이 화면에서 PDF 저장을 다시 눌러 주세요.');
    const [o] = await db.select().from(S.orders).where(eq(S.orders.id, oid));
    const [r] = o ? await db.select().from(S.readings).where(eq(S.readings.orderId, o.id)) : [];
    const c = r?.content as any;
    if (!o || o.status !== 'paid' || !r || r.status !== 'done' || c?.version !== 2) return rep.code(404).type('text/plain; charset=utf-8').send('감정서를 찾을 수 없어요');
    const [p] = await db.select().from(S.products).where(eq(S.products.id, o.productId));
    const title = p?.title ?? o.productId;
    const key = `${r.id}:${r.doneAt?.getTime() ?? 0}`;
    let pdf = pdfCache.get(key);
    if (!pdf) {
      const resultTitle = (p as any)?.resultTitle || (c.character === 'wolha' ? '월하선녀가 풀어드린 나의 인연서' : '천궁도사가 풀어드린 나의 운명서');
      try { pdf = await renderPdf(readingHtml(c, { productTitle: title, resultTitle }), `${title} · ${c.people?.[0]?.name ?? ''} 님`); }
      catch (e: any) { req.log.error(`[pdf] ${e.message}`); return rep.code(503).type('text/plain; charset=utf-8').send('PDF 를 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'); }
      pdfCache.set(key, pdf);
      if (pdfCache.size > 8) pdfCache.delete(pdfCache.keys().next().value!);
    }
    const name = `나만의운세_${title}_${c.people?.[0]?.name ?? ''}.pdf`.replace(/[\\/:*?"<>|\s]+/g, '_');
    return rep.type('application/pdf').header('content-disposition', `attachment; filename="naman-unse.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`).header('cache-control', 'private, no-store').send(pdf);
  });
  app.get('/me/entitlements', async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const subs = await db.select().from(S.subscriptions).where(eq(S.subscriptions.userId, userId)).orderBy(desc(S.subscriptions.expiresAt));
    // 운세함 기준 목록 — 결제 완료이면서 손님이 지우지 않은 주문(환불·삭제된 건 빠짐). 모바일·웹 어디서 로그인해도 같은 목록
    const owned = await db.select({ productId: S.orders.productId, orderId: S.orders.id, profileId: S.orders.profileId, kind: S.orders.kind, amount: S.orders.amount, createdAt: S.orders.createdAt }).from(S.orders).where(and(eq(S.orders.userId, userId), eq(S.orders.status, 'paid'), isNull(S.orders.hiddenAt)));
    const ownedIds = new Set(owned.map((o) => o.orderId));
    const tal = (await db.select().from(S.talismans).where(eq(S.talismans.userId, userId)).orderBy(desc(S.talismans.issuedAt))).filter((t) => ownedIds.has(t.orderId));
    const talismans = tal.map((t) => ({ id: t.id, talismanId: t.talismanId, orderId: t.orderId, name: t.name, birth: t.birth, wish: t.wish, issuedAt: new Date(t.issuedAt).toISOString().slice(0, 10) }));
    return { premium: await isPremium(userId), subscription: subs[0] ?? null, owned, talismans };
  });

  // 완성한 부적을 계정에 보관(다른 기기·웹/모바일에서도 같은 부적함). 같은 주문은 한 장만
  app.post('/me/talismans', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const b = (req.body ?? {}) as { id?: string; talismanId?: string; orderId?: string; name?: string; birth?: string; wish?: string };
    const [o] = await db.select().from(S.orders).where(and(eq(S.orders.id, String(b.orderId ?? '')), eq(S.orders.userId, userId), eq(S.orders.status, 'paid')));
    if (!o || o.productId !== b.talismanId) return rep.code(404).send({ error: '결제된 부적이 없어요' });
    const [have] = await db.select().from(S.talismans).where(eq(S.talismans.orderId, o.id));
    if (have) return { id: have.id };
    const id = /^[\w-]{4,40}$/.test(b.id ?? '') ? b.id! : newId('tl_');
    await db.insert(S.talismans).values({ id, orderId: o.id, userId, talismanId: o.productId, name: String(b.name ?? '').slice(0, 40), birth: String(b.birth ?? '').slice(0, 60), wish: String(b.wish ?? '').slice(0, 80) }).onConflictDoNothing();
    return { id };
  });
  // 운세함에서 지우기 — 결제 기록(정산·환불용)은 남기고 손님 화면(서재·부적함·결제 내역)에서만 숨김. 모든 기기에 반영
  app.post('/me/orders/:oid/hide', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const [o] = await db.update(S.orders).set({ hiddenAt: new Date() }).where(and(eq(S.orders.id, (req.params as any).oid), eq(S.orders.userId, userId))).returning({ id: S.orders.id });
    if (!o) return rep.code(404).send({ error: '주문이 없어요' });
    return { ok: true };
  });

  /* ---------- 이벤트 추적 ---------- */
  app.post('/events', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const userId = await userOf(req);
    const list = ((req.body as any)?.events ?? []).slice(0, 50) as any[];
    if (!list.length) return { saved: 0 };
    // 화면이 보낸 값은 길이·시각을 제한(통계 조작·DB 부풀리기 막기). 시각은 지금 기준 하루 안쪽만 믿음
    const str = (v: unknown, n: number) => (v == null ? null : String(v).slice(0, n));
    const when = (v: unknown) => { const t = v ? Date.parse(String(v)) : NaN; return Number.isFinite(t) && Math.abs(Date.now() - t) < 86400_000 ? new Date(t) : new Date(); };
    const props = (v: unknown) => { if (v == null || typeof v !== 'object') return null; const j = JSON.stringify(v); return j.length <= 2000 ? v : null; };
    await db.insert(S.events).values(list.map((e) => ({
      userId, sessionId: str(e.sessionId, 64) || null, name: String(e.name ?? '').slice(0, 40), props: props(e.props) as any,
      utmSource: str(e.utm_source, 100), utmMedium: str(e.utm_medium, 100), utmCampaign: str(e.utm_campaign, 100), referrer: str(e.referrer, 300), platform: str(e.platform, 20),
      createdAt: when(e.at),
    })));
    return { saved: list.length };
  });

  /* ---------- 공유 링크 /s/:code ---------- */
  app.post('/share', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, rep) => {
    const b = (req.body ?? {}) as { contentId?: string; path?: string; title?: string; text?: string };
    const userId = await userOf(req);
    if (!userId) return rep.code(401).send({ error: '로그인(게스트 포함)이 필요해요' });
    if (!b.contentId || !b.path || !String(b.path).startsWith('/') || String(b.path).startsWith('//')) return rep.code(400).send({ error: '공유할 화면이 없어요' });
    const code = newId().slice(0, 10);
    await db.insert(S.shareLinks).values({ code, contentId: String(b.contentId).slice(0, 60), path: String(b.path).slice(0, 200), title: String(b.title ?? '').slice(0, 80), text: String(b.text ?? '').slice(0, 200), userId });
    return { code, url: `${API()}/s/${code}` };
  });
  app.get('/s/:code', async (req, rep) => {
    const [l] = await db.select().from(S.shareLinks).where(eq(S.shareLinks.code, (req.params as any).code));
    if (!l) return rep.redirect(WEB());
    await db.update(S.shareLinks).set({ clicks: sql`${S.shareLinks.clicks} + 1` }).where(eq(S.shareLinks.code, l.code));
    await db.insert(S.events).values({ name: 'share_link_open', props: { code: l.code, contentId: l.contentId } });
    const target = `${WEB()}${l.path}${l.path.includes('?') ? '&' : '?'}utm_source=share&utm_content=${encodeURIComponent(l.contentId)}`;
    const e = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    rep.type('text/html; charset=utf-8');
    // 3차 요청: 카톡 공유 카드를 누르면 앱이 있으면 앱으로, 없으면 Play 스토어 설치 화면으로(안드로이드).
    // Play 에 앱이 올라간 뒤 서버 변수 PLAY_STORE_LIVE=1 (+ APP_ID) 을 넣으면 켜진다. 그 전·아이폰·PC 는 지금처럼 웹으로.
    const appId = process.env.APP_ID || 'com.namanunse.app';
    const android = /Android/i.test(String(req.headers['user-agent'] ?? ''));
    if (process.env.PLAY_STORE_LIVE === '1' && android) {
      const play = `https://play.google.com/store/apps/details?id=${appId}&referrer=${encodeURIComponent(`utm_source=share&utm_content=${l.contentId}`)}`;
      const intent = `intent://open?path=${encodeURIComponent(l.path)}#Intent;scheme=namanunse;package=${appId};S.browser_fallback_url=${encodeURIComponent(play)};end`;
      return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(l.title)}</title>
<meta property="og:title" content="${e(l.title)}"><meta property="og:description" content="${e(l.text)}">
<meta property="og:image" content="${API()}/s/${l.code}/card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${API()}/s/${l.code}"><meta property="og:site_name" content="나만의 운세"><meta name="twitter:card" content="summary_large_image">
<style>body{margin:0;font-family:sans-serif;background:#F5EFE1;color:#1C1A17;display:grid;place-items:center;min-height:100vh;text-align:center}a{display:block;margin:10px auto;padding:14px 22px;border-radius:14px;font-weight:800;text-decoration:none;max-width:260px}.a{background:#1C1A17;color:#F2D98E}.b{color:#5A5249}</style></head>
<body><div><p>나만의 운세 앱으로 이동하고 있어요…</p><a class="a" href="${e(intent)}">앱에서 보기</a><a class="b" href="${e(target)}">웹에서 계속 보기</a></div>
<script>location.replace(${JSON.stringify(intent)});</script></body></html>`;
    }
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${e(l.title)}</title>
<meta property="og:title" content="${e(l.title)}"><meta property="og:description" content="${e(l.text)}">
<meta property="og:image" content="${API()}/s/${l.code}/card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${API()}/s/${l.code}"><meta property="og:site_name" content="나만의 운세"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${e(target)}"></head><body><a href="${e(target)}">나만의 운세에서 보기</a></body></html>`;
  });
  app.get('/s/:code/card.png', async (req, rep) => {
    const [l] = await db.select().from(S.shareLinks).where(eq(S.shareLinks.code, (req.params as any).code));
    if (!l) return rep.code(404).send();
    const size = (req.query as any).size === 'tall' ? 'tall' : 'wide';
    rep.type('image/png').header('cache-control', 'public, max-age=86400');
    return shareCard({ title: l.title, text: l.text, url: `${WEB()}${l.path}`, size });
  });
  app.get('/uploads/:file', async (req, rep) => {
    const f = join(UPLOADS, String((req.params as any).file).replace(/[^\w.-]/g, ''));
    if (!existsSync(f)) return rep.code(404).send();
    rep.type({ '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }[extname(f)] ?? 'application/octet-stream');
    return readFileSync(f);
  });

  /* ================= 관리자 API ================= */
  // 권한: super = 전부 / operator = 조회 + 배너·푸시·상품 문구(가격·광고·환불·관리자 계정은 super 만)
  type Req = FastifyRequest & { admin?: AdminClaims };
  const audit = (req: Req, action: string, target?: string, detail?: unknown) =>
    db.insert(S.auditLogs).values({ adminId: req.admin ? +req.admin.sub : null, action, target: target ?? null, detail: (detail ?? null) as any });
  const guard = (role: 'operator' | 'super' = 'operator') => async (req: Req, rep: FastifyReply) => {
    const c = await verify<AdminClaims>(bearer(req));
    if (c?.kind !== 'admin') return rep.code(401).send({ error: '관리자 로그인이 필요해요' });
    // 삭제된 계정·바뀐 권한은 토큰이 남아 있어도 바로 막는다(양도 때 이전 관리자 계정 삭제 즉시 효력)
    const [a] = await db.select({ role: S.admins.role }).from(S.admins).where(eq(S.admins.id, +c.sub));
    if (!a) return rep.code(401).send({ error: '관리자 로그인이 필요해요' });
    c.role = a.role as AdminClaims['role'];
    if (role === 'super' && c.role !== 'super') return rep.code(403).send({ error: '최고관리자만 할 수 있어요' });
    req.admin = c;
  };

  app.post('/admin/api/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, rep) => {
    const { email, password } = req.body as { email: string; password: string };
    const [a] = await db.select().from(S.admins).where(eq(S.admins.email, String(email).toLowerCase()));
    if (!a) return rep.code(401).send({ error: '이메일 또는 비밀번호가 맞지 않아요' });
    if (a.lockedUntil && a.lockedUntil > new Date()) return rep.code(401).send({ error: '이메일 또는 비밀번호가 맞지 않아요 (여러 번 틀리면 10분간 잠겨요)' });
    if (!(await bcrypt.compare(password, a.passwordHash))) {
      const failed = a.failedCount + 1;
      await db.update(S.admins).set({ failedCount: failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 600_000) : null }).where(eq(S.admins.id, a.id));
      return rep.code(401).send({ error: '이메일 또는 비밀번호가 맞지 않아요' });
    }
    await db.update(S.admins).set({ failedCount: 0, lockedUntil: null }).where(eq(S.admins.id, a.id));
    return { token: await signAdmin(a.id, a.role as AdminClaims['role'], a.email), role: a.role, email: a.email };
  });

  const A = '/admin/api';
  // 0 관리자 계정 — 내 비밀번호 변경, (최고관리자) 관리자 추가·삭제
  const pwOk = (p: unknown): p is string => typeof p === 'string' && p.length >= 10 && p.length <= 100;
  app.post(`${A}/me/password`, { preHandler: guard(), config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req: Req, rep) => {
    const { current, next } = (req.body ?? {}) as { current?: string; next?: string };
    if (!pwOk(next)) return rep.code(400).send({ error: '새 비밀번호는 10자 이상으로 정해 주세요' });
    if (next === current) return rep.code(400).send({ error: '지금과 다른 비밀번호로 정해 주세요' });
    const [a] = await db.select().from(S.admins).where(eq(S.admins.id, +req.admin!.sub));
    if (!a || !(await bcrypt.compare(String(current ?? ''), a.passwordHash))) return rep.code(400).send({ error: '지금 비밀번호가 맞지 않아요' });
    await db.update(S.admins).set({ passwordHash: await bcrypt.hash(next, 10) }).where(eq(S.admins.id, a.id));
    await audit(req, 'admin.password', a.email);
    return { ok: true };
  });
  app.get(`${A}/admins`, { preHandler: guard('super') }, async () =>
    db.select({ id: S.admins.id, email: S.admins.email, role: S.admins.role, createdAt: S.admins.createdAt }).from(S.admins).orderBy(asc(S.admins.id)));
  app.post(`${A}/admins`, { preHandler: guard('super') }, async (req: Req, rep) => {
    const { email, password, role } = (req.body ?? {}) as { email?: string; password?: string; role?: string };
    const mail = String(email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return rep.code(400).send({ error: '이메일 형식을 확인해 주세요' });
    if (!pwOk(password)) return rep.code(400).send({ error: '처음 비밀번호는 10자 이상으로 정해 주세요' });
    const [dup] = await db.select({ id: S.admins.id }).from(S.admins).where(eq(S.admins.email, mail));
    if (dup) return rep.code(409).send({ error: '이미 있는 관리자예요' });
    const r = role === 'operator' ? 'operator' : 'super';
    const [a] = await db.insert(S.admins).values({ email: mail, passwordHash: await bcrypt.hash(password, 10), role: r })
      .returning({ id: S.admins.id, email: S.admins.email, role: S.admins.role, createdAt: S.admins.createdAt });
    await audit(req, 'admin.create', mail, { role: r });
    return a;
  });
  app.delete(`${A}/admins/:id`, { preHandler: guard('super') }, async (req: Req, rep) => {
    const id = +(req.params as any).id;
    if (id === +req.admin!.sub) return rep.code(400).send({ error: '로그인한 내 계정은 지울 수 없어요' });
    const list = await db.select({ id: S.admins.id, email: S.admins.email, role: S.admins.role }).from(S.admins);
    const target = list.find((x) => x.id === id);
    if (!target) return rep.code(404).send({ error: '없는 관리자예요' });
    if (target.role === 'super' && list.filter((x) => x.role === 'super').length <= 1) return rep.code(400).send({ error: '최고관리자가 한 명은 남아 있어야 해요' });
    await db.delete(S.admins).where(eq(S.admins.id, id));
    await audit(req, 'admin.delete', target.email);
    return { ok: true };
  });
  // 1 대시보드
  app.get(`${A}/dashboard`, { preHandler: guard() }, async (req, rep) => {
    const q = req.query as any;
    const d = await dashboard(db, range(q.period ?? 'today', q.from, q.to));
    if (q.format === 'csv') { rep.type('text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="dashboard.csv"'); return toCsv(d.daily); }
    return d;
  });
  // 2 회원관리
  app.get(`${A}/members`, { preHandler: guard() }, async (req) => {
    const q = req.query as any;
    return members(db, { search: q.search, tier: q.tier, limit: Math.min(+q.limit || 50, 200), offset: +q.offset || 0 });
  });
  app.get(`${A}/members/:id`, { preHandler: guard() }, async (req, rep) => (await memberDetail(db, (req.params as any).id)) ?? rep.code(404).send());
  // 3 콘텐츠 상품관리
  app.get(`${A}/products`, { preHandler: guard() }, async () => db.select().from(S.products).orderBy(asc(S.products.kind), asc(S.products.group), asc(S.products.sort)));
  app.patch(`${A}/products/:id`, { preHandler: guard() }, async (req: Req, rep) => {
    const id = (req.params as any).id;
    const b = req.body as Record<string, any>;
    const allowed = ['title', 'cardCopy', 'detail', 'badge', 'visible', 'sort', 'imageUrl', 'category', 'showDiscount', 'buttonLabel', 'resultTitle', 'recommend', 'detailCopy',
      ...(req.admin!.role === 'super' ? ['price', 'memberPrice', 'listPrice', 'googleProductId'] : [])];
    if (Object.keys(b).some((k) => !allowed.includes(k))) return rep.code(403).send({ error: '가격 변경은 최고관리자만 할 수 있어요' });
    const [p] = await db.update(S.products).set({ ...b, updatedAt: new Date() }).where(eq(S.products.id, id)).returning();
    await audit(req, 'product.update', id, b);
    return p;
  });
  app.post(`${A}/products/reorder`, { preHandler: guard() }, async (req: Req) => {
    const { ids } = req.body as { ids: string[] };
    for (const [i, id] of ids.entries()) await db.update(S.products).set({ sort: i }).where(eq(S.products.id, id));
    await audit(req, 'product.reorder', null as any, { ids });
    return { ok: true };
  });
  // 이미지 업로드(데이터 URL) → /uploads/파일 — 기본은 서버 볼륨(.data/uploads, Railway 볼륨 연결)
  app.post(`${A}/upload`, { preHandler: guard() }, async (req: Req, rep) => {
    const { dataUrl } = req.body as { dataUrl: string };
    const m = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(dataUrl ?? '');
    if (!m) return rep.code(400).send({ error: 'PNG·JPG·WEBP 이미지만 올릴 수 있어요' });
    mkdirSync(UPLOADS, { recursive: true });
    const file = `${newId()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    writeFileSync(join(UPLOADS, file), Buffer.from(m[2], 'base64'));
    await audit(req, 'upload', file);
    return { url: `${API()}/uploads/${file}` };
  });
  // 4 배너·팝업
  app.get(`${A}/banners`, { preHandler: guard() }, async () => db.select().from(S.banners).orderBy(asc(S.banners.slot), asc(S.banners.sort)));
  app.post(`${A}/banners`, { preHandler: guard() }, async (req: Req) => {
    const b = req.body as any;
    const v = { id: b.id ?? newId('b_'), slot: b.slot ?? 'home', title: b.title, copy: b.copy ?? null, imageUrl: b.imageUrl ?? null, link: b.link ?? null, character: b.character ?? null,
      startsAt: b.startsAt ? new Date(b.startsAt) : null, endsAt: b.endsAt ? new Date(b.endsAt) : null, sort: +b.sort || 0, active: b.active !== false };
    const [r] = await db.insert(S.banners).values(v).onConflictDoUpdate({ target: S.banners.id, set: v }).returning();
    await audit(req, 'banner.save', v.id, v);
    return r;
  });
  app.delete(`${A}/banners/:id`, { preHandler: guard() }, async (req: Req) => {
    await db.delete(S.banners).where(eq(S.banners.id, (req.params as any).id));
    await audit(req, 'banner.delete', (req.params as any).id);
    return { ok: true };
  });
  // 5 결제·구독
  app.get(`${A}/payments`, { preHandler: guard() }, async (req, rep) => {
    const q = req.query as any;
    const list = await payments(db, { kind: q.kind, status: q.status, from: q.from, to: q.to, limit: Math.min(+q.limit || 100, 1000) });
    if (q.format === 'csv') { rep.type('text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="payments.csv"'); return toCsv(list); }
    return list;
  });
  app.get(`${A}/subscriptions/stats`, { preHandler: guard() }, async (req) => {
    const q = req.query as any;
    return subscriptionStats(db, range(q.period ?? 'month', q.from, q.to));
  });
  app.post(`${A}/payments/:id/refund`, { preHandler: guard('super') }, async (req: Req, rep) => {
    const id = (req.params as any).id;
    const [cur] = await db.select().from(S.orders).where(eq(S.orders.id, id));
    if (!cur) return rep.code(404).send({ error: '주문이 없어요' });
    if (cur.status !== 'paid') return rep.code(409).send({ error: '결제 완료된 주문만 환불할 수 있어요' });
    if (cur.channel === 'pg') { // PayApp 에서 먼저 취소가 돼야 환불 처리
      const env = payappEnv();
      if (!env || !cur.providerRef) return rep.code(503).send({ error: 'PayApp 연결 정보가 없어요' });
      try { await payappCancel(cur.providerRef, `관리자 환불 ${id}`, env, http); } catch (e: any) { return rep.code(502).send({ error: e.message }); }
    }
    let warning = '';
    // 웹 월 자동결제 주문을 환불하면 다음 달 자동결제도 함께 해지(환불했는데 또 결제되는 일 방지)
    if (cur.channel === 'pg' && cur.kind === 'subscription') {
      try { await stopRebills([cur.userId], `관리자 환불 ${id}`); } catch (e: any) { warning = `환불은 됐지만 자동결제 해지에 실패했어요. PayApp 판매자 사이트 › 정기결제에서 직접 해지해 주세요. (${e.message})`; }
    }
    // Google Play 주문은 Play Console 에서 환불하면 RTDN·환불 조회로 반영된다. 여기서는 권한만 회수.
    const o = await revokeOrder(db, cur, 'refunded');
    await audit(req, 'order.refund', id);
    return warning ? { ...o, warning } : o;
  });
  // 6 푸시 — 문구 → 딥링크 → 대상 → 즉시/예약. FCM 키가 있으면 실제 발송, 없으면 대상 수만 기록
  const DEEP_LINKS = ['/today', '/today?tab=week', '/unse', '/unse?cat=fate', '/unse?cat=love', '/tarot', '/talisman', '/box', '/premium', '/zodiac', '/fun/dream', '/fun/small', '/fun/oneline', ...(await db.select({ id: S.products.id }).from(S.products).where(inArray(S.products.kind, ['reading', 'tarot', 'photo']))).map((p) => `/product/${p.id}`)];
  app.get(`${A}/push/links`, { preHandler: guard() }, async () => DEEP_LINKS);
  app.get(`${A}/push`, { preHandler: guard() }, async () => db.select().from(S.pushCampaigns).orderBy(desc(S.pushCampaigns.createdAt)));
  const targetCount = async (target: string) => {
    const q = target === 'premium' ? sql`select count(distinct user_id)::int as n from subscriptions where status in ('active','grace') and expires_at > now()`
      : target === 'free' ? sql`select count(*)::int as n from users u where not exists(select 1 from subscriptions s where s.user_id = u.id and s.status in ('active','grace') and s.expires_at > now())`
      : target.startsWith('dormant') ? sql`select count(*)::int as n from users where last_seen_at < now() - (${+target.slice(7) || 7} || ' days')::interval`
      : sql`select count(*)::int as n from users where merged_into is null and deleted_at is null`;
    const r = (await db.execute(q)) as unknown;
    return ((Array.isArray(r) ? r : (r as { rows: unknown[] }).rows)[0] as { n: number }).n;
  };
  const targetTokens = async (target: string): Promise<string[]> => {
    const where = target === 'premium' ? sql`and exists(select 1 from subscriptions s where s.user_id = u.id and s.status in ('active','grace') and s.expires_at > now())`
      : target === 'free' ? sql`and not exists(select 1 from subscriptions s where s.user_id = u.id and s.status in ('active','grace') and s.expires_at > now())`
      : target.startsWith('dormant') ? sql`and u.last_seen_at < now() - (${+target.slice(7) || 7} || ' days')::interval` : sql``;
    const r = (await db.execute(sql`select u.push_token as t from users u where u.push_token is not null and u.push_consent = true and u.merged_into is null and u.deleted_at is null ${where}`)) as unknown;
    return ((Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as { t: string }[]).map((x) => x.t);
  };
  // FCM 키가 있으면 실제 발송(보낸 수), 없으면 대상 수만 기록
  const deliver = async (c: { title: string; body: string; deepLink: string; target: string }) => {
    if (!fcmConfigured()) return targetCount(c.target);
    const r = await sendPush(await targetTokens(c.target), { title: c.title, body: c.body, link: c.deepLink }, http);
    if (r.dead.length) await db.update(S.users).set({ pushToken: null }).where(inArray(S.users.pushToken, r.dead));
    return r.sent;
  };
  app.post(`${A}/push`, { preHandler: guard() }, async (req: Req, rep) => {
    const b = req.body as any;
    if (!b.title || !b.body || !DEEP_LINKS.includes(b.deepLink)) return rep.code(400).send({ error: '문구·연결 화면을 확인해 주세요' });
    const now = !b.scheduledAt;
    const [c] = await db.insert(S.pushCampaigns).values({ title: b.title, body: b.body, deepLink: b.deepLink, target: b.target ?? 'all',
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : new Date(), status: now ? 'sent' : 'scheduled', sentCount: now ? await deliver({ title: b.title, body: b.body, deepLink: b.deepLink, target: b.target ?? 'all' }) : 0, createdBy: req.admin!.email }).returning();
    await audit(req, now ? 'push.send' : 'push.schedule', String(c.id), b);
    return c;
  });
  // 7 광고 관리
  app.get(`${A}/ads`, { preHandler: guard() }, async () => db.select().from(S.adSettings));
  app.put(`${A}/ads/:slot`, { preHandler: guard('super') }, async (req: Req) => {
    const slot = (req.params as any).slot;
    const b = req.body as { enabled: boolean; config?: unknown };
    const [r] = await db.insert(S.adSettings).values({ slot, enabled: !!b.enabled, config: (b.config ?? null) as any })
      .onConflictDoUpdate({ target: S.adSettings.slot, set: { enabled: !!b.enabled, config: (b.config ?? null) as any } }).returning();
    await audit(req, 'ads.update', slot, b);
    return r;
  });
  // 8 통계
  app.get(`${A}/stats`, { preHandler: guard() }, async (req) => {
    const q = req.query as any;
    return contentStats(db, range(q.period ?? '7d', q.from, q.to));
  });
  app.get(`${A}/audit`, { preHandler: guard('super') }, async () => db.select().from(S.auditLogs).orderBy(desc(S.auditLogs.createdAt)).limit(200));

  // 예약 푸시 — 1분마다 도래한 캠페인을 발송 처리(FCM 연결 전 MOCK) + 매일 아침 자동 푸시(사용자 알림 시간)
  // 어떤 단계가 실패해도(DB 잠깐 끊김·FCM 오류) 서버가 죽지 않게 전부 감싼다
  let ticking = false;
  const timer = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      await runDailyPush(db, http).catch((e) => app.log.warn(`[daily push] ${(e as Error).message}`));
      await runExpiryReminders(db, http).catch((e) => app.log.warn(`[expiry remind] ${(e as Error).message}`));
      const due = await db.select().from(S.pushCampaigns).where(and(eq(S.pushCampaigns.status, 'scheduled'), lte(S.pushCampaigns.scheduledAt, new Date())));
      for (const c of due) {
        await db.update(S.pushCampaigns).set({ status: 'sending' }).where(eq(S.pushCampaigns.id, c.id)); // 두 번 보내지 않게 먼저 표시
        const sentCount = await deliver(c).catch((e) => { app.log.warn(`[push ${c.id}] ${(e as Error).message}`); return 0; });
        await db.update(S.pushCampaigns).set({ status: 'sent', sentCount }).where(eq(S.pushCampaigns.id, c.id));
      }
      // 결제창에서 그냥 나간 주문은 하루 지나면 '취소'로 정리(통계·목록 오염 방지). PayApp 통보는 분 단위로 오므로 하루면 충분
      await db.update(S.orders).set({ status: 'cancelled' }).where(and(eq(S.orders.status, 'pending'), eq(S.orders.channel, 'pg'), lt(S.orders.createdAt, new Date(Date.now() - 86_400_000))));
    } catch (e) { app.log.warn(`[timer] ${(e as Error).message}`); } finally { ticking = false; }
  }, 60_000);
  app.addHook('onClose', async () => clearInterval(timer));
  return { app, db };
}

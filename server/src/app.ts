// 나만의 운세 서버 — Fastify. 공개 API + 관리자 API(/admin/api). MOCK_MODE 면 결제·로그인·푸시를 가짜로 처리한다.
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import bcrypt from 'bcryptjs';
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';
import { openDb, schema as S, type Db } from './db/index.ts';
import { seedBase, seedDemo } from './services/seed.ts';
import { newId, signAdmin, signUser, verify, type AdminClaims, type UserClaims } from './services/auth.ts';
import { exchange, isConfigured, isProvider, startUrl, takeState } from './services/oauth.ts';
import { contentStats, dashboard, memberDetail, members, payments, range, subscriptionStats, toCsv } from './services/stats.ts';
import { shareCard } from './services/card.ts';
import photoSample from '../../packages/content/data/photo-sample.json' with { type: 'json' };

const MOCK = process.env.MOCK_MODE !== 'false';
const WEB = () => process.env.PUBLIC_WEB_ORIGIN || 'http://localhost:5391';
const API = () => process.env.API_ORIGIN || `http://localhost:${process.env.PORT || 8791}`;
const UPLOADS = fileURLToPath(new URL('../.data/uploads', import.meta.url));

export async function buildApp(opts: { db?: Db; demo?: boolean; logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 6 * 1024 * 1024 });
  const db = opts.db ?? (await openDb()).db;
  await seedBase(db);
  if (opts.demo) await seedDemo(db);
  const origins = [WEB(), 'capacitor://localhost', 'http://localhost', /^http:\/\/localhost:\d+$/];
  await app.register(cors, { origin: origins, credentials: true });
  await app.register(rateLimit, { global: false });

  /* ---------- 인증 도우미 ---------- */
  const bearer = (req: FastifyRequest) => (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const userOf = async (req: FastifyRequest) => {
    const c = await verify<UserClaims>(bearer(req));
    return c?.kind === 'user' ? c.sub : null;
  };
  const needUser = async (req: FastifyRequest, rep: FastifyReply) => {
    const id = await userOf(req);
    if (!id) { rep.code(401).send({ error: '로그인이 필요해요' }); return null; }
    await db.update(S.users).set({ lastSeenAt: new Date() }).where(eq(S.users.id, id));
    return id;
  };
  const isPremium = async (userId: string) =>
    !!(await db.select({ id: S.subscriptions.id }).from(S.subscriptions)
      .where(and(eq(S.subscriptions.userId, userId), inArray(S.subscriptions.status, ['active', 'grace']), gt(S.subscriptions.expiresAt, new Date()))).limit(1))[0];

  app.get('/health', async () => ({ ok: true, mock: MOCK }));

  /* ---------- 게스트·로그인 ---------- */
  app.post('/auth/guest', async (req) => {
    const { deviceId, platform } = (req.body ?? {}) as { deviceId?: string; platform?: string };
    const dev = deviceId || newId('d_');
    let [u] = await db.select().from(S.users).where(and(eq(S.users.deviceId, dev), isNull(S.users.provider)));
    if (!u) [u] = await db.insert(S.users).values({ id: newId('u_'), deviceId: dev, platform: platform ?? 'web' }).returning();
    return { token: await signUser(u.id), userId: u.id, deviceId: dev };
  });

  const finishLogin = async (rep: FastifyReply, provider: string, info: { providerId: string; name: string; email: string | null }, back: string) => {
    let [u] = await db.select().from(S.users).where(and(eq(S.users.provider, provider), eq(S.users.providerId, info.providerId)));
    if (!u) [u] = await db.insert(S.users).values({ id: newId('u_'), provider, providerId: info.providerId, name: info.name, email: info.email }).returning();
    const token = await signUser(u.id);
    const q = new URLSearchParams({ token, provider, name: u.name ?? info.name, uid: u.id, back });
    return rep.redirect(`${WEB()}/auth/callback?${q}`);
  };
  app.get('/auth/:provider/start', async (req, rep) => {
    const { provider } = req.params as { provider: string };
    const { redirect = WEB() } = req.query as { redirect?: string };
    if (!isProvider(provider)) return rep.code(404).send({ error: '지원하지 않는 로그인' });
    const back = (() => { try { const u = new URL(redirect); return u.pathname + u.search; } catch { return '/box'; } })();
    if (!isConfigured(provider)) {
      if (!MOCK) return rep.code(503).send({ error: `${provider} 로그인 키가 아직 없어요` });
      return finishLogin(rep, provider, { providerId: `mock-${provider}`, name: `${provider} 테스트 계정`, email: null }, back);
    }
    return rep.redirect(startUrl(provider, `${API()}/auth/${provider}/callback`, back));
  });
  app.get('/auth/:provider/callback', async (req, rep) => {
    const { provider } = req.params as { provider: string };
    const { code, state } = req.query as { code?: string; state?: string };
    const st = state ? takeState(state) : null;
    if (!isProvider(provider) || !code || !st) return rep.redirect(`${WEB()}/auth/callback?error=1`);
    const info = await exchange(provider, code, `${API()}/auth/${provider}/callback`, state!);
    return finishLogin(rep, provider, info, st.redirect);
  });
  // 게스트로 쓰던 사주·구매·부적·구독·이벤트를 로그인 계정으로 합치기
  app.post('/auth/merge', async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const { guestToken } = (req.body ?? {}) as { guestToken?: string };
    const g = guestToken ? await verify<UserClaims>(guestToken) : null;
    if (!g || g.sub === userId) return { merged: 0 };
    const guestId = g.sub;
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
  app.get('/profiles', async (req, rep) => {
    const id = await needUser(req, rep);
    if (!id) return;
    return db.select().from(S.profiles).where(eq(S.profiles.userId, id)).orderBy(asc(S.profiles.createdAt));
  });
  app.post('/profiles', async (req, rep) => {
    const id = await needUser(req, rep);
    if (!id) return;
    const b = req.body as any;
    const count = (await db.select({ id: S.profiles.id }).from(S.profiles).where(eq(S.profiles.userId, id))).length;
    const exists = b.id && (await db.select({ id: S.profiles.id }).from(S.profiles).where(and(eq(S.profiles.id, b.id), eq(S.profiles.userId, id))))[0];
    // 저장 가능한 사주: 일반 2개 / 프리미엄 무제한
    if (!exists && count >= 2 && !(await isPremium(id))) return rep.code(402).send({ error: '일반 회원은 사주를 2개까지 저장할 수 있어요', code: 'profile_limit' });
    const v = {
      id: b.id ?? newId('p_'), userId: id, name: String(b.name).slice(0, 20), relation: b.relation ?? null, gender: b.gender === 'M' ? 'M' : 'F',
      birthYear: +b.year, birthMonth: +b.month, birthDay: +b.day, calendar: b.calendar === 'lunar' ? 'lunar' : 'solar', leap: !!b.leap,
      birthHour: b.hour == null ? null : +b.hour, bloodType: b.bloodType ?? null, mbti: b.mbti ?? null, isMain: !!b.isMain,
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
  // 손금·관상 사진 — 메모리에서만 처리하고 저장·로그하지 않는다. 지금은 예시 결과(mock). AI 비전 호출은 비용 보고 후 연결(11 단계 파이프라인).
  app.post('/photo/analyze', { bodyLimit: 8 * 1024 * 1024, logLevel: 'silent', config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, rep) => {
    const { kind, image } = (req.body ?? {}) as { kind?: string; image?: string };
    if ((kind !== 'palm' && kind !== 'face') || typeof image !== 'string' || !/^data:image\/(png|jpe?g|webp|heic|svg\+xml);base64,/.test(image)) return rep.code(400).send({ error: '사진 형식을 확인해 주세요' });
    return photoSample[kind]; // image 변수는 여기서 버려진다(어디에도 쓰지 않음)
  });

  /* ---------- 주문(결제) ---------- */
  app.post('/orders', async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const b = req.body as { productId: string; profileId?: string; method?: string };
    const [p] = await db.select().from(S.products).where(eq(S.products.id, b.productId));
    if (!p || !p.visible) return rep.code(404).send({ error: '없는 상품이에요' });
    const premium = await isPremium(userId);
    const amount = p.kind !== 'subscription' && premium ? p.memberPrice ?? Math.round((p.price * 0.9) / 10) * 10 : p.price;
    if (!MOCK) return rep.code(501).send({ error: '실결제는 09 단계(Google Play·PG) 연결 후 열려요' });
    const [o] = await db.insert(S.orders).values({
      id: newId('O'), userId, profileId: b.profileId ?? null, productId: p.id, kind: p.kind === 'talisman' ? 'talisman' : p.kind === 'subscription' ? 'subscription' : 'reading',
      amount, discount: p.price - amount, method: b.method ?? 'card', channel: 'mock', status: 'paid', paidAt: new Date(),
    }).returning();
    if (p.kind === 'subscription') {
      const yearly = p.id.includes('yearly');
      await db.insert(S.subscriptions).values({ id: newId('s_'), userId, plan: yearly ? 'yearly' : 'monthly', status: 'active', channel: 'mock', amount, expiresAt: new Date(Date.now() + (yearly ? 365 : 30) * 86400000) });
    }
    if (o.kind === 'reading') await db.insert(S.readings).values({ id: newId('r_'), orderId: o.id, profileId: o.profileId, productId: p.id, status: 'queued' });
    return o;
  });
  app.get('/me/entitlements', async (req, rep) => {
    const userId = await needUser(req, rep);
    if (!userId) return;
    const subs = await db.select().from(S.subscriptions).where(eq(S.subscriptions.userId, userId)).orderBy(desc(S.subscriptions.expiresAt));
    const owned = await db.select({ productId: S.orders.productId, orderId: S.orders.id }).from(S.orders).where(and(eq(S.orders.userId, userId), eq(S.orders.status, 'paid')));
    return { premium: await isPremium(userId), subscription: subs[0] ?? null, owned };
  });

  /* ---------- 이벤트 추적 ---------- */
  app.post('/events', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const userId = await userOf(req);
    const list = ((req.body as any)?.events ?? []).slice(0, 50) as any[];
    if (!list.length) return { saved: 0 };
    await db.insert(S.events).values(list.map((e) => ({
      userId, sessionId: String(e.sessionId ?? '').slice(0, 64) || null, name: String(e.name).slice(0, 40), props: e.props ?? null,
      utmSource: e.utm_source ?? null, utmMedium: e.utm_medium ?? null, utmCampaign: e.utm_campaign ?? null, referrer: e.referrer ?? null, platform: e.platform ?? null,
      createdAt: e.at ? new Date(e.at) : new Date(),
    })));
    return { saved: list.length };
  });

  /* ---------- 공유 링크 /s/:code ---------- */
  app.post('/share', async (req) => {
    const b = req.body as { contentId: string; path: string; title: string; text: string };
    const code = newId().slice(0, 10);
    await db.insert(S.shareLinks).values({ code, contentId: b.contentId, path: b.path, title: String(b.title).slice(0, 80), text: String(b.text).slice(0, 200), userId: await userOf(req) });
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
    if (role === 'super' && c.role !== 'super') return rep.code(403).send({ error: '최고관리자만 할 수 있어요' });
    req.admin = c;
  };

  app.post('/admin/api/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, rep) => {
    const { email, password } = req.body as { email: string; password: string };
    const [a] = await db.select().from(S.admins).where(eq(S.admins.email, String(email).toLowerCase()));
    if (!a) return rep.code(401).send({ error: '이메일 또는 비밀번호가 맞지 않아요' });
    if (a.lockedUntil && a.lockedUntil > new Date()) return rep.code(423).send({ error: '5회 틀려서 10분간 잠겼어요' });
    if (!(await bcrypt.compare(password, a.passwordHash))) {
      const failed = a.failedCount + 1;
      await db.update(S.admins).set({ failedCount: failed, lockedUntil: failed >= 5 ? new Date(Date.now() + 600_000) : null }).where(eq(S.admins.id, a.id));
      return rep.code(401).send({ error: '이메일 또는 비밀번호가 맞지 않아요' });
    }
    await db.update(S.admins).set({ failedCount: 0, lockedUntil: null }).where(eq(S.admins.id, a.id));
    return { token: await signAdmin(a.id, a.role as AdminClaims['role'], a.email), role: a.role, email: a.email };
  });

  const A = '/admin/api';
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
  app.post(`${A}/payments/:id/refund`, { preHandler: guard('super') }, async (req: Req) => {
    const id = (req.params as any).id;
    const [o] = await db.update(S.orders).set({ status: 'refunded', refundStatus: 'done' }).where(eq(S.orders.id, id)).returning();
    await audit(req, 'order.refund', id);
    return o;
  });
  // 6 푸시 — 문구 → 딥링크 → 대상 → 즉시/예약. FCM 연결(10 단계) 전에는 발송 대상 수만 기록(MOCK)
  const DEEP_LINKS = ['/today', '/today?tab=week', '/unse', '/unse?cat=fate', '/unse?cat=love', '/tarot', '/talisman', '/box', '/premium', '/zodiac', '/fun/dream', '/fun/small', '/fun/oneline', ...(await db.select({ id: S.products.id }).from(S.products).where(inArray(S.products.kind, ['reading', 'tarot', 'photo']))).map((p) => `/product/${p.id}`)];
  app.get(`${A}/push/links`, { preHandler: guard() }, async () => DEEP_LINKS);
  app.get(`${A}/push`, { preHandler: guard() }, async () => db.select().from(S.pushCampaigns).orderBy(desc(S.pushCampaigns.createdAt)));
  const targetCount = async (target: string) => {
    const q = target === 'premium' ? sql`select count(distinct user_id)::int as n from subscriptions where status in ('active','grace') and expires_at > now()`
      : target === 'free' ? sql`select count(*)::int as n from users u where not exists(select 1 from subscriptions s where s.user_id = u.id and s.status in ('active','grace') and s.expires_at > now())`
      : target.startsWith('dormant') ? sql`select count(*)::int as n from users where last_seen_at < now() - (${+target.slice(7) || 7} || ' days')::interval`
      : sql`select count(*)::int as n from users where merged_into is null and deleted_at is null`;
    return ((await db.execute(q)).rows[0] as { n: number }).n;
  };
  app.post(`${A}/push`, { preHandler: guard() }, async (req: Req, rep) => {
    const b = req.body as any;
    if (!b.title || !b.body || !DEEP_LINKS.includes(b.deepLink)) return rep.code(400).send({ error: '문구·연결 화면을 확인해 주세요' });
    const now = !b.scheduledAt;
    const [c] = await db.insert(S.pushCampaigns).values({ title: b.title, body: b.body, deepLink: b.deepLink, target: b.target ?? 'all',
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : new Date(), status: now ? 'sent' : 'scheduled', sentCount: now ? await targetCount(b.target ?? 'all') : 0, createdBy: req.admin!.email }).returning();
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

  // 예약 푸시 — 1분마다 도래한 캠페인을 발송 처리(FCM 연결 전 MOCK)
  const timer = setInterval(async () => {
    const due = await db.select().from(S.pushCampaigns).where(and(eq(S.pushCampaigns.status, 'scheduled'), lte(S.pushCampaigns.scheduledAt, new Date())));
    for (const c of due) await db.update(S.pushCampaigns).set({ status: 'sent', sentCount: await targetCount(c.target) }).where(eq(S.pushCampaigns.id, c.id));
  }, 60_000);
  app.addHook('onClose', async () => clearInterval(timer));
  return { app, db };
}

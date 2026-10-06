// 초기 데이터 — 상품·배너·광고 설정은 brand.config.json(=docs/상품카탈로그_v2.json)에서. 이미 있으면 건드리지 않는다(관리자 수정 보존).
// demo=true 면 관리자 화면 확인용 가짜 회원·주문·이벤트 30일치를 만든다(개발 전용, 운영 DB 에 쓰지 말 것).
import { and, eq, isNull, sql } from 'drizzle-orm';
import detailDb from '../../../packages/content/data/product-detail.json' with { type: 'json' };
import talismanMap from '../../../packages/content/data/talisman-map.json' with { type: 'json' };
import bcrypt from 'bcryptjs';
import brand from '../../../brand.config.json' with { type: 'json' };
import type { Db } from '../db/index.ts';
import { schema } from '../db/index.ts';
import { newId } from './auth.ts';

const S = schema;
// v3: 상품마다 탭·분류·버튼 문구·결과 제목·추천 부적·상세 문구
const recommendOf = (id: string) => (talismanMap.rules.find((r) => r.products.includes(id))?.talismans ?? ['t_luck']).slice(0, 2);
const TAB: Record<string, string> = { reading: 'unse', photo: 'unse', tarot: 'tarot', talisman: 'talisman' };
function v3Fields(p: any) {
  const talismanBtn = () => {
    let base = p.title.replace(/\s*부적$/, '').replace(/·/g, '');
    if (base.length > 2 && base.endsWith('운')) base = base.slice(0, -1);
    return brand.buttons.talisman.replace('{name}', `${base}부적`).replace('{price}', `${p.price.toLocaleString('ko-KR')}원`);
  };
  const button = p.kind === 'talisman' ? talismanBtn() : p.kind === 'tarot' ? brand.buttons.tarot : p.kind === 'photo' ? brand.buttons.photo : (brand.buttons as any)[p.character][0];
  const result = p.kind === 'tarot' ? brand.resultTitles.tarot : p.kind === 'photo' ? brand.resultTitles.photo.replace('{name}', p.title.replace(' 풀이', '')) : p.kind === 'talisman' ? null : (brand.resultTitles as any)[p.character];
  return {
    tab: TAB[p.kind], category: p.kind === 'reading' ? (p.character === 'cheongung' ? 'fate' : 'love') : p.kind,
    listPrice: p.listPrice ?? null, showDiscount: true, buttonLabel: button, resultTitle: result,
    recommend: p.kind === 'talisman' ? null : recommendOf(p.id), detailCopy: (detailDb as any)[p.id] ?? null,
  };
}
export async function seedBase(db: Db) {
  const rows = [
    ...brand.fate.map((p) => ({ ...p, kind: 'reading' })),
    ...brand.love.map((p) => ({ ...p, kind: 'reading' })),
    ...brand.talisman.map((p) => ({ ...p, kind: 'talisman' })),
    ...brand.tarot.map((p) => ({ ...p, kind: 'tarot' })),
    ...brand.photo.map((p) => ({ ...p, kind: 'photo' })),
  ].map((p: any) => ({
    id: p.id, kind: p.kind, character: p.character, group: p.group, title: p.title, cardCopy: p.cardCopy, detail: p.detail ?? null,
    price: p.price, memberPrice: p.memberPrice ?? null, thumbHanja: p.thumbHanja ?? null, badge: p.badge ?? null, visible: p.visible !== false,
    sort: p.sort ?? 0, googleProductId: p.googleProductId || null,
    meta: p.hanjaPhrase ? { hanjaPhrase: p.hanjaPhrase } : p.kind === 'tarot' ? { cards: p.cards, positions: p.positions } : null,
    ...v3Fields(p),
  }));
  rows.push(
    { id: brand.subscription.monthly.id, kind: 'subscription', character: null, group: '프리미엄', title: '프리미엄 월간', cardCopy: null, detail: null, price: brand.subscription.monthly.price, memberPrice: null, thumbHanja: null, badge: null, visible: true, sort: 0, googleProductId: null, meta: null } as any,
    { id: brand.subscription.yearly.id, kind: 'subscription', character: null, group: '프리미엄', title: '프리미엄 연간', cardCopy: null, detail: null, price: brand.subscription.yearly.price, memberPrice: null, thumbHanja: null, badge: null, visible: true, sort: 1, googleProductId: null, meta: null } as any,
    ...brand.fun.map((f, i) => ({ id: `fun_${f.id}`, kind: 'fun', tab: 'unse', category: 'fun', character: 'wolha', group: '재미로 보는 운세', title: f.title, cardCopy: f.copy, detail: null, price: 0, memberPrice: null, thumbHanja: f.hanja, badge: null, visible: true, sort: i, googleProductId: null, meta: { link: f.link } }) as any),
    { id: 'today', kind: 'today', character: 'cheongung', group: '오늘의 운세', title: '오늘의 운세', cardCopy: '오늘 / 이번 주 / 이번 달', detail: null, price: 0, memberPrice: null, thumbHanja: '今', badge: null, visible: true, sort: 0, googleProductId: null, meta: null } as any,
  );
  await db.insert(S.products).values(rows).onConflictDoNothing();
  // v3 이전에 만든 DB: 새 칸이 비어 있는 상품만 채운다(관리자가 고친 값은 보존)
  for (const r of rows) if (r.tab) await db.update(S.products).set({ tab: r.tab, category: r.category, buttonLabel: r.buttonLabel, resultTitle: r.resultTitle, recommend: r.recommend, detailCopy: r.detailCopy }).where(and(eq(S.products.id, r.id), isNull(S.products.tab)));
  await db.insert(S.categories).values(brand.categories.filter((c) => c.id !== 'all').map((c: any, i) => ({ id: c.id, tab: 'unse', label: c.label, sub: c.sub ?? null, character: c.character ?? null, groups: c.groups ?? null, sort: i })))
    .onConflictDoNothing();
  await db.insert(S.categories).values(brand.groups.tarot.map((g, i) => ({ id: `tarot_${i}`, tab: 'tarot', label: g, sort: i }))).onConflictDoNothing();
  await db.insert(S.banners).values(brand.banners.map((b, i) => ({ id: b.id, slot: 'home', title: b.title, copy: b.copy, link: b.link, character: b.character, sort: i, active: true }))).onConflictDoNothing();
  await db.insert(S.banners).values({ id: 'exit_default', slot: 'exit_popup', title: '앱 종료 팝업', copy: 'AdMob 전면 광고', link: null, sort: 0, active: true }).onConflictDoNothing();
  await db.insert(S.adSettings).values([
    { slot: 'home_banner', enabled: brand.ads.homeBanner, config: { adsenseSlot: '' } },
    { slot: 'detail_native', enabled: brand.ads.detailNative, config: { adsenseSlot: '' } },
    { slot: 'rewarded', enabled: brand.ads.rewardedResult.enabled, config: { maxPerDay: brand.ads.rewardedResult.maxPerDay, minIntervalSec: brand.ads.rewardedResult.minIntervalSec } },
    { slot: 'exit', enabled: true, config: { mode: brand.ads.exitPopup.mode } },
    { slot: 'content_banner', enabled: true, config: { adsenseSlot: '' } },
    { slot: 'tarot_banner', enabled: true, config: { adsenseSlot: '' } },
  ]).onConflictDoNothing();
}

export async function createAdmin(db: Db, email: string, password: string, role: 'super' | 'operator' = 'super') {
  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(S.admins).values({ email, passwordHash, role }).onConflictDoUpdate({ target: S.admins.email, set: { passwordHash, role } });
}

// ---------- 개발용 데모 데이터 ----------
export async function seedDemo(db: Db, days = 30) {
  const r0 = (await db.execute(sql`select count(*)::int as n from users`)) as unknown;
  const [{ n }] = (Array.isArray(r0) ? r0 : (r0 as { rows: unknown[] }).rows) as { n: number }[];
  if (n > 0) return;
  const rnd = mulberry(20260930);
  const DAY = 86400000;
  const now = Date.now();
  const names = ['김순자', '박철수', '이영희', '최민수', '정미경', '강동원', '윤정숙', '한상철', '오미란', '서재훈'];
  const readings = [...brand.fate, ...brand.love];
  const users: any[] = [], profiles: any[] = [], orders: any[] = [], subs: any[] = [], evs: any[] = [], tals: any[] = [];
  const channels = [['share', 'kakao'], ['google', 'cpc'], ['naver', 'blog'], [null, null], [null, null], ['facebook', 'social'], ['band', 'social']];
  for (let d = days; d >= 0; d--) {
    const dayStart = now - d * DAY;
    const newUsers = 8 + Math.floor(rnd() * 14);
    for (let i = 0; i < newUsers; i++) {
      const id = newId('u_');
      const at = new Date(dayStart - rnd() * DAY * 0.9);
      const [src, med] = channels[Math.floor(rnd() * channels.length)];
      const logged = rnd() < 0.45;
      users.push({ id, deviceId: newId('d_'), provider: logged ? (['google', 'kakao', 'naver'] as const)[Math.floor(rnd() * 3)] : null, providerId: logged ? newId() : null, name: names[Math.floor(rnd() * names.length)], platform: rnd() < 0.6 ? 'android' : 'web', createdAt: at, lastSeenAt: new Date(at.getTime() + rnd() * d * DAY) });
      profiles.push({ id: newId('p_'), userId: id, name: users.at(-1).name, gender: rnd() < 0.6 ? 'F' : 'M', birthYear: 1950 + Math.floor(rnd() * 45), birthMonth: 1 + Math.floor(rnd() * 12), birthDay: 1 + Math.floor(rnd() * 28), calendar: rnd() < 0.3 ? 'lunar' : 'solar', leap: false, birthHour: rnd() < 0.3 ? null : Math.floor(rnd() * 12) * 2, isMain: true, createdAt: at });
      evs.push({ userId: id, sessionId: id, name: 'page_view', props: { path: '/' }, utmSource: src, utmMedium: med, createdAt: at, platform: users.at(-1).platform });
      const views = 2 + Math.floor(rnd() * 6);
      for (let v = 0; v < views; v++) {
        const c = ['today', 'zodiac', 'star', 'blood', 'tarot', 'dream', 'factbomb', 'mbti'][Math.floor(rnd() * 8)];
        evs.push({ userId: id, sessionId: id, name: 'content_view', props: { content: c }, createdAt: new Date(at.getTime() + v * 60000) });
        if (rnd() < 0.12) evs.push({ userId: id, sessionId: id, name: 'share_click', props: { channel: ['kakao', 'band', 'facebook', 'threads', 'copy'][Math.floor(rnd() * 5)], contentId: c }, createdAt: new Date(at.getTime() + v * 60000 + 1000) });
        if (c === 'dream' && rnd() < 0.8) evs.push({ userId: id, sessionId: id, name: 'dream_search', props: { q: ['돼지꿈', '뱀꿈', '이빨 빠지는 꿈', '돌아가신 부모님 꿈', '똥 꿈', '물에 빠지는 꿈', '불나는 꿈', '용꿈'][Math.floor(rnd() * 8)] }, createdAt: at });
      }
      if (rnd() < 0.25) {
        const p = rnd() < 0.8 ? readings[Math.floor(rnd() * readings.length)] : brand.talisman[Math.floor(rnd() * brand.talisman.length)];
        const kind = (p as any).kind === 'talisman' ? 'talisman' : 'reading';
        evs.push({ userId: id, sessionId: id, name: 'product_view', props: { product: p.id }, createdAt: at });
        evs.push({ userId: id, sessionId: id, name: 'checkout_open', props: { product: p.id }, createdAt: at });
        const status = rnd() < 0.72 ? 'paid' : rnd() < 0.6 ? 'cancelled' : 'failed';
        const oid = newId('O');
        orders.push({ id: oid, userId: id, productId: p.id, kind, amount: p.price, discount: 0, method: ['card', 'kakaopay', 'google', 'naverpay'][Math.floor(rnd() * 4)], channel: rnd() < 0.6 ? 'google' : 'pg', status, refundStatus: status === 'paid' && rnd() < 0.03 ? 'done' : null, createdAt: at, paidAt: status === 'paid' ? at : null });
        evs.push({ userId: id, sessionId: id, name: status === 'paid' ? 'pay_success' : status === 'cancelled' ? 'pay_cancel' : 'pay_fail', props: { product: p.id }, createdAt: at });
        if (kind === 'talisman' && status === 'paid') tals.push({ id: newId('t_'), orderId: oid, userId: id, talismanId: p.id, name: users.at(-1).name, birth: '양력 1965년 3월 2일', wish: '가족 모두 건강하기', issuedAt: at });
      }
      if (rnd() < 0.07) {
        const plan = rnd() < 0.35 ? 'yearly' : 'monthly';
        const amount = plan === 'yearly' ? brand.subscription.yearly.price : brand.subscription.monthly.price;
        const canceled = rnd() < 0.15;
        subs.push({ id: newId('s_'), userId: id, plan, status: canceled ? 'canceled' : 'active', channel: 'google', amount, startedAt: at, renewedAt: rnd() < 0.3 ? new Date(at.getTime() + 20 * DAY) : null, expiresAt: new Date(at.getTime() + (plan === 'yearly' ? 365 : 30) * DAY), canceledAt: canceled ? new Date(at.getTime() + 5 * DAY) : null });
        orders.push({ id: newId('O'), userId: id, productId: plan === 'yearly' ? brand.subscription.yearly.id : brand.subscription.monthly.id, kind: 'subscription', amount, discount: 0, method: 'google', channel: 'google', status: 'paid', createdAt: at, paidAt: at });
      }
    }
  }
  for (const [t, rows] of [[S.users, users], [S.profiles, profiles], [S.orders, orders], [S.subscriptions, subs], [S.talismans, tals], [S.events, evs]] as const)
    for (let i = 0; i < rows.length; i += 500) await db.insert(t as any).values(rows.slice(i, i + 500));
  await db.insert(S.pushCampaigns).values([
    { title: '오늘 재물운이 좋은 시간은 언제일까요?', body: '오늘의 운세에서 확인해 보세요', deepLink: '/today', target: 'all', status: 'sent', sentCount: 1843, scheduledAt: new Date(now - DAY) },
    { title: '2027 신년운세가 열렸어요', body: '천궁도사가 한 해 열두 달을 풀어 드려요', deepLink: '/product/newyear', target: 'free', status: 'scheduled', scheduledAt: new Date(now + DAY) },
  ]);
}
function mulberry(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

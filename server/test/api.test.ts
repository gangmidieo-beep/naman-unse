// 서버 통합 테스트 — 메모리 PGlite. 게스트 → 사주 → 주문(mock) → 권한 → 로그인 합치기 → 공유 링크 → 관리자 로그인·통계·권한
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openDb } from '../src/db/index.ts';
import { buildApp } from '../src/app.ts';
import { createAdmin } from '../src/services/seed.ts';

let app: Awaited<ReturnType<typeof buildApp>>['app'];
let close: () => Promise<void>;
beforeAll(async () => {
  const o = await openDb({ dir: 'memory' });
  close = o.close;
  await createAdmin(o.db, 'boss@test.kr', 'super-secret-1', 'super');
  await createAdmin(o.db, 'staff@test.kr', 'staff-secret-1', 'operator');
  ({ app } = await buildApp({ db: o.db, demo: true }));
}, 120_000);
afterAll(async () => { await app.close(); await close(); });

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const profile = (name: string) => ({ name, gender: 'F', year: 1964, month: 5, day: 21, calendar: 'solar' });

describe('공개 API', () => {
  let token = '';
  it('게스트 가입(같은 기기는 같은 계정)', async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'dev-1' } });
    expect(r.statusCode).toBe(200);
    token = r.json().token;
    const again = await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'dev-1' } });
    expect(again.json().userId).toBe(r.json().userId);
  });
  it('사주 저장 — 일반 회원 2개 제한', async () => {
    for (const n of ['나', '배우자']) expect((await app.inject({ method: 'POST', url: '/profiles', headers: auth(token), payload: profile(n) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/profiles', headers: auth(token), payload: profile('자녀') })).statusCode).toBe(402);
  });
  it('상품 26 + 부적 14 + 구독 2 + 배너 10', async () => {
    const list = (await app.inject({ url: '/products' })).json() as any[];
    expect(list.filter((p) => p.kind === 'reading')).toHaveLength(26);
    expect(list.filter((p) => p.kind === 'talisman')).toHaveLength(14);
    expect(list.filter((p) => p.kind === 'subscription')).toHaveLength(2);
    expect((await app.inject({ url: '/banners?slot=home' })).json()).toHaveLength(10);
  });
  it('v3: 타로 6·사진 2 상품, 공통 틀 필드(버튼·결과 제목·추천 부적·상세 문구), 분류', async () => {
    const list = (await app.inject({ url: '/products' })).json() as any[];
    expect(list.filter((p) => p.kind === 'tarot')).toHaveLength(6);
    expect(list.filter((p) => p.kind === 'photo')).toHaveLength(2);
    const wealth = list.find((p) => p.id === 'wealth');
    expect(wealth).toMatchObject({ tab: 'unse', category: 'fate', buttonLabel: '천궁도사의 상세풀이 받기', resultTitle: '천궁도사가 풀어드린 나의 운명서', recommend: ['t_wealth', 't_biz'] });
    expect(wealth.detailCopy.target).toHaveLength(3);
    expect(list.find((p) => p.id === 't_wealth').buttonLabel).toBe('나만의 재물부적 받기 – 14,900원');
    expect(list.find((p) => p.id === 'tarot_celtic').meta.cards).toBe(10);
    const cats = (await app.inject({ url: '/categories' })).json() as any[];
    expect(cats.filter((c) => c.tab === 'unse').map((c) => c.id)).toEqual(['fate', 'love', 'fun', 'photo']);
  });
  it('v3: 사진 분석 — 형식 검사, 결과만 돌려주고 저장 안 함', async () => {
    expect((await app.inject({ method: 'POST', url: '/photo/analyze', payload: { kind: 'palm', image: 'hello' } })).statusCode).toBe(400);
    const r = await app.inject({ method: 'POST', url: '/photo/analyze', payload: { kind: 'face', image: 'data:image/jpeg;base64,AAAA' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().sections).toHaveLength(5);
  });
  it('주문(mock) → 권한 → 구독 후 회원가 10%·사주 무제한', async () => {
    const o = await app.inject({ method: 'POST', url: '/orders', headers: auth(token), payload: { productId: 'wealth' } });
    expect(o.json().status).toBe('paid');
    expect(o.json().amount).toBe(19000);
    await app.inject({ method: 'POST', url: '/orders', headers: auth(token), payload: { productId: 'premium_yearly' } });
    const e = (await app.inject({ url: '/me/entitlements', headers: auth(token) })).json();
    expect(e.premium).toBe(true);
    expect(e.owned.map((x: any) => x.productId)).toContain('wealth');
    const o2 = await app.inject({ method: 'POST', url: '/orders', headers: auth(token), payload: { productId: 't_wealth' } });
    expect(o2.json().amount).toBe(13410);
    expect((await app.inject({ method: 'POST', url: '/profiles', headers: auth(token), payload: profile('자녀') })).statusCode).toBe(200);
  });
  it('로그인(mock 카카오) → 게스트 기록 합치기', async () => {
    const r = await app.inject({ url: '/auth/kakao/start?redirect=http://localhost:5391/box' });
    expect(r.statusCode).toBe(302);
    const loc = new URL(r.headers.location as string);
    expect(loc.pathname).toBe('/auth/callback');
    const userToken = loc.searchParams.get('token')!;
    const m = await app.inject({ method: 'POST', url: '/auth/merge', headers: auth(userToken), payload: { guestToken: token } });
    expect(m.json().merged).toBeGreaterThan(3);
    expect((await app.inject({ url: '/profiles', headers: auth(userToken) })).json()).toHaveLength(3);
    expect((await app.inject({ url: '/me/entitlements', headers: auth(userToken) })).json().premium).toBe(true);
  });
  it('이벤트 배치 + 공유 링크 OG·카드 이미지', async () => {
    expect((await app.inject({ method: 'POST', url: '/events', payload: { events: [{ name: 'content_view', props: { content: 'tarot' } }] } })).json().saved).toBe(1);
    const s = (await app.inject({ method: 'POST', url: '/share', payload: { contentId: 'today', path: '/today', title: '오늘의 운세', text: '94점 — 좋은 날이에요' } })).json();
    const html = await app.inject({ url: `/s/${s.code}` });
    expect(html.body).toContain('og:image');
    expect(html.body).toContain('utm_source=share');
    const png = await app.inject({ url: `/s/${s.code}/card.png` });
    expect(png.headers['content-type']).toBe('image/png');
    expect(png.rawPayload.subarray(1, 4).toString()).toBe('PNG');
  });
});

describe('관리자 API', () => {
  let boss = '', staff = '';
  it('로그인', async () => {
    boss = (await app.inject({ method: 'POST', url: '/admin/api/login', payload: { email: 'boss@test.kr', password: 'super-secret-1' } })).json().token;
    staff = (await app.inject({ method: 'POST', url: '/admin/api/login', payload: { email: 'staff@test.kr', password: 'staff-secret-1' } })).json().token;
    expect(boss && staff).toBeTruthy();
    expect((await app.inject({ url: '/admin/api/dashboard' })).statusCode).toBe(401);
  });
  it('대시보드·회원·결제·구독·통계', async () => {
    const d = (await app.inject({ url: '/admin/api/dashboard?period=month', headers: auth(staff) })).json();
    expect(d.cards.signups).toBeGreaterThan(0);
    expect(d.daily.length).toBeGreaterThan(0);
    expect(Object.keys(d.byKind).length).toBeGreaterThan(1);
    expect((await app.inject({ url: '/admin/api/dashboard?period=7d&format=csv', headers: auth(staff) })).body).toContain('date,visitors');
    expect(((await app.inject({ url: '/admin/api/members?limit=5', headers: auth(staff) })).json() as any[]).length).toBe(5);
    expect(((await app.inject({ url: '/admin/api/payments?kind=talisman', headers: auth(staff) })).json() as any[]).every((p) => p.bucket === 'talisman')).toBe(true);
    expect((await app.inject({ url: '/admin/api/subscriptions/stats?period=month', headers: auth(staff) })).json()).toHaveProperty('monthly');
    const st = (await app.inject({ url: '/admin/api/stats?period=month', headers: auth(staff) })).json();
    expect(st.dreamTop.length).toBeGreaterThan(0);
    expect(st.shares.length).toBeGreaterThan(0);
  });
  it('권한 2단계 — 운영자는 가격·광고·환불 불가, 변경 이력 기록', async () => {
    expect((await app.inject({ method: 'PATCH', url: '/admin/api/products/wealth', headers: auth(staff), payload: { badge: 'BEST' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: '/admin/api/products/wealth', headers: auth(staff), payload: { price: 1000 } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/admin/api/ads/home_banner', headers: auth(staff), payload: { enabled: false } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PUT', url: '/admin/api/ads/home_banner', headers: auth(boss), payload: { enabled: false } })).json().enabled).toBe(false);
    const logs = (await app.inject({ url: '/admin/api/audit', headers: auth(boss) })).json() as any[];
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['product.update', 'ads.update']));
  });
  it('배너 저장·푸시 즉시/예약·딥링크 검증', async () => {
    expect((await app.inject({ method: 'POST', url: '/admin/api/banners', headers: auth(staff), payload: { slot: 'event_popup', title: '추석 이벤트', link: '/premium' } })).statusCode).toBe(200);
    const sent = (await app.inject({ method: 'POST', url: '/admin/api/push', headers: auth(staff), payload: { title: '오늘 재물운이 좋은 시간은 언제일까요?', body: '확인해 보세요', deepLink: '/today', target: 'all' } })).json();
    expect(sent.status).toBe('sent');
    expect(sent.sentCount).toBeGreaterThan(0);
    const later = (await app.inject({ method: 'POST', url: '/admin/api/push', headers: auth(staff), payload: { title: 'a', body: 'b', deepLink: '/unse?cat=fate', target: 'premium', scheduledAt: new Date(Date.now() + 3600e3).toISOString() } })).json();
    expect(later.status).toBe('scheduled');
    expect((await app.inject({ method: 'POST', url: '/admin/api/push', headers: auth(staff), payload: { title: 'a', body: 'b', deepLink: 'https://evil.example', target: 'all' } })).statusCode).toBe(400);
  });
  it('관리자 5회 실패 잠금', async () => {
    for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/admin/api/login', payload: { email: 'staff@test.kr', password: 'wrong' } });
    expect((await app.inject({ method: 'POST', url: '/admin/api/login', payload: { email: 'staff@test.kr', password: 'staff-secret-1' } })).statusCode).toBe(423);
  });
});

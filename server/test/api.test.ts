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
  it('상품 26 + 부적 30 + 구독 2 + 배너 10', async () => {
    const list = (await app.inject({ url: '/products' })).json() as any[];
    expect(list.filter((p) => p.kind === 'reading')).toHaveLength(26);
    expect(list.filter((p) => p.kind === 'talisman')).toHaveLength(30);
    expect(list.filter((p) => p.kind === 'subscription')).toHaveLength(2);
    expect((await app.inject({ url: '/banners?slot=home' })).json()).toHaveLength(10);
  });
  it('v3: 타로 14·사진 3 상품, 공통 틀 필드(버튼·결과 제목·추천 부적·상세 문구), 분류', async () => {
    const list = (await app.inject({ url: '/products' })).json() as any[];
    expect(list.filter((p) => p.kind === 'tarot')).toHaveLength(14);
    expect(list.filter((p) => p.kind === 'photo')).toHaveLength(3);
    const wealth = list.find((p) => p.id === 'wealth');
    expect(wealth).toMatchObject({ tab: 'unse', category: 'fate', buttonLabel: '천궁도사의 상세풀이 받기', resultTitle: '천궁도사가 풀어드린 나의 운명서', recommend: ['t_wealth', 't_biz'] });
    expect(wealth.detailCopy.target).toHaveLength(3);
    expect(list.find((p) => p.id === 't_wealth').buttonLabel).toBe('나만의 금전재물부적 받기 – 14,900원');
    expect(list.find((p) => p.id === 'tarot_celtic').meta.cards).toBe(10);
    const cats = (await app.inject({ url: '/categories' })).json() as any[];
    expect(cats.filter((c) => c.tab === 'unse').map((c) => c.id)).toEqual(['fate', 'love', 'photo']);
  });
  it('v3: 사진 분석 — 형식 검사, 결과만 돌려주고 저장 안 함', async () => {
    expect((await app.inject({ method: 'POST', url: '/photo/analyze', payload: { kind: 'palm', image: 'hello' } })).statusCode).toBe(400);
    const r = await app.inject({ method: 'POST', url: '/photo/analyze', payload: { kind: 'face', image: 'data:image/jpeg;base64,AAAA' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().sections).toHaveLength(7);
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
    expect(o2.json().amount).toBe(13400);
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
  it('로그인 링크 보안: nonce 를 돌려주고, 회원 계정은 합치기 대상이 아니다', async () => {
    const r = await app.inject({ url: '/auth/naver/start?redirect=http://localhost:5391/box&nonce=abcDEF123456' });
    const loc = new URL(r.headers.location as string);
    expect(loc.searchParams.get('nonce')).toBe('abcDEF123456');
    const victim = loc.searchParams.get('token')!;
    const r2 = await app.inject({ url: '/auth/google/start?redirect=http://localhost:5391/box' });
    const attacker = new URL(r2.headers.location as string).searchParams.get('token')!;
    // 회원 토큰을 '게스트'로 넘겨도 그 회원의 기록은 옮겨지지 않음
    expect((await app.inject({ method: 'POST', url: '/auth/merge', headers: auth(attacker), payload: { guestToken: victim } })).json().merged).toBe(0);
  });
  it('남의 사주 id 로는 주문할 수 없고, 잘못된 생년월일은 400', async () => {
    const a = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'own-a' } })).json().token;
    const b = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'own-b' } })).json().token;
    const pa = (await app.inject({ method: 'POST', url: '/profiles', headers: auth(a), payload: profile('본인') })).json();
    const res = await app.inject({ method: 'POST', url: '/orders', headers: auth(b), payload: { productId: 'wealth', profileId: pa.id } });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('profile_missing');
    expect((await app.inject({ method: 'POST', url: '/profiles', headers: auth(b), payload: { ...profile('x'), year: 'abc' } })).statusCode).toBe(400);
    // 쓰는 중인 풀이의 사주는 지울 수 없음(결제한 풀이가 멈추지 않게)
    const oa = await app.inject({ method: 'POST', url: '/orders', headers: auth(a), payload: { productId: 'wealth', profileId: pa.id } });
    expect(oa.statusCode).toBe(200);
    const del = await app.inject({ method: 'DELETE', url: `/profiles/${pa.id}`, headers: auth(a) });
    expect(del.statusCode).toBe(409);
    expect(del.json().code).toBe('profile_in_use');
    // 같은 id 를 다른 계정이 올리면 새 id 로 저장(남의 사주를 덮어쓰지 않음)
    const pb = (await app.inject({ method: 'POST', url: '/profiles', headers: auth(b), payload: { ...profile('남'), id: pa.id } })).json();
    expect(pb.id).not.toBe(pa.id);
  });
  it('이벤트 배치 + 공유 링크 OG·카드 이미지', async () => {
    expect((await app.inject({ method: 'POST', url: '/events', payload: { events: [{ name: 'content_view', props: { content: 'tarot' } }] } })).json().saved).toBe(1);
    const s = (await app.inject({ method: 'POST', url: '/share', headers: auth(token), payload: { contentId: 'today', path: '/today', title: '오늘의 운세', text: '94점 — 좋은 날이에요' } })).json();
    const html = await app.inject({ url: `/s/${s.code}` });
    expect(html.body).toContain('og:image');
    expect(html.body).toContain('utm_source=share');
    const png = await app.inject({ url: `/s/${s.code}/card.png` });
    expect(png.headers['content-type']).toBe('image/png');
    expect(png.rawPayload.subarray(1, 4).toString()).toBe('PNG');
    // 3차: Play 등록 뒤(PLAY_STORE_LIVE=1) 안드로이드에서는 앱이 있으면 앱, 없으면 Play 설치 화면으로
    const android = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14; SM-S918N) KAKAOTALK' };
    expect((await app.inject({ url: `/s/${s.code}`, headers: android })).body).not.toContain('intent://'); // 등록 전엔 웹으로
    process.env.PLAY_STORE_LIVE = '1';
    try {
      const a = (await app.inject({ url: `/s/${s.code}`, headers: android })).body;
      expect(a).toContain('intent://open?path=%2Ftoday#Intent;scheme=namanunse;package=com.namanunse.app');
      expect(a).toContain(encodeURIComponent('https://play.google.com/store/apps/details?id=com.namanunse.app'));
      expect(a).toContain('og:image');
      expect((await app.inject({ url: `/s/${s.code}`, headers: { 'user-agent': 'Mozilla/5.0 (iPhone)' } })).body).not.toContain('intent://');
    } finally { delete process.env.PLAY_STORE_LIVE; }
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
  it('대시보드·회원·결제·구독·통계', { timeout: 30000 }, async () => {
    const d = (await app.inject({ url: '/admin/api/dashboard?period=month', headers: auth(staff) })).json();
    expect(d.cards.signups).toBeGreaterThan(0);
    expect(d.daily.length).toBeGreaterThan(0);
    expect(Object.keys(d.byKind).length).toBeGreaterThan(1);
    // 사이트 분류와 같은 6구분 — 타로·사진운세가 운명서·인연서에 섞이지 않는다
    expect(Object.keys(d.byKind).every((k) => ['fate', 'love', 'photo', 'tarot', 'talisman', 'subscription'].includes(k))).toBe(true);
    const ago = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10), today = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const m = (await app.inject({ url: `/admin/api/dashboard?period=custom&from=${ago}&to=${today}`, headers: auth(staff) })).json();
    expect(m.byKind.tarot?.n).toBeGreaterThan(0);
    expect(m.byKind.photo?.n).toBeGreaterThan(0);
    expect(m.subs).toHaveProperty('mrr');
    expect(m.sources.map((s: any) => s.src)).toEqual(expect.arrayContaining(['share', 'google', 'direct']));
    expect(m.sources.reduce((t: number, s: any) => t + s.revenue, 0)).toBe(m.cards.revenue);
    expect(m.top.length).toBeGreaterThan(0);
    expect(((await app.inject({ url: '/admin/api/payments?kind=tarot', headers: auth(staff) })).json() as any[]).every((p) => p.bucket === 'tarot')).toBe(true);
    expect((await app.inject({ url: '/admin/api/dashboard?period=7d&format=csv', headers: auth(staff) })).body).toContain('date,visitors');
    expect(((await app.inject({ url: '/admin/api/members?limit=5', headers: auth(staff) })).json() as any[]).length).toBe(5);
    expect(((await app.inject({ url: '/admin/api/payments?kind=talisman', headers: auth(staff) })).json() as any[]).every((p) => p.bucket === 'talisman')).toBe(true);
    expect((await app.inject({ url: '/admin/api/subscriptions/stats?period=month', headers: auth(staff) })).json()).toHaveProperty('monthly');
    const st = (await app.inject({ url: '/admin/api/stats?period=month', headers: auth(staff) })).json();
    expect(st.dreamTop.length).toBeGreaterThan(0);
    expect(st.shares.length).toBeGreaterThan(0);
  });
  it('업로드 이미지는 DB 에 보관(배포해도 남음) · 가격 0원·빈 칸 저장 거부 · 결제 검색·원가 칸', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const up = (await app.inject({ method: 'POST', url: '/admin/api/upload', headers: auth(staff), payload: { dataUrl: `data:image/png;base64,${png}` } })).json();
    const img = await app.inject({ url: new URL(up.url).pathname });
    expect(img.statusCode).toBe(200);
    expect(img.headers['content-type']).toContain('image/png');
    expect((await app.inject({ method: 'PATCH', url: '/admin/api/products/wealth', headers: auth(boss), payload: { price: 0 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: '/admin/api/products/wealth', headers: auth(boss), payload: { memberPrice: 999999 } })).statusCode).toBe(400);
    // 무료 상품(오늘의 운세 등)은 가격 칸(0원)을 함께 보내도 저장됨
    const free = (await app.inject({ url: '/products' })).json().find((x: any) => x.price === 0);
    expect((await app.inject({ method: 'PATCH', url: `/admin/api/products/${free.id}`, headers: auth(boss), payload: { title: free.title, price: 0, memberPrice: null, listPrice: null } })).statusCode).toBe(200);
    const list = (await app.inject({ url: '/admin/api/payments?q=zzz-none', headers: auth(staff) })).json();
    expect(list).toEqual([]);
    const all = (await app.inject({ url: '/admin/api/payments?limit=5', headers: auth(staff) })).json();
    expect(all[0]).toHaveProperty('cost_krw');
  });
  it('브라우저 사전 요청(CORS) — 관리자 저장(PATCH)·광고(PUT)·삭제(DELETE) 허용', async () => {
    const origin = 'https://localhost'; // 앱(Capacitor) 출처 — 웹 출처도 같은 설정을 씀
    for (const [method, url] of [['PATCH', '/admin/api/products/wealth'], ['PUT', '/admin/api/ads/home_banner'], ['DELETE', '/admin/api/banners/x'], ['DELETE', '/profiles/x']]) {
      const r = await app.inject({ method: 'OPTIONS', url, headers: { origin, 'access-control-request-method': method, 'access-control-request-headers': 'authorization,content-type' } });
      expect(r.statusCode).toBe(204);
      expect(String(r.headers['access-control-allow-methods'])).toContain(method);
    }
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
    expect((await app.inject({ method: 'POST', url: '/admin/api/login', payload: { email: 'staff@test.kr', password: 'staff-secret-1' } })).statusCode).toBe(401); // 잠김도 401(계정 존재 여부를 안 알려줌)
  });
  it('관리자 계정: 추가 → 비밀번호 변경 → 이전 관리자 삭제(남은 토큰도 즉시 무효)', async () => {
    const ip = { remoteAddress: '10.9.9.9' }; // 위 잠금 테스트와 분당 로그인 제한을 나눠 쓰지 않게
    const login = async (email: string, password: string) => (await app.inject({ method: 'POST', url: '/admin/api/login', payload: { email, password }, ...ip })).json().token as string;
    const boss = await login('boss@test.kr', 'super-secret-1');
    expect((await app.inject({ method: 'POST', url: '/admin/api/admins', headers: auth(boss), payload: { email: 'Owner@Test.kr', password: 'short' } })).statusCode).toBe(400);
    const made = (await app.inject({ method: 'POST', url: '/admin/api/admins', headers: auth(boss), payload: { email: 'Owner@Test.kr', password: 'owner-first-1' } })).json();
    expect(made).toMatchObject({ email: 'owner@test.kr', role: 'super' });
    expect((await app.inject({ method: 'POST', url: '/admin/api/admins', headers: auth(boss), payload: { email: 'owner@test.kr', password: 'owner-first-1' } })).statusCode).toBe(409);
    const owner = await login('owner@test.kr', 'owner-first-1');
    expect((await app.inject({ method: 'POST', url: '/admin/api/me/password', headers: auth(owner), payload: { current: 'wrong-password', next: 'owner-second-2' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/admin/api/me/password', headers: auth(owner), payload: { current: 'owner-first-1', next: 'owner-second-2' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/admin/api/login', payload: { email: 'owner@test.kr', password: 'owner-first-1' }, ...ip })).statusCode).toBe(401);
    const owner2 = await login('owner@test.kr', 'owner-second-2');
    const list = (await app.inject({ url: '/admin/api/admins', headers: auth(owner2) })).json() as any[];
    expect(list.some((a) => 'passwordHash' in a)).toBe(false);
    const bossId = list.find((a) => a.email === 'boss@test.kr').id;
    expect((await app.inject({ method: 'DELETE', url: `/admin/api/admins/${made.id}`, headers: auth(owner2) })).statusCode).toBe(400); // 내 계정
    expect((await app.inject({ method: 'DELETE', url: `/admin/api/admins/${bossId}`, headers: auth(owner2) })).statusCode).toBe(200);
    expect((await app.inject({ url: '/admin/api/dashboard', headers: auth(boss) })).statusCode).toBe(401);
    const staffId = list.find((a) => a.email === 'staff@test.kr').id;
    expect((await app.inject({ method: 'DELETE', url: `/admin/api/admins/${staffId}`, headers: auth(owner2) })).statusCode).toBe(200);
  });
});

describe('회원 탈퇴', () => {
  it('개인정보 삭제, 결제 기록은 남김, 같은 기기는 새 계정으로', async () => {
    const g = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'bye-1' } })).json();
    const h = auth(g.token);
    const pr = (await app.inject({ method: 'POST', url: '/profiles', headers: h, payload: profile('탈퇴할 사람') })).json();
    const o = (await app.inject({ method: 'POST', url: '/orders', headers: h, payload: { productId: 'wealth', profileId: pr.id } })).json();
    expect(o.status).toBe('paid');
    expect((await app.inject({ method: 'POST', url: '/me/delete', headers: h, payload: {} })).statusCode).toBe(200);
    expect((await app.inject({ url: '/me', headers: h })).statusCode).toBe(401);
    expect((await app.inject({ url: '/profiles', headers: h })).statusCode).toBe(401);
    const again = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'bye-1' } })).json();
    expect(again.userId).not.toBe(g.userId);
  });
});

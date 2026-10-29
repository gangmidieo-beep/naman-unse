// 09 결제 — PayApp(웹)·Google Play(앱) 실결제 흐름을 가짜 결제사 응답으로 끝까지 검증
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openDb } from '../src/db/index.ts';
import { buildApp } from '../src/app.ts';
import { nextRebillDate, normalizePhone, parsePayappFeedback, rebillDay } from '../src/services/payments/payapp.ts';
import { mapSubscriptionState, readProductPurchase, readRtdn, readSubscription, subscriptionUsable } from '../src/services/payments/google-play.ts';

const ENV = { userid: 'naman_test', linkkey: 'k+ey/AbC=', linkval: 'v+al/XyZ=' };
let app: Awaited<ReturnType<typeof buildApp>>['app'];
let close: () => Promise<void>;
const calls: URLSearchParams[] = [];
const fakePayApp = (async (_url: string, init: any) => {
  const body = new URLSearchParams(init.body);
  calls.push(body);
  if (body.get('cmd') === 'paycancel' || body.get('cmd') === 'rebillCancel') return new Response('state=1');
  if (body.get('cmd') === 'rebillRegist') return new Response(`state=1&errno=00000&rebill_no=RB${calls.length}&payurl=${encodeURIComponent('http://payapp.kr/R/abc' + calls.length)}`);
  return new Response(`state=1&mul_no=MUL${calls.length}&payurl=${encodeURIComponent('https://www.payapp.kr/L/abc' + calls.length)}`);
}) as unknown as typeof fetch;

beforeAll(async () => {
  Object.assign(process.env, {
    PG_PROVIDER: 'payapp', PAYAPP_USERID: ENV.userid, PAYAPP_LINKKEY: ENV.linkkey, PAYAPP_LINKVAL: ENV.linkval,
    PUBLIC_WEB_ORIGIN: 'https://web.example.kr', API_ORIGIN: 'https://api.example.kr',
    READING_AI: 'live', ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_MODEL: 'test-model', // 풀이 판매 허용 조건(테스트에선 워커를 돌리지 않아 실제 호출 없음)
  });
  const o = await openDb({ dir: 'memory' });
  close = o.close;
  ({ app } = await buildApp({ db: o.db, mock: false, http: fakePayApp }));
}, 120_000);
afterAll(async () => {
  await app.close(); await close();
  for (const k of ['PG_PROVIDER', 'PAYAPP_USERID', 'PAYAPP_LINKKEY', 'PAYAPP_LINKVAL', 'PUBLIC_WEB_ORIGIN', 'API_ORIGIN', 'READING_AI', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']) delete process.env[k];
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const guest = async (d: string) => (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: d } })).json().token as string;
const feedback = (orderId: string, price: number, state = '4', over: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url: '/pay/payapp/feedback', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ userid: ENV.userid, linkkey: ENV.linkkey, linkval: ENV.linkval, var1: orderId, mul_no: 'MUL1', price: String(price), pay_state: state, pay_type: '1', ...over }).toString() });

describe('PayApp 웹 결제', () => {
  let token = '';
  it('휴대폰 번호 정규화', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
    expect(normalizePhone('+82 10 1234 5678')).toBe('01012345678');
    expect(normalizePhone('02-123-4567')).toBeNull();
  });
  it('AI 풀이가 꺼져 있으면 유료 풀이는 팔지 않음(부적은 판매)', async () => {
    token = await guest('pay-1');
    process.env.READING_AI = 'off'; // 판매 스위치를 끄면(키가 있어도) 유료 풀이 판매 중지
    try {
      const r = await app.inject({ method: 'POST', url: '/orders', headers: auth(token), payload: { productId: 'jeongtong', phone: '010-1111-2222' } });
      expect(r.statusCode).toBe(503);
      expect(r.json().code).toBe('reading_off');
      const t = (await app.inject({ url: '/products' })).json().find((p: any) => p.kind === 'talisman');
      expect((await app.inject({ method: 'POST', url: '/orders', headers: auth(token), payload: { productId: t.id, phone: '010-1111-2222' } })).statusCode).toBe(200);
    } finally { process.env.READING_AI = 'live'; }
  });
  it('번호 없으면 결제창을 열지 않음', async () => {
    const r = await app.inject({ method: 'POST', url: '/orders', headers: auth(token), payload: { productId: 'jeongtong' } });
    expect(r.statusCode).toBe(400);
    expect(r.json().code).toBe('phone');
  });
  let orderId = '';
  let price = 0;
  it('주문 → PayApp 결제 주소. 돌아올 주소·통보 주소는 환경변수 도메인(하드코딩 금지)', async () => {
    const r = await app.inject({ method: 'POST', url: '/orders', headers: auth(token), payload: { productId: 'jeongtong', phone: '010-1111-2222', price: 1 } });
    expect(r.statusCode).toBe(200);
    const o = r.json();
    orderId = o.id; price = o.amount;
    expect(o.status).toBe('pending');
    expect(o.payUrl).toMatch(/^https:\/\/www\.payapp\.kr\//);
    expect(price).toBeGreaterThan(1000); // 화면이 보낸 금액(1원)은 무시
    const sent = calls.at(-1)!;
    expect(sent.get('returnurl')).toBe(`https://api.example.kr/pay/payapp/return?order=${orderId}`);
    // 결제창은 POST 로 돌아온다 — 서버가 받아 웹 확인 화면으로 303(GET) 넘김(웹 정적 서버는 POST 에 405)
    for (const method of ['POST', 'GET'] as const) {
      const back = await app.inject({ method, url: `/pay/payapp/return?order=${orderId}`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: method === 'POST' ? 'state=1' : undefined });
      expect(back.statusCode).toBe(303);
      expect(back.headers.location).toBe(`https://web.example.kr/pay/return?order=${orderId}`);
    }
    expect((await app.inject({ url: '/pay/payapp/return?order=../evil' })).headers.location).toBe('https://web.example.kr/box');
    expect(sent.get('feedbackurl')).toBe('https://api.example.kr/pay/payapp/feedback');
    expect(sent.get('recvphone')).toBe('01011112222');
    expect(sent.get('price')).toBe(String(price));
  });
  it('연동키가 다르면 통보 거부', async () => {
    expect((await feedback(orderId, price, '4', { linkkey: 'wrong' })).statusCode).toBe(400);
    expect((await app.inject({ url: `/orders/${orderId}`, headers: auth(token) })).json().status).toBe('pending');
  });
  it('금액이 다르면 확정하지 않음', async () => {
    const t2 = await guest('pay-2');
    const o = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t2), payload: { productId: 'jeongtong', phone: '01033334444' } })).json();
    expect((await feedback(o.id, 100)).body).toBe('SUCCESS');
    expect((await app.inject({ url: `/orders/${o.id}`, headers: auth(t2) })).json().status).toBe('failed');
  });
  it('통보(+ 가 공백으로 바뀌어 와도) → 결제 확정 → 풀이 생성 대기, 두 번 와도 한 번만', async () => {
    const r = await feedback(orderId, price, '4', { linkkey: ENV.linkkey.replace(/\+/g, ' ') });
    expect(r.body).toBe('SUCCESS');
    expect((await feedback(orderId, price)).body).toBe('SUCCESS');
    const o = (await app.inject({ url: `/orders/${orderId}`, headers: auth(token) })).json();
    expect(o.status).toBe('paid');
    const ent = (await app.inject({ url: '/me/entitlements', headers: auth(token) })).json();
    expect(ent.owned.filter((x: any) => x.orderId === orderId)).toHaveLength(1);
    expect(ent.owned.find((x: any) => x.orderId === orderId)).toMatchObject({ kind: expect.any(String), amount: expect.any(Number) }); // 운세함 복구용 정보
    // 이미 확정된 주문에 다른 금액의 통보가 다시 와도(재전송·오류) 결제완료가 '실패'로 뒤집히지 않음
    expect((await feedback(orderId, 100)).body).toBe('SUCCESS');
    expect((await app.inject({ url: `/orders/${orderId}`, headers: auth(token) })).json().status).toBe('paid');
  });
  it('공유 링크는 로그인(게스트 포함) 필요, 상대 경로만', async () => {
    expect((await app.inject({ method: 'POST', url: '/share', payload: { contentId: 'x', path: '/today', title: 't', text: 'x' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/share', headers: auth(token), payload: { contentId: 'x', path: 'https://evil.example', title: 't', text: 'x' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/share', headers: auth(token), payload: { contentId: 'x', path: '/today', title: 't', text: 'x' } })).statusCode).toBe(200);
  });
  it('웹 월 구독 = PayApp 정기결제(매월 자동결제): 등록 → 1회차 → 다음 달 자동 승인 → 해지 → 기간까지 이용', async () => {
    const t = await guest('pay-3');
    const before = calls.length;
    const m = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'premium_monthly', phone: '01055556666' } })).json();
    const reg = calls[before];
    expect(reg.get('cmd')).toBe('rebillRegist');
    expect(reg.get('rebillCycleType')).toBe('Month');
    expect(reg.get('goodprice')).toBe('6900');
    expect(reg.get('var1')).toBe(m.id);
    expect(reg.get('failurl')).toBe('https://api.example.kr/pay/payapp/rebill-fail');
    expect(reg.get('rebillCycleMonth')).toBe(rebillDay());
    expect(m.payUrl.startsWith('https://payapp.kr/')).toBe(true); // http 로 와도 https 로
    const rb = m.providerRef.slice(1);
    // 1회차 승인
    await feedback(m.id, m.amount, '4', { rebill_no: rb, mul_no: 'RM1' });
    let ent = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(ent.premium).toBe(true);
    expect(ent.subscription.autoRenew).toBe(true);
    expect(ent.subscription.rebillNo).toBe(rb);
    const days = (new Date(ent.subscription.expiresAt).getTime() - Date.now()) / 864e5;
    expect(days).toBeGreaterThan(28); expect(days).toBeLessThan(35);
    // 자동결제 중에는 연간 이용권 중복 구매 막기
    const dup = await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'premium_yearly', phone: '01055556666' } });
    expect(dup.statusCode).toBe(409);
    // 다음 달 자동 승인(같은 rebill_no, 새 결제번호) → 갱신 주문이 생기고, 같은 통보가 또 와도 한 번만
    await feedback(m.id, m.amount, '4', { rebill_no: rb, mul_no: 'RM2' });
    await feedback(m.id, m.amount, '4', { rebill_no: rb, mul_no: 'RM2' });
    ent = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(ent.owned.filter((x: any) => x.productId === 'premium_monthly')).toHaveLength(2);
    await feedback('', m.amount, '4', { rebill_no: rb, mul_no: 'RM2b' }); // 2회차 통보에 var1 이 비어 와도 rebill_no 로 이어 감
    ent = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(ent.owned.filter((x: any) => x.productId === 'premium_monthly')).toHaveLength(3);
    // 금액이 다르면 확정하지 않음
    await feedback(m.id, 100, '4', { rebill_no: rb, mul_no: 'RM3' });
    expect((await app.inject({ url: '/me/entitlements', headers: auth(t) })).json().owned.filter((x: any) => x.productId === 'premium_monthly')).toHaveLength(3);
    // 해지 → PayApp rebillCancel, 남은 기간은 그대로 프리미엄
    const c0 = calls.length;
    const c = await app.inject({ method: 'POST', url: '/me/subscription/cancel', headers: auth(t) });
    expect(c.statusCode).toBe(200);
    expect(calls[c0].get('cmd')).toBe('rebillCancel');
    expect(calls[c0].get('rebill_no')).toBe(rb);
    ent = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(ent.premium).toBe(true);
    expect(ent.subscription.autoRenew).toBe(false);
    expect((await app.inject({ method: 'POST', url: '/me/subscription/cancel', headers: auth(t) })).statusCode).toBe(404);
    // 남은 기간 중에 월 자동결제를 다시 걸면 겹쳐 결제 → 막음
    const again = await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'premium_monthly', phone: '01055556666' } });
    expect(again.statusCode).toBe(409); expect(again.json().code).toBe('pass_active');
    // 해지 후 연간 이용권은 남은 기간 뒤에 이어 붙음
    const y = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'premium_yearly', phone: '01055556666' } })).json();
    expect(calls[calls.length - 1].get('cmd')).toBe('payrequest');
    const exp0 = new Date(ent.subscription.expiresAt).getTime();
    await feedback(y.id, y.amount);
    ent = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(Math.round((new Date(ent.subscription.expiresAt).getTime() - exp0) / 864e5)).toBe(365);
    await feedback(y.id, y.amount, '9'); // 결제사에서 환불
    ent = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(ent.premium).toBe(false);
  });
  it('자동결제 실패 통보(failurl)는 SUCCESS 로 받고 기록만', async () => {
    const r = await app.inject({ method: 'POST', url: '/pay/payapp/rebill-fail', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ userid: ENV.userid, linkkey: ENV.linkkey, linkval: ENV.linkval, var1: 'O_x', rebill_no: 'RB0', pay_state: '99', price: '6900' }).toString() });
    expect(r.body).toBe('SUCCESS');
  });
  it('다음 결제일 계산(한국 날짜, 말일 처리)', () => {
    const kst = (s: string) => new Date(`${s}+09:00`);
    expect(rebillDay(kst('2026-10-13T08:00:00'))).toBe('13');
    expect(rebillDay(kst('2026-01-30T08:00:00'))).toBe('90');
    expect(rebillDay(kst('2026-02-28T08:00:00'))).toBe('90');
    expect(rebillDay(kst('2026-10-12T23:30:00'))).toBe('12');
    expect(nextRebillDate(kst('2026-10-13T08:00:00'), '13').toISOString()).toBe(kst('2026-11-13T00:00:00').toISOString());
    expect(nextRebillDate(kst('2026-01-31T08:00:00'), '90').toISOString()).toBe(kst('2026-02-28T00:00:00').toISOString());
    expect(nextRebillDate(kst('2026-12-05T08:00:00'), '5').toISOString()).toBe(kst('2027-01-05T00:00:00').toISOString());
  });
  it('프리미엄 회원은 회원가(10% 할인)로 주문', async () => {
    const t = await guest('pay-4');
    const m = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'premium_monthly', phone: '01077778888' } })).json();
    await feedback(m.id, m.amount);
    const full = (await app.inject({ url: '/products' })).json().find((p: any) => p.id === 'jeongtong').price;
    const o = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'jeongtong', phone: '01077778888' } })).json();
    expect(o.amount).toBeLessThan(full);
    expect(o.amount).toBe(({ 29000: 26000, 19000: 17000, 14900: 13400, 9900: 8900, 4900: 4400, 3000: 2700 } as Record<number, number>)[full] ?? Math.floor((full * 0.9) / 100) * 100); // 3차 프리미엄 회원가표
  });
  it('PayApp 취소 요청 형식(관리자 환불에서 사용)', async () => {
    const before = calls.length;
    const { payappCancel } = await import('../src/services/payments/payapp.ts');
    await payappCancel('MUL9', '테스트', ENV, fakePayApp);
    expect(calls[before].get('cmd')).toBe('paycancel');
    expect(calls[before].get('mul_no')).toBe('MUL9');
  });
  it('통보 파서: 값 일부만 로그, 상태 매핑', () => {
    const logs: string[] = [];
    expect(parsePayappFeedback({ userid: 'x', linkkey: ENV.linkkey, linkval: ENV.linkval }, ENV, (m) => logs.push(m))).toBeNull();
    expect(logs[0]).not.toContain(ENV.userid);
    expect(parsePayappFeedback({ ...ENV, var1: 'O1', price: '9900', pay_state: '64' }, ENV)?.state).toBe('refunded');
  });
});

describe('Google Play 상태 해석', () => {
  it('해지하면 만료일까지는 프리미엄 유지', () => {
    const future = new Date(Date.now() + 5 * 864e5);
    expect(subscriptionUsable(mapSubscriptionState('SUBSCRIPTION_STATE_CANCELED'), future)).toBe(true);
    expect(subscriptionUsable('canceled', new Date(Date.now() - 1000))).toBe(false);
  });
  it('결제 실패 유예기간엔 유지, 보류·만료면 중지', () => {
    const f = new Date(Date.now() + 864e5);
    expect(subscriptionUsable(mapSubscriptionState('SUBSCRIPTION_STATE_IN_GRACE_PERIOD'), f)).toBe(true);
    expect(subscriptionUsable(mapSubscriptionState('SUBSCRIPTION_STATE_ON_HOLD'), f)).toBe(false);
    expect(subscriptionUsable(mapSubscriptionState('SUBSCRIPTION_STATE_EXPIRED'), f)).toBe(false);
  });
  it('단건: 취소·대기 결제는 거부', () => {
    expect(readProductPurchase({ purchaseState: 0, acknowledgementState: 0 }).ok).toBe(true);
    expect(readProductPurchase({ purchaseState: 1 }).ok).toBe(false);
    expect(readProductPurchase({ purchaseState: 2 }).ok).toBe(false);
  });
  it('구독 응답·RTDN 읽기', () => {
    const s = readSubscription({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: 'premium_monthly', expiryTime: '2027-01-01T00:00:00Z' }], acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING' });
    expect(s.status).toBe('active');
    expect(s.acknowledged).toBe(false);
    const data = Buffer.from(JSON.stringify({ subscriptionNotification: { notificationType: 3, purchaseToken: 'tok', subscriptionId: 'premium_monthly' } })).toString('base64');
    expect(readRtdn({ message: { data } })).toMatchObject({ kind: 'subscription', purchaseToken: 'tok', type: 3 });
  });
  it('키 없으면 앱 결제 검증은 준비 중 안내', async () => {
    const t = await guest('play-1');
    expect((await app.inject({ method: 'POST', url: '/billing/google/verify', headers: auth(t), payload: { productId: 'jeongtong', purchaseToken: 'x' } })).statusCode).toBe(503);
  });
});

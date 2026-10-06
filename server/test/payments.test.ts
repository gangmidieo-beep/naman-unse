// 09 결제 — PayApp(웹)·Google Play(앱) 실결제 흐름을 가짜 결제사 응답으로 끝까지 검증
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openDb } from '../src/db/index.ts';
import { buildApp } from '../src/app.ts';
import { normalizePhone, parsePayappFeedback } from '../src/services/payments/payapp.ts';
import { mapSubscriptionState, readProductPurchase, readRtdn, readSubscription, subscriptionUsable } from '../src/services/payments/google-play.ts';

const ENV = { userid: 'naman_test', linkkey: 'k+ey/AbC=', linkval: 'v+al/XyZ=' };
let app: Awaited<ReturnType<typeof buildApp>>['app'];
let close: () => Promise<void>;
const calls: URLSearchParams[] = [];
const fakePayApp = (async (_url: string, init: any) => {
  const body = new URLSearchParams(init.body);
  calls.push(body);
  if (body.get('cmd') === 'paycancel') return new Response('state=1');
  return new Response(`state=1&mul_no=MUL${calls.length}&payurl=${encodeURIComponent('https://www.payapp.kr/L/abc' + calls.length)}`);
}) as unknown as typeof fetch;

beforeAll(async () => {
  Object.assign(process.env, {
    PG_PROVIDER: 'payapp', PAYAPP_USERID: ENV.userid, PAYAPP_LINKKEY: ENV.linkkey, PAYAPP_LINKVAL: ENV.linkval,
    PUBLIC_WEB_ORIGIN: 'https://web.example.kr', API_ORIGIN: 'https://api.example.kr',
  });
  const o = await openDb({ dir: 'memory' });
  close = o.close;
  ({ app } = await buildApp({ db: o.db, mock: false, http: fakePayApp }));
}, 120_000);
afterAll(async () => {
  await app.close(); await close();
  for (const k of ['PG_PROVIDER', 'PAYAPP_USERID', 'PAYAPP_LINKKEY', 'PAYAPP_LINKVAL', 'PUBLIC_WEB_ORIGIN', 'API_ORIGIN']) delete process.env[k];
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
  it('번호 없으면 결제창을 열지 않음', async () => {
    token = await guest('pay-1');
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
    expect(sent.get('returnurl')).toBe(`https://web.example.kr/pay/return?order=${orderId}`);
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
  });
  it('웹 프리미엄 30일 이용권 → 프리미엄, 연간권 추가 시 기간 이어 붙임, 환불 시 즉시 종료', async () => {
    const t = await guest('pay-3');
    const m = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'premium_monthly', phone: '01055556666' } })).json();
    await feedback(m.id, m.amount);
    let ent = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(ent.premium).toBe(true);
    const days1 = (new Date(ent.subscription.expiresAt).getTime() - Date.now()) / 864e5;
    expect(Math.round(days1)).toBe(30);
    const y = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'premium_yearly', phone: '01055556666' } })).json();
    await feedback(y.id, y.amount);
    ent = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(Math.round((new Date(ent.subscription.expiresAt).getTime() - Date.now()) / 864e5)).toBe(395);
    await feedback(y.id, y.amount, '9'); // 결제사에서 환불
    ent = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(ent.premium).toBe(false);
  });
  it('프리미엄 회원은 회원가(10% 할인)로 주문', async () => {
    const t = await guest('pay-4');
    const m = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'premium_monthly', phone: '01077778888' } })).json();
    await feedback(m.id, m.amount);
    const full = (await app.inject({ url: '/products' })).json().find((p: any) => p.id === 'jeongtong').price;
    const o = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'jeongtong', phone: '01077778888' } })).json();
    expect(o.amount).toBeLessThan(full);
    expect(o.amount).toBe(Math.round((full * 0.9) / 10) * 10);
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

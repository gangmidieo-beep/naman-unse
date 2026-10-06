// 앱 결제(Google Play) 서버 검증 — 가짜 Google 응답으로: 정가·회원가(_m) 상품, 중복 토큰, 구독
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { openDb } from '../src/db/index.ts';
import { buildApp } from '../src/app.ts';

let app: Awaited<ReturnType<typeof buildApp>>['app'];
let close: () => Promise<void>;
const seen: string[] = [];
const fakeGoogle = (async (url: string, init: any = {}) => {
  seen.push(`${init.method ?? 'GET'} ${url}`);
  if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'at', expires_in: 3600 });
  if (url.includes(':acknowledge')) return new Response(null, { status: 204 });
  if (url.includes('/purchases/products/')) return Response.json({ purchaseState: url.includes('tok-cancel') ? 1 : 0, acknowledgementState: 0, orderId: 'GPA.1' });
  if (url.includes('/purchases/subscriptionsv2/')) return Response.json({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', lineItems: [{ productId: 'premium_monthly', expiryTime: new Date(Date.now() + 30 * 864e5).toISOString() }] });
  return new Response('not found', { status: 404 });
}) as unknown as typeof fetch;

beforeAll(async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { client_email: 'test@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  Object.assign(process.env, { GOOGLE_PLAY_PACKAGE_NAME: 'com.namanunse.app', GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: Buffer.from(JSON.stringify(sa)).toString('base64') });
  const o = await openDb({ dir: 'memory' });
  close = o.close;
  ({ app } = await buildApp({ db: o.db, mock: false, http: fakeGoogle }));
}, 120_000);
afterAll(async () => {
  await app.close(); await close();
  delete process.env.GOOGLE_PLAY_PACKAGE_NAME; delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
});
const auth = (t: string) => ({ authorization: `Bearer ${t}` });
const guest = async (d: string) => (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: d } })).json().token as string;
const verify = (t: string, productId: string, purchaseToken: string) => app.inject({ method: 'POST', url: '/billing/google/verify', headers: auth(t), payload: { productId, purchaseToken } });

describe('Google Play 검증', () => {
  it('정가 상품: Google 확인 → 승인(acknowledge) → 결제 완료(정가 기록)', async () => {
    const t = await guest('gp-1');
    const r = await verify(t, 'jeongtong', 'tok-1');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ status: 'paid', productId: 'jeongtong', amount: 29000, channel: 'google' });
    expect(seen.some((x) => x.startsWith('POST') && x.includes('/purchases/products/jeongtong/tokens/tok-1:acknowledge'))).toBe(true);
    expect((await verify(t, 'jeongtong', 'tok-1')).json().id).toBe(r.json().id); // 같은 토큰 다시 와도 한 번만
    expect((await verify(await guest('gp-2'), 'jeongtong', 'tok-1')).statusCode).toBe(409); // 남의 토큰
  });
  it('회원가 상품(<id>_m): 같은 상품으로 기록, 금액은 회원가, Google 에는 _m 으로 조회', async () => {
    const t = await guest('gp-3');
    const r = await verify(t, 'jeongtong_m', 'tok-2');
    expect(r.json()).toMatchObject({ status: 'paid', productId: 'jeongtong', amount: 26100, discount: 2900 });
    expect(seen.some((x) => x.includes('/purchases/products/jeongtong_m/tokens/tok-2'))).toBe(true);
    expect((await verify(t, 'premium_monthly_m', 'tok-3')).statusCode).toBe(404);
  });
  it('취소된 결제는 거부', async () => {
    expect((await verify(await guest('gp-4'), 't_wealth', 'tok-cancel')).statusCode).toBe(402);
  });
  it('구독: 활성 확인 → 프리미엄', async () => {
    const t = await guest('gp-5');
    expect((await verify(t, 'premium_monthly', 'tok-sub')).json().status).toBe('paid');
    expect((await app.inject({ url: '/me/entitlements', headers: auth(t) })).json().premium).toBe(true);
  });
});

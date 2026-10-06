// 앱 결제 — Google Play 서버 검증(androidpublisher v3 REST). 서비스 계정 JSON 은 GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 (대표님 Play Console 에 연결된 계정).
// 패키지 이름: GOOGLE_PLAY_PACKAGE_NAME. RTDN(Pub/Sub push) 은 Google 이 서명한 토큰의 audience 를 RTDN_PUBSUB_AUDIENCE 와 대조한다.
import { SignJWT, importPKCS8, jwtVerify, createRemoteJWKSet } from 'jose';

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
export const playConfigured = () => !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 && process.env.GOOGLE_PLAY_PACKAGE_NAME);
const pkg = () => process.env.GOOGLE_PLAY_PACKAGE_NAME ?? '';

let cached: { token: string; exp: number } | null = null;
async function accessToken(http: typeof fetch): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const sa = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ?? '', 'base64').toString('utf8')) as { client_email: string; private_key: string };
  const key = await importPKCS8(sa.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer(sa.client_email).setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt().setExpirationTime('1h').sign(key);
  const r = await http('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!r.ok) throw Object.assign(new Error('Google 인증 실패'), { status: 502 });
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}
async function call(http: typeof fetch, path: string, method = "GET"): Promise<any> {
  const r = await http(`${API}/${pkg()}/${path}`, { method, headers: { authorization: `Bearer ${await accessToken(http)}` } });
  if (!r.ok) throw Object.assign(new Error(`Google Play 조회 실패 ${r.status}`), { status: r.status === 404 || r.status === 400 ? 400 : 502 });
  return method === 'GET' ? r.json() : null;
}

/* ---------- 상태 해석 (순수 함수 — 테스트 대상) ---------- */
export type SubStatus = 'active' | 'grace' | 'on_hold' | 'canceled' | 'expired';
// subscriptionsv2.subscriptionState → 우리 상태. canceled 는 "자동갱신 해지, 만료일까지 이용 가능".
export function mapSubscriptionState(state: string): SubStatus {
  switch (state) {
    case 'SUBSCRIPTION_STATE_ACTIVE': return 'active';
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD': return 'grace';
    case 'SUBSCRIPTION_STATE_ON_HOLD':
    case 'SUBSCRIPTION_STATE_PAUSED': return 'on_hold';
    case 'SUBSCRIPTION_STATE_CANCELED': return 'canceled';
    default: return 'expired'; // EXPIRED, PENDING_PURCHASE_CANCELED, UNSPECIFIED
  }
}
// 이용 가능 여부: 해지했어도 만료일 전이면 이용 가능, 결제 실패 유예기간도 이용 가능
export const subscriptionUsable = (s: SubStatus, expiresAt: Date, now = new Date()) =>
  (s === 'active' || s === 'grace' || s === 'canceled') && expiresAt > now;

export type ProductCheck = { ok: boolean; reason?: string; orderId?: string; acknowledged: boolean };
export function readProductPurchase(p: { purchaseState?: number; acknowledgementState?: number; orderId?: string; consumptionState?: number }): ProductCheck {
  if (p.purchaseState !== 0) return { ok: false, reason: p.purchaseState === 1 ? '취소된 결제예요' : '결제 대기 중이에요', acknowledged: p.acknowledgementState === 1 };
  return { ok: true, orderId: p.orderId, acknowledged: p.acknowledgementState === 1 };
}
export type SubCheck = { status: SubStatus; expiresAt: Date; productId: string; linkedPurchaseToken?: string; acknowledged: boolean; orderId?: string };
export function readSubscription(s: any): SubCheck {
  const li = (s.lineItems ?? [])[0] ?? {};
  return {
    status: mapSubscriptionState(s.subscriptionState),
    expiresAt: new Date(li.expiryTime ?? 0),
    productId: li.productId ?? '',
    linkedPurchaseToken: s.linkedPurchaseToken,
    acknowledged: s.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
    orderId: s.latestOrderId,
  };
}

/* ---------- Google 호출 ---------- */
export async function verifyProduct(productId: string, token: string, http: typeof fetch = fetch): Promise<ProductCheck> {
  const p = await call(http, `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`);
  const c = readProductPurchase(p);
  if (c.ok && !c.acknowledged) await call(http, `purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, 'POST'); // 3일 안에 안 하면 자동 환불
  return c;
}
export async function verifySubscription(token: string, http: typeof fetch = fetch): Promise<SubCheck> {
  const c = readSubscription(await call(http, `purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`));
  if (!c.acknowledged && (c.status === 'active' || c.status === 'grace')) await call(http, `purchases/subscriptions/${encodeURIComponent(c.productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, 'POST');
  return c;
}

// RTDN: Pub/Sub push 본문 → { purchaseToken, kind }. 서명 토큰 audience 검증.
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyPubsubToken(authHeader: string | undefined): Promise<boolean> {
  const aud = process.env.RTDN_PUBSUB_AUDIENCE;
  if (!aud) return false;
  try {
    await jwtVerify((authHeader ?? '').replace(/^Bearer\s+/i, ''), GOOGLE_JWKS, { audience: aud, issuer: ['https://accounts.google.com', 'accounts.google.com'] });
    return true;
  } catch { return false; }
}
export function readRtdn(body: any): { kind: 'subscription' | 'product' | 'test' | 'unknown'; purchaseToken?: string; productId?: string; type?: number } {
  try {
    const d = JSON.parse(Buffer.from(body?.message?.data ?? '', 'base64').toString('utf8'));
    if (d.testNotification) return { kind: 'test' };
    if (d.subscriptionNotification) return { kind: 'subscription', purchaseToken: d.subscriptionNotification.purchaseToken, productId: d.subscriptionNotification.subscriptionId, type: d.subscriptionNotification.notificationType };
    if (d.oneTimeProductNotification) return { kind: 'product', purchaseToken: d.oneTimeProductNotification.purchaseToken, productId: d.oneTimeProductNotification.sku, type: d.oneTimeProductNotification.notificationType };
  } catch { /* 형식 오류 */ }
  return { kind: 'unknown' };
}

// 결제 인터페이스 — 화면은 이것만 부른다. 구현체: mock(시안·테스트), web(PayApp), google-play(10 단계에서 네이티브 연결).
import { MOCK_MODE } from '../lib/api';
import { useApp } from '../store/app';

export type PayResult = { status: 'paid' | 'cancelled' | 'failed' | 'redirect'; orderId: string; message?: string; code?: string };
export type PayMethod = { id: string; label: string };
export type PayOpts = { method?: string; amount?: number; phone?: string };
export interface PaymentProvider {
  id: 'mock' | 'web' | 'google-play' | 'unavailable';
  needsPhone: boolean; // PayApp 은 결제 문자 수신 번호가 필수
  methods(): PayMethod[];
  purchase(productId: string, profileId: string, opts?: PayOpts): Promise<PayResult>;
  subscribe(planId: string, opts?: PayOpts): Promise<PayResult>;
  restore(): Promise<string[]>; // 보유 상품 id 목록
  memberPriceOk?(productId: string): boolean; // 회원가로 결제할 수 있는지(Google Play: 회원가 상품 "<id>_m" 이 등록돼 있을 때만)
}

const orderId = () => `O${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// mock: 1.5초 뒤 결제 완료. 테스트용으로 ?pay=cancel / ?pay=fail 을 주소에 붙이면 그 결과를 돌려준다.
export const mockProvider: PaymentProvider = {
  id: 'mock',
  needsPhone: false,
  methods: () => [
    { id: 'card', label: '신용·체크카드' },
    { id: 'kakaopay', label: '카카오페이' },
    { id: 'naverpay', label: '네이버페이' },
    { id: 'transfer', label: '계좌이체' },
  ],
  async purchase() {
    await wait(1500);
    const force = new URLSearchParams(location.search).get('pay');
    if (force === 'cancel') return { status: 'cancelled', orderId: '' };
    if (force === 'fail') return { status: 'failed', orderId: '', message: '결제가 승인되지 않았어요' };
    return { status: 'paid', orderId: orderId() };
  },
  async subscribe() { await wait(1500); return { status: 'paid', orderId: orderId() }; },
  async restore() { await wait(600); return []; },
};

/* ---------- 서버 통신 ---------- */
// 로그인 계정 토큰, 없으면 기기 게스트 토큰(결제 때 서버가 주문 주인을 확인하는 용도)
const GUEST = 'naman-guest';
const readGuest = (): { token?: string; deviceId?: string } => { try { return JSON.parse(localStorage.getItem(GUEST) || '{}') ?? {}; } catch { return {}; } };
export async function userToken(): Promise<string> {
  const acc = useApp.getState().account;
  if (acc?.token) return acc.token;
  const g = readGuest();
  if (g.token) return g.token;
  const r = await fetch(`${__API_ORIGIN__}/auth/guest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceId: g.deviceId, platform: 'web' }) });
  const j = await r.json();
  try { localStorage.setItem(GUEST, JSON.stringify({ token: j.token, deviceId: j.deviceId })); } catch { /* 저장소 막힘 */ }
  return j.token;
}
export async function apiAuth<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await userToken();
  const r = await fetch(`${__API_ORIGIN__}${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error ?? '잠시 후 다시 시도해 주세요'), { code: j.code });
  return j as T;
}

// 카카오톡·인스타그램 안 브라우저는 카드 결제창이 막혀서 카카오페이로 연다
export const isInAppBrowser = () => /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp/i.test(navigator.userAgent);

export const PENDING = 'naman-pay-pending';
export type Pending = { orderId: string; productId: string; profileId: string; kind: 'reading' | 'talisman' | 'subscription'; price: number; at: number };

/* ---------- 웹: PayApp ---------- */
// 풀이를 서버가 쓰려면 사주 정보가 서버에 있어야 함 → 결제 전에 해당 프로필을 올림(이미 있으면 갱신)
export async function syncProfiles(profileId: string) {
  const { profiles, mainId } = useApp.getState();
  for (const id of profileId.split('+').filter(Boolean)) {
    const x = profiles.find((p) => p.id === id);
    if (x) await apiAuth('/profiles', { method: 'POST', body: JSON.stringify({ ...x, isMain: x.id === mainId }) }).catch(() => {});
  }
}
async function payapp(productId: string, profileId: string, kind: Pending['kind'], opts: PayOpts = {}): Promise<PayResult> {
  try {
    if (profileId) await syncProfiles(profileId);
    const o = await apiAuth<{ id: string; amount: number; payUrl?: string; status: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify({ productId, profileId, method: opts.method, phone: opts.phone, channel: 'web', inApp: isInAppBrowser() }),
    });
    if (o.status === 'paid') return { status: 'paid', orderId: o.id }; // 서버가 mock 모드
    if (!o.payUrl) return { status: 'failed', orderId: o.id, message: '결제창을 열지 못했어요' };
    const p: Pending = { orderId: o.id, productId, profileId, kind, price: o.amount, at: Date.now() };
    try { localStorage.setItem(PENDING, JSON.stringify(p)); } catch { /* */ }
    location.assign(o.payUrl); // PayApp 결제창 → 끝나면 /pay/return?order= 으로 돌아옴
    return { status: 'redirect', orderId: o.id };
  } catch (e: any) {
    return { status: 'failed', orderId: '', message: e.message, code: e.code };
  }
}
export const webProvider: PaymentProvider = {
  id: 'web',
  needsPhone: true,
  methods: () => [
    { id: 'card', label: '신용·체크카드' },
    { id: 'kakaopay', label: '카카오페이' },
    { id: 'naverpay', label: '네이버페이' },
  ],
  purchase: (productId, profileId, opts) => payapp(productId, profileId, productId.startsWith('ts_') ? 'talisman' : 'reading', opts),
  subscribe: (planId, opts) => payapp(planId, '', 'subscription', opts),
  async restore() {
    try { return (await apiAuth<{ owned: { productId: string }[] }>('/me/entitlements')).owned.map((x) => x.productId); } catch { return []; }
  },
};

// 앱 안(실결제 모드)에서는 Google Play 만 허용(웹 결제 안내·링크 노출 금지). Play 키가 서버에 없으면 서버가 "준비 중"으로 막는다.
export const unavailable: PaymentProvider = {
  id: 'unavailable',
  needsPhone: false,
  methods: () => [{ id: 'google', label: 'Google Play 결제' }],
  async purchase() { return { status: 'failed', orderId: '', message: '앱 결제를 준비하고 있어요. 조금만 기다려 주세요.' }; },
  async subscribe() { return { status: 'failed', orderId: '', message: '앱 결제를 준비하고 있어요. 조금만 기다려 주세요.' }; },
  async restore() { return []; },
};

export const isNativeApp = () => !!(window as any).Capacitor?.isNativePlatform?.();
let gp: PaymentProvider | null = null;
// 앱용 Google Play 구현은 앱에서만 불러옴(웹 번들에 결제 플러그인 코드가 섞이지 않게)
export async function loadGooglePlay() { if (isNativeApp() && !MOCK_MODE && !gp) gp = (await import('./google-play')).googlePlayProvider; }
export function getPayments(): PaymentProvider {
  if (MOCK_MODE) return mockProvider;
  return isNativeApp() ? gp ?? unavailable : webProvider;
}

// 결제 문자 받을 번호 — 한 번 입력하면 이 기기에 기억
const PHONE = 'naman-pay-phone';
export const savedPhone = () => { try { return localStorage.getItem(PHONE) ?? ''; } catch { return ''; } };
export const savePhone = (v: string) => { try { localStorage.setItem(PHONE, v); } catch { /* */ } };
export const phoneOk = (v: string) => /^01[016789]\d{7,8}$/.test(v.replace(/\D/g, ''));

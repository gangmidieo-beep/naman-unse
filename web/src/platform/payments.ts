// 결제 인터페이스 — 화면은 이것만 부른다. 구현체: mock(시안·테스트), web(PayApp), google-play(10 단계에서 네이티브 연결).
import { MOCK_MODE } from '../lib/api';
import { useApp, type MyTalisman, type Profile, type Purchase } from '../store/app';

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
export async function apiAuth<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = await userToken();
  const r = await fetch(`${__API_ORIGIN__}${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...init.headers } });
  const j = await r.json().catch(() => ({}));
  // 게스트 표시(토큰)는 30일이면 만료 → 같은 기기 번호로 다시 받아 한 번 더(같은 게스트라 산 풀이가 그대로 보임)
  if (r.status === 401 && !retried && !useApp.getState().account?.token && readGuest().token === token) {
    try { localStorage.setItem(GUEST, JSON.stringify({ deviceId: readGuest().deviceId })); } catch { /* */ }
    return apiAuth<T>(path, init, true);
  }
  // 로그인이 만료(30일)되면 화면엔 로그인된 것처럼 보이는데 아무것도 안 되던 문제 → 로그아웃 처리하고 다시 로그인 안내
  if (r.status === 401 && useApp.getState().account?.token === token) {
    useApp.getState().signOut(true); // 사주 정보는 남김(다시 로그인하면 계정으로 다시 올라감)
    throw Object.assign(new Error('로그인이 만료됐어요. 다시 로그인해 주세요.'), { code: 'login_expired' });
  }
  if (!r.ok) throw Object.assign(new Error(j.error ?? '잠시 후 다시 시도해 주세요'), { code: j.code, status: r.status });
  return j as T;
}

// 카카오톡·인스타그램 안 브라우저는 카드 결제창이 막혀서 카카오페이로 연다
export const isInAppBrowser = () => /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp/i.test(navigator.userAgent);

export const PENDING = 'naman-pay-pending';
export type Pending = { orderId: string; productId: string; profileId: string; kind: 'reading' | 'talisman' | 'subscription'; price: number; at: number };

/* ---------- 웹: PayApp ---------- */
// 풀이를 서버가 쓰려면 사주 정보가 서버에 있어야 함 → 결제 전에 해당 프로필을 올림(이미 있으면 갱신)
// 실패하면 결제를 멈춘다(예전엔 실패를 무시하고 결제 → 서버에 사주가 없어 풀이를 못 씀). 서버가 새 id 를 주면(같은 폰을 다른 계정이 쓴 경우) 그 id 로 바꿔서 돌려줌
export async function syncProfiles(profileId: string): Promise<string> {
  const out: string[] = [];
  for (const id of profileId.split('+').filter(Boolean)) {
    const { profiles, mainId } = useApp.getState();
    const x = profiles.find((p) => p.id === id);
    if (!x) { out.push(id); continue; }
    const v = await apiAuth<{ id: string }>('/profiles', { method: 'POST', body: JSON.stringify({ ...x, isMain: x.id === mainId }) });
    if (v.id && v.id !== x.id) useApp.setState((s) => ({ profiles: s.profiles.map((p) => (p.id === x.id ? { ...p, id: v.id } : p)), mainId: s.mainId === x.id ? v.id : s.mainId }));
    out.push(v.id || id);
  }
  return out.join('+');
}
/** 계정에 저장된 사주를 이 기기로(다른 기기에서 저장한 사주·다시 로그인했을 때) */
export async function pullProfiles() {
  const list = await apiAuth<any[]>('/profiles').catch(() => null);
  if (!Array.isArray(list)) return;
  const mapped: Profile[] = list.map((x) => ({ id: x.id, name: x.name, gender: x.gender, year: x.birthYear, month: x.birthMonth, day: x.birthDay, calendar: x.calendar, leap: !!x.leap, hour: x.birthHour ?? null, ...(x.relation ? { relation: x.relation } : {}), ...(x.bloodType ? { bloodType: x.bloodType } : {}), ...(x.mbti ? { mbti: x.mbti } : {}) }));
  useApp.setState((s) => {
    const have = new Set(s.profiles.map((p) => p.id));
    const profiles = [...s.profiles, ...mapped.filter((p) => !have.has(p.id))];
    const main = list.find((x) => x.isMain)?.id;
    return { profiles, mainId: s.mainId && profiles.some((p) => p.id === s.mainId) ? s.mainId : main ?? profiles[0]?.id ?? null };
  });
}
/** 로그아웃 전에 이 기기 사주를 계정에 올려 둠(로그인 중에 새로 저장한 가족 사주가 사라지지 않게). 실패해도 진행 */
export async function uploadAllProfiles() {
  const { profiles, mainId, account } = useApp.getState();
  if (!account?.token) return;
  for (const x of profiles) await apiAuth('/profiles', { method: 'POST', body: JSON.stringify({ ...x, isMain: x.id === mainId }) }).catch(() => null);
}
/** 사주 지우기를 계정에도(다른 기기·다시 로그인 때 되살아나지 않게). 실패해도 이 기기에서는 지움 */
// 반환: 지우면 안 되는 이유(쓰는 중인 풀이가 있음) — 없으면 null
export async function deleteProfileOnServer(id: string): Promise<string | null> {
  try { await apiAuth(`/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }); return null; }
  catch (e: any) { return e?.code === 'profile_in_use' ? e.message : null; }
}
async function payapp(productId: string, profileId: string, kind: Pending['kind'], opts: PayOpts = {}): Promise<PayResult> {
  try {
    if (profileId) profileId = await syncProfiles(profileId);
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
    const e = await syncEntitlements(); // 운세함에 빠진 풀이·부적도 함께 채움
    return (e?.owned ?? []).map((x) => x.productId);
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

// 프리미엄 여부·기간·자동결제는 서버가 기준(이용권 만료·환불·해지 반영)
type Owned = { productId: string; orderId: string; profileId?: string | null; kind?: string; amount?: number; createdAt?: string };
type Ent = { premium: boolean; subscription: { plan: 'monthly' | 'yearly'; expiresAt: string; autoRenew?: boolean; channel?: string } | null; owned?: Owned[]; talismans?: MyTalisman[] };
let syncing: Promise<Ent | null> | null = null;
export function syncEntitlements(): Promise<Ent | null> {
  syncing ??= doSync().finally(() => { syncing = null; });
  return syncing;
}
/* 서버가 기준 — 운세함(서재·부적함·결제 내역)을 서버 주문으로 맞춘다(2026-10-29 대표님 요청).
   - 모바일·웹 어디서 로그인해도 같은 목록 / 환불·삭제한 주문은 빠짐 / 같은 주문이 두 번 보이지 않음
   - 이 기기에서만 만든 부적(예전 버전)은 서버에 올려서 다른 기기에서도 보이게 */
async function doSync(): Promise<Ent | null> {
  const e = await apiAuth<Ent>('/me/entitlements').catch(() => null);
  if (!e) return null;
  const s = e.subscription;
  useApp.setState({ plan: e.premium ? s?.plan ?? 'monthly' : null, planUntil: e.premium && s ? s.expiresAt.slice(0, 10) : null, planAuto: !!(e.premium && s?.autoRenew) });
  if (!e.owned) return e; // 예전 서버 — 운세함은 건드리지 않음
  const st = useApp.getState();
  const prev = new Map(st.purchases.map((x) => [x.orderId, x]));
  const purchases: Purchase[] = e.owned.filter((o) => o.kind && o.kind !== 'subscription').map((o) => ({
    orderId: o.orderId, productId: o.productId, profileId: o.profileId ?? prev.get(o.orderId)?.profileId ?? '', price: o.amount ?? prev.get(o.orderId)?.price ?? 0,
    createdAt: o.createdAt ?? prev.get(o.orderId)?.createdAt ?? new Date().toISOString(), kind: (o.kind === 'talisman' ? 'talisman' : 'reading') as 'talisman' | 'reading', status: 'paid' as const,
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // 방금 결제한 주문은 서버 목록이 늦게 따라올 수 있다(결제 확인과 동기화가 엇갈림) → 15분 안의 이 기기 주문은 남겨 둠
  const fresh = st.purchases.filter((x) => x.kind !== 'subscription' && !purchases.some((y) => y.orderId === x.orderId) && x.status === 'paid' && Date.now() - Date.parse(x.createdAt) < 15 * 60_000);
  purchases.unshift(...fresh);
  const owned = new Set(purchases.map((x) => x.orderId));
  const server = [...new Map((e.talismans ?? []).map((t) => [t.orderId, t])).values()]; // 같은 주문 부적은 하나만
  const onServer = new Set(server.map((t) => t.orderId));
  const localOnly = st.talismans.filter((t) => owned.has(t.orderId) && !onServer.has(t.orderId));
  for (const t of localOnly) void apiAuth('/me/talismans', { method: 'POST', body: JSON.stringify(t) }).catch(() => {});
  useApp.setState({ purchases, talismans: [...server, ...localOnly.filter((t, i, a) => a.findIndex((x) => x.orderId === t.orderId) === i)] });
  return e;
}
/** 운세함에서 지우기 — 서버에 숨김 표시(모든 기기 반영) 후 이 기기 목록에서도 뺌 */
export async function hideOrder(orderId: string) {
  await apiAuth(`/me/orders/${encodeURIComponent(orderId)}/hide`, { method: 'POST', body: '{}' });
  useApp.getState().removeOrder(orderId);
}
/** 완성한 부적을 계정에 보관(실패해도 이 기기에는 남고, 다음 동기화 때 다시 올림) */
export const saveTalismanToServer = (t: MyTalisman) => apiAuth('/me/talismans', { method: 'POST', body: JSON.stringify(t) }).catch(() => null);
/** 로그인 연장 — 하루 한 번(앱을 열 때·화면으로 돌아올 때). 쓰는 사람은 30일 만료로 갑자기 로그아웃되지 않음 */
const REFRESHED = 'naman-auth-refreshed';
export async function refreshLogin() {
  const acc = useApp.getState().account;
  if (MOCK_MODE || !acc?.token) return;
  try { if (Date.now() - +(localStorage.getItem(REFRESHED) || 0) < 86400_000) return; } catch { /* */ }
  const r = await fetch(`${__API_ORIGIN__}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${acc.token}` }, body: '{}' }).catch(() => null);
  if (!r) return;
  if (r.status === 401) { useApp.getState().signOut(true); return; }
  const j = await r.json().catch(() => null);
  if (j?.token && useApp.getState().account?.token === acc.token) useApp.getState().setAccount({ ...acc, token: j.token });
  try { localStorage.setItem(REFRESHED, String(Date.now())); } catch { /* */ }
}
/** 이 기기의 게스트 토큰(로그인 직후 게스트 기록을 계정으로 합칠 때 씀) */
export const guestToken = () => readGuest().token ?? null;
// 웹 월 자동결제 해지 — 다음 달부터 결제되지 않고, 이미 낸 기간까지는 프리미엄 유지
export async function cancelAutoRenew(): Promise<{ ok: boolean; message?: string; code?: string }> {
  if (MOCK_MODE) { useApp.setState({ planAuto: false }); return { ok: true }; }
  try {
    await apiAuth('/me/subscription/cancel', { method: 'POST', body: '{}' });
    await syncEntitlements();
    return { ok: true };
  } catch (e: any) { return { ok: false, message: e.message, code: e.code }; }
}

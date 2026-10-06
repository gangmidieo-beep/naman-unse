// 앱 결제 — Google Play (cordova-plugin-purchase v13, 앱 안에서만 window.CdvPurchase 가 있음).
// 흐름: 상품 등록 → 구매 → 승인(approved) → 서버가 Google 에 재확인(/billing/google/verify) → finish(소모성 상품은 다시 살 수 있게 소비).
// Play Console 상품 id = brand.config 상품 id 그대로. 풀이·부적은 같은 사람이 여러 번 살 수 있어 "소모성", 프리미엄은 구독.
// 프리미엄 회원가(10% 할인)는 Play 상품 하나에 가격이 하나뿐이라 "<id>_m" 상품을 따로 등록(docs/스토어등록.md). 없으면 정가 상품으로 결제.
import type { PaymentProvider, PayOpts, PayResult } from './payments';
import { apiAuth, syncProfiles } from './payments';
import { ALL, BRAND } from '../lib/catalog';

type Store = any;
let ready: Promise<Store | null> | null = null;
let loaded: Store | null = null; // 초기화가 끝난 스토어(화면이 회원가 상품 유무를 바로 알아야 해서)
const waiters = new Map<string, (r: PayResult) => void>();
const profileFor = new Map<string, string>(); // Play 상품 id → 풀이 받을 프로필(서버 주문에 기록)
const MEMBER = '_m'; // 회원가 상품 접미사(서버도 같은 규칙)

function store(): Promise<Store | null> {
  ready ??= new Promise((resolve) => {
    const start = () => {
      const C = (window as any).CdvPurchase;
      if (!C) return resolve(null);
      const s: Store = C.store;
      const subs = new Set(['premium_monthly', 'premium_yearly']);
      const paid = ALL.filter((p) => p.price > 0 && !subs.has(p.id));
      s.register([
        ...paid.flatMap((p) => [p.id, `${p.id}${MEMBER}`]).map((id) => ({ id, platform: C.Platform.GOOGLE_PLAY, type: C.ProductType.CONSUMABLE })),
        ...[BRAND.subscription.monthly, BRAND.subscription.yearly].map((p: any) => ({ id: p.id, platform: C.Platform.GOOGLE_PLAY, type: C.ProductType.PAID_SUBSCRIPTION })),
      ]);
      s.when()
        .approved(async (t: any) => {
          const productId = t.products?.[0]?.id;
          const purchaseToken = t.purchaseId; // Google Play 의 purchaseToken
          const done = waiters.get(productId);
          try {
            const o = await apiAuth<{ id: string; status: string }>('/billing/google/verify', { method: 'POST', body: JSON.stringify({ productId, purchaseToken, profileId: profileFor.get(productId) }) });
            await t.finish();
            done?.({ status: o.status === 'paid' ? 'paid' : 'failed', orderId: o.id });
          } catch (e: any) {
            done?.({ status: 'failed', orderId: '', message: e.message });
          } finally { waiters.delete(productId); }
        });
      s.error((e: any) => { for (const [id, w] of waiters) { w({ status: e?.code === C.ErrorCode.PAYMENT_CANCELLED ? 'cancelled' : 'failed', orderId: '', message: e?.message }); waiters.delete(id); } });
      s.initialize([C.Platform.GOOGLE_PLAY]).then(() => { loaded = s; resolve(s); }, () => resolve(null));
    };
    if ((window as any).CdvPurchase) start();
    else document.addEventListener('deviceready', start, { once: true });
  });
  return ready;
}

async function buy(baseId: string, profileId = '', opts: PayOpts = {}): Promise<PayResult> {
  const s = await store();
  if (!s) return { status: 'failed', orderId: '', message: 'Google Play 결제를 불러오지 못했어요' };
  const base = ALL.find((p) => p.id === baseId);
  // 화면이 회원가로 계산했으면 회원가 상품으로(등록 안 돼 있으면 정가 상품 — 결제 전 Google 창에 실제 금액이 표시됨)
  const member = !!base && !!opts.amount && opts.amount < base.price && !!s.get(`${baseId}${MEMBER}`)?.getOffer();
  const productId = member ? `${baseId}${MEMBER}` : baseId;
  if (profileId) { profileFor.set(productId, profileId); await syncProfiles(profileId); }
  const offer = s.get(productId)?.getOffer();
  if (!offer) return { status: 'failed', orderId: '', message: '판매 준비 중인 상품이에요' };
  return new Promise((resolve) => {
    waiters.set(productId, resolve);
    offer.order().then((err: any) => { if (err) { waiters.delete(productId); resolve({ status: err.code === (window as any).CdvPurchase.ErrorCode.PAYMENT_CANCELLED ? 'cancelled' : 'failed', orderId: '', message: err.message }); } });
  });
}

export const googlePlayProvider: PaymentProvider = {
  id: 'google-play',
  needsPhone: false,
  methods: () => [{ id: 'google', label: 'Google Play 결제' }],
  purchase: (productId, profileId, opts) => buy(productId, profileId, opts),
  memberPriceOk: (productId) => !!loaded?.get(`${productId}${MEMBER}`)?.getOffer(),
  subscribe: (planId) => buy(planId),
  async restore() {
    const s = await store();
    if (s) await s.restorePurchases().catch(() => {});
    try { return (await apiAuth<{ owned: { productId: string }[] }>('/me/entitlements')).owned.map((x) => x.productId); } catch { return []; }
  },
};

// 결제 인터페이스 — 화면은 이것만 부른다. 구현체: mock(지금), web-pg(09 단계), google-play(10 단계).
import { MOCK_MODE } from '../lib/api';

export type PayResult = { status: 'paid' | 'cancelled' | 'failed'; orderId: string; message?: string };
export type PayMethod = { id: string; label: string };
export interface PaymentProvider {
  id: 'mock' | 'web-pg' | 'google-play';
  methods(): PayMethod[];
  purchase(productId: string, profileId: string, opts?: { method?: string; amount?: number }): Promise<PayResult>;
  subscribe(planId: string): Promise<PayResult>;
  restore(): Promise<string[]>; // 보유 상품 id 목록
}

const orderId = () => `O${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// mock: 1.5초 뒤 결제 완료. 테스트용으로 ?pay=cancel / ?pay=fail 을 주소에 붙이면 그 결과를 돌려준다.
export const mockProvider: PaymentProvider = {
  id: 'mock',
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

export const isNativeApp = () => !!(window as any).Capacitor?.isNativePlatform?.();
export function getPayments(): PaymentProvider {
  if (MOCK_MODE) return mockProvider;
  return mockProvider; // 09·10 단계에서 web-pg / google-play 로 교체
}

// 광고 정책(대표님 9/30): 앱 = AdMob, 웹 = 구글 애드센스, 프리미엄 = 광고 0.
// Capacitor 앱(WebView) 안에서는 애드센스 스크립트를 절대 넣지 않는다(정책 위반) — adProvider 한 곳에서만 판단.
import { api, MOCK_MODE } from './api';

export type AdProvider = 'admob' | 'adsense' | 'placeholder' | 'none';
export const isNativeApp = () => typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

export function adProvider({ premium, native, adsenseClient }: { premium: boolean; native: boolean; adsenseClient: string }): AdProvider {
  if (premium) return 'none';
  if (native) return 'admob';
  return adsenseClient ? 'adsense' : 'placeholder';
}

let loaded = false;
export function loadAdSense(client: string) {
  if (loaded || isNativeApp() || !client) return; // 이중 안전장치
  loaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

// 관리자 광고 관리의 위치별 ON/OFF · 애드센스 슬롯 ID (서버 ad_settings). MOCK 이면 전부 켜짐.
type SlotCfg = { slot: string; enabled: boolean; config: { adsenseSlot?: string } | null };
let cfg: Promise<Record<string, SlotCfg>> | null = null;
export function adSlots() {
  cfg ??= MOCK_MODE ? Promise.resolve({}) : api<SlotCfg[]>('/ads').then((l) => Object.fromEntries(l.map((x) => [x.slot, x]))).catch(() => ({}));
  return cfg;
}

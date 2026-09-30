// 이벤트 추적 훅 자리 — 지금은 console + localStorage 로그. 08 단계에서 서버(/events)로 보낸다.
export type EventName = 'product_view' | 'checkout_open' | 'pay_start' | 'pay_success' | 'pay_cancel' | 'pay_fail' | 'share' | 'page_view'
  | 'share_click' | 'share_link_open' | 'share_to_signup' | 'share_to_purchase' | 'content_view' | 'dream_search' | 'ad_rewarded' | 'login';
const KEY = 'naman-unse-events';
export function track(name: EventName, props: Record<string, unknown> = {}) {
  const e = { name, props, at: new Date().toISOString() };
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    list.push(e);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-500)));
  } catch { /* 저장 공간 없음 — 무시 */ }
  if (import.meta.env.DEV) console.debug('[track]', name, props);
}

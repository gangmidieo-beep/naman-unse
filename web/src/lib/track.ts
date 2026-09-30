// 이벤트 추적 — MOCK_MODE 면 localStorage 로그만, 서버 연결 시 5초마다(또는 화면을 떠날 때) /events 로 묶어서 보낸다.
// 첫 방문의 utm·referrer 는 기억해 두었다가 모든 이벤트에 붙인다(유입 경로 통계).
export type EventName = 'product_view' | 'checkout_open' | 'pay_start' | 'pay_success' | 'pay_cancel' | 'pay_fail' | 'share' | 'page_view'
  | 'share_click' | 'share_link_open' | 'share_to_signup' | 'share_to_purchase' | 'content_view' | 'dream_search' | 'ad_rewarded' | 'login';
const KEY = 'naman-unse-events';
const MOCK = __MOCK_MODE__;
const API = __API_ORIGIN__;

const session = (() => {
  try {
    const s = sessionStorage.getItem('naman-session') ?? Math.random().toString(36).slice(2);
    sessionStorage.setItem('naman-session', s);
    return s;
  } catch { return 'nosession'; }
})();
const attribution = (() => {
  try {
    const saved = localStorage.getItem('naman-utm');
    if (saved) return JSON.parse(saved);
    const q = new URLSearchParams(location.search);
    const a = { utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'), utm_campaign: q.get('utm_campaign'), referrer: document.referrer || null };
    localStorage.setItem('naman-utm', JSON.stringify(a));
    return a;
  } catch { return {}; }
})();

const queue: Record<string, unknown>[] = [];
function flush() {
  if (!queue.length || MOCK || !API) return;
  const events = queue.splice(0, 50);
  const token = (() => { try { return JSON.parse(localStorage.getItem('naman-unse') || '{}').state?.account?.token; } catch { return undefined; } })();
  fetch(`${API}/events`, { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ events }) }).catch(() => { queue.unshift(...events); });
}
if (!MOCK && typeof window !== 'undefined') {
  setInterval(flush, 5000);
  addEventListener('pagehide', flush);
}

export function track(name: EventName, props: Record<string, unknown> = {}) {
  const e = { name, props, at: new Date().toISOString() };
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    list.push(e);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-500)));
  } catch { /* 저장 공간 없음 — 무시 */ }
  queue.push({ ...e, sessionId: session, platform: (window as any).Capacitor ? 'android' : 'web', ...attribution });
  if (import.meta.env.DEV) console.debug('[track]', name, props);
}

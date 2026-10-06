import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/pages.css';
import './styles/v3.css';
import { App } from './App';
import { loadServerCatalog } from './lib/catalog';
import { useApp } from './store/app';
import { apiAuth } from './platform/payments';

if (!__MOCK_MODE__ && __API_ORIGIN__) {
  await loadServerCatalog(__API_ORIGIN__);
  // 프리미엄 여부는 서버가 기준(이용권 만료·환불 반영). 기존에 토큰이 있는 사용자만 조회(첫 방문자는 게스트 가입을 미룸)
  void (async () => {
    const hasToken = (() => { try { return !!useApp.getState().account?.token || !!JSON.parse(localStorage.getItem('naman-guest') || '{}').token; } catch { return false; } })();
    if (!hasToken) return;
    const e = await apiAuth<{ premium: boolean; subscription: { plan: 'monthly' | 'yearly'; expiresAt: string } | null }>('/me/entitlements').catch(() => null);
    if (!e) return;
    useApp.setState({ plan: e.premium ? e.subscription?.plan ?? 'monthly' : null, planUntil: e.premium && e.subscription ? e.subscription.expiresAt.slice(0, 10) : null });
  })();
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

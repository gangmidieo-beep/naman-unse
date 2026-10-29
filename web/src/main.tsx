import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/pages.css';
import './styles/v3.css';
import './styles/v4.css';
import './styles/fun.css';
import { App } from './App';
import { loadServerCatalog } from './lib/catalog';
import { useApp } from './store/app';
import { refreshLogin, syncEntitlements } from './platform/payments';

if (!__MOCK_MODE__ && __API_ORIGIN__) {
  await loadServerCatalog(__API_ORIGIN__);
  // 프리미엄 여부는 서버가 기준(이용권 만료·환불 반영). 기존에 토큰이 있는 사용자만 조회(첫 방문자는 게스트 가입을 미룸)
  void (async () => {
    const hasToken = (() => { try { return !!useApp.getState().account?.token || !!JSON.parse(localStorage.getItem('naman-guest') || '{}').token; } catch { return false; } })();
    if (!hasToken) return;
    await refreshLogin();
    await syncEntitlements();
  })();
  // 다른 기기(웹·모바일)에서 산 것도 바로 보이게 — 앱/탭으로 돌아올 때마다 서버 기준으로 다시 맞춤(30초에 한 번까지)
  let last = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - last < 30_000) return;
    last = Date.now();
    const st = useApp.getState();
    if (st.account?.token) void refreshLogin().then(() => syncEntitlements());
  });
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

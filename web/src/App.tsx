import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { exitApp, initNative } from './platform/native';
import { useApp, usePremium } from './store/app';
import { api, MOCK_MODE } from './lib/api';
import { AdSlot, ToastProvider } from './components/ui';
import { TabBar } from './components/layout';
import { track } from './lib/track';
import Home from './pages/Home';
import Intro from './pages/Intro';
import ProfileNew from './pages/ProfileNew';
import DevComponents from './pages/DevComponents';
import Today from './pages/Today';
import { ZodiacDetail, ZodiacList } from './pages/Zodiac';
import { FunList, UnseTab } from './pages/Catalog';
import TarotTab from './pages/Tarot';
import { Contact, Privacy, Terms } from './pages/Legal';
import ProductDetail from './pages/ProductDetail';
import { TalismanDetail, TalismanList, TalismanMake } from './pages/Talisman';
import Checkout from './pages/Checkout';
import PayReturn from './pages/PayReturn';
import ReadingPage from './pages/Reading';
import Premium from './pages/Premium';
import Box from './pages/Me';
import Login, { AuthCallback } from './pages/Login';
import { BloodPage, DreamPage, FactbombPage, MbtiPage, OnelinePage, SmallPage, StarPage } from './pages/Fun';

const Admin = lazy(() => import('./admin/Admin')); // 관리자는 따로 불러온다(앱 첫 화면 용량에 안 섞이게)

// 하단 탭을 숨기는 화면(입력·결제·풀이·부적 작성·상세)
const NO_TAB = ['/intro', '/profile', '/checkout', '/reading', '/dev', '/product/', '/login', '/auth'];
const noTab = (path: string) => NO_TAB.some((p) => path.startsWith(p)) || /^\/talisman\/[^/]+/.test(path);

// 화면 하나가 오류로 그려지지 못해도 하얀 화면만 남지 않게 — 다시 열기·운세함·홈 버튼(주소가 바뀌면 새로 그림)
class ErrorBoundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: unknown) { try { track('screen_error', { message: String((e as Error)?.message ?? e).slice(0, 120), path: location.pathname }); } catch { /* */ } }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <main className="screen no-tab">
        <h1 className="h2 center mt24">화면을 여는 중 문제가 생겼어요</h1>
        <p className="muted center">결제하신 풀이·부적은 안전하게 보관되어 있어요.</p>
        <div className="pad mt14" style={{ display: 'grid', gap: 10 }}>
          <button className="btn gold" onClick={() => location.reload()}>다시 열기</button>
          <a className="btn line" href="/box">나의 운세함으로</a>
          <a className="btn line" href="/">홈으로</a>
        </div>
      </main>
    );
  }
}

// 앱 종료 확인(안드로이드 홈에서 뒤로가기) — 일반 회원은 종료 팝업 광고(관리자 "앱 종료 팝업" 배너 이미지가 있으면 그 이미지·링크, 없으면 AdMob 자리)
function ExitSheet() {
  const [open, setOpen] = useState(false);
  const premium = usePremium();
  const [promo, setPromo] = useState<{ imageUrl: string | null; link: string | null; title: string } | null>(null);
  useEffect(() => { const on = () => setOpen(true); window.addEventListener('naman:exit', on); return () => window.removeEventListener('naman:exit', on); }, []);
  useEffect(() => {
    if (!open || premium || MOCK_MODE) return;
    api<{ imageUrl: string | null; link: string | null; title: string }[]>('/banners?slot=exit_popup').then((r) => setPromo(r.find((b) => b.imageUrl) ?? null)).catch(() => {});
  }, [open, premium]);
  if (!open) return null;
  return (
    <div className="sheet-bg" role="dialog" aria-modal="true" aria-label="앱 종료" onClick={() => setOpen(false)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {!premium && (promo?.imageUrl
          ? <a href={promo.link ?? '#'} target="_blank" rel="noreferrer" className="exit-promo"><img src={promo.imageUrl} alt={promo.title} /></a>
          : <AdSlot kind="앱 종료 팝업" slot="exit" />)}
        <h2 className="h2 center">나만의 운세를 종료할까요?</h2>
        <p className="muted center">내일 아침에도 오늘의 운세가 기다리고 있어요</p>
        <div className="mt14" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn line" onClick={() => setOpen(false)}>취소</button>
          <button className="btn gold" onClick={() => exitApp()}>종료</button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const { introSeen, fontScale } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => { void initNative((to) => nav(to)); }, []);
  useEffect(() => { document.documentElement.dataset.scale = fontScale; }, [fontScale]);
  useEffect(() => {
    window.scrollTo(0, 0);
    track('page_view', { path: loc.pathname });
    if (new URLSearchParams(loc.search).get('utm_source') === 'share') track('share_link_open', { path: loc.pathname });
  }, [loc.pathname]);
  if (loc.pathname.startsWith('/admin'))
    return <Suspense fallback={null}><Routes><Route path="/admin/*" element={<Admin />} /></Routes></Suspense>;
  if (!introSeen && loc.pathname === '/') return <Navigate to="/intro" replace />;
  return (
    <ToastProvider>
      <ExitSheet />
      <div className="app">
        <ErrorBoundary key={loc.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/intro" element={<Intro />} />
          <Route path="/profile/new" element={<ProfileNew />} />
          <Route path="/profile/:id/edit" element={<ProfileNew />} />
          <Route path="/today" element={<Today />} />
          <Route path="/today/:field" element={<Navigate to="/today" replace />} />
          <Route path="/unse" element={<UnseTab />} />
          <Route path="/fun" element={<FunList />} />
          <Route path="/tarot" element={<TarotTab />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/talisman" element={<TalismanList />} />
          <Route path="/talisman/:id" element={<TalismanDetail />} />
          <Route path="/talisman/:id/make" element={<TalismanMake />} />
          <Route path="/checkout/:product" element={<Checkout />} />
          <Route path="/pay/return" element={<PayReturn />} />
          <Route path="/reading/:orderId" element={<ReadingPage />} />
          <Route path="/box" element={<Box />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/zodiac" element={<ZodiacList />} />
          <Route path="/zodiac/:animal" element={<ZodiacDetail />} />
          <Route path="/fun/zodiac-star" element={<StarPage />} />
          <Route path="/fun/blood" element={<BloodPage />} />
          <Route path="/fun/small" element={<SmallPage />} />
          <Route path="/fun/oneline" element={<OnelinePage />} />
          <Route path="/fun/dream" element={<DreamPage />} />
          <Route path="/fun/factbomb" element={<FactbombPage />} />
          <Route path="/fun/mbti" element={<MbtiPage />} />
          <Route path="/dev/components" element={<DevComponents />} />
          {/* v1 주소 호환 */}
          <Route path="/me" element={<Navigate to="/box" replace />} />
          <Route path="/consult" element={<Navigate to="/unse?cat=fate" replace />} />
          {/* v2 주소 호환 — 나만의 운명·인연 탭은 운세 탭 분류로 합침(결정필요 D12) */}
          <Route path="/fate" element={<Navigate to="/unse?cat=fate" replace />} />
          <Route path="/love" element={<Navigate to="/unse?cat=love" replace />} />
          <Route path="/fun/tarot" element={<Navigate to="/tarot" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
        {!noTab(loc.pathname) && <TabBar />}
      </div>
    </ToastProvider>
  );
}

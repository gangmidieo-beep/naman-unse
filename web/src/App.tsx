import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './store/app';
import { ToastProvider } from './components/ui';
import { TabBar } from './components/layout';
import { track } from './lib/track';
import Home from './pages/Home';
import Intro from './pages/Intro';
import ProfileNew from './pages/ProfileNew';
import DevComponents from './pages/DevComponents';
import Today from './pages/Today';
import { ZodiacDetail, ZodiacList } from './pages/Zodiac';
import { FateList, LoveList } from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import { TalismanDetail, TalismanList, TalismanMake } from './pages/Talisman';
import Checkout from './pages/Checkout';
import ReadingPage from './pages/Reading';
import Premium from './pages/Premium';
import Box from './pages/Me';
import Login, { AuthCallback } from './pages/Login';
import { BloodPage, DreamPage, FactbombPage, MbtiPage, StarPage, TarotPage } from './pages/Fun';

const Admin = lazy(() => import('./admin/Admin')); // 관리자는 따로 불러온다(앱 첫 화면 용량에 안 섞이게)

// 하단 탭을 숨기는 화면(입력·결제·풀이·부적 작성·상세)
const NO_TAB = ['/intro', '/profile', '/checkout', '/reading', '/dev', '/product/', '/login', '/auth'];
const noTab = (path: string) => NO_TAB.some((p) => path.startsWith(p)) || /^\/talisman\/[^/]+/.test(path);

export function App() {
  const { introSeen, fontScale } = useApp();
  const loc = useLocation();
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
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/intro" element={<Intro />} />
          <Route path="/profile/new" element={<ProfileNew />} />
          <Route path="/profile/:id/edit" element={<ProfileNew />} />
          <Route path="/today" element={<Today />} />
          <Route path="/today/:field" element={<Navigate to="/today" replace />} />
          <Route path="/fate" element={<FateList />} />
          <Route path="/love" element={<LoveList />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/talisman" element={<TalismanList />} />
          <Route path="/talisman/:id" element={<TalismanDetail />} />
          <Route path="/talisman/:id/make" element={<TalismanMake />} />
          <Route path="/checkout/:product" element={<Checkout />} />
          <Route path="/reading/:orderId" element={<ReadingPage />} />
          <Route path="/box" element={<Box />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/zodiac" element={<ZodiacList />} />
          <Route path="/zodiac/:animal" element={<ZodiacDetail />} />
          <Route path="/fun/zodiac-star" element={<StarPage />} />
          <Route path="/fun/blood" element={<BloodPage />} />
          <Route path="/fun/tarot" element={<TarotPage />} />
          <Route path="/fun/dream" element={<DreamPage />} />
          <Route path="/fun/factbomb" element={<FactbombPage />} />
          <Route path="/fun/mbti" element={<MbtiPage />} />
          <Route path="/dev/components" element={<DevComponents />} />
          {/* v1 주소 호환 */}
          <Route path="/me" element={<Navigate to="/box" replace />} />
          <Route path="/consult" element={<Navigate to="/fate" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!noTab(loc.pathname) && <TabBar />}
      </div>
    </ToastProvider>
  );
}

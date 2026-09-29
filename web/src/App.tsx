import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './store/app';
import { ToastProvider } from './components/ui';
import { TabBar } from './components/layout';
import { track } from './lib/track';
import Home from './pages/Home';
import Intro from './pages/Intro';
import ProfileNew from './pages/ProfileNew';
import DevComponents from './pages/DevComponents';
import Placeholder from './pages/Placeholder';

const NO_TAB = ['/intro', '/profile', '/checkout', '/reading', '/dev'];

export function App() {
  const { introSeen, fontScale } = useApp();
  const loc = useLocation();
  useEffect(() => { document.documentElement.dataset.scale = fontScale; }, [fontScale]);
  useEffect(() => { window.scrollTo(0, 0); track('page_view', { path: loc.pathname }); }, [loc.pathname]);
  const showTab = !NO_TAB.some((p) => loc.pathname.startsWith(p));
  if (!introSeen && loc.pathname === '/') return <Navigate to="/intro" replace />;
  return (
    <ToastProvider>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/intro" element={<Intro />} />
          <Route path="/profile/new" element={<ProfileNew />} />
          <Route path="/profile/:id/edit" element={<ProfileNew />} />
          <Route path="/dev/components" element={<DevComponents />} />
          <Route path="*" element={<Placeholder />} />
        </Routes>
        {showTab && <TabBar />}
      </div>
    </ToastProvider>
  );
}

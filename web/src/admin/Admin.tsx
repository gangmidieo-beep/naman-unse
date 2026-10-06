// 관리자 페이지 — 8개 메뉴(화면설계_v2 11장). /admin/* (앱과 같은 웹에 포함, 서버 /admin/api 사용)
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { adminApi, saveSession, session } from './api';
import { Account, Ads, Banners, Dashboard, Members, Payments, Products, Push, Stats } from './pages';
import './admin.css';

const MENU = [
  ['dashboard', '대시보드'], ['members', '회원관리'], ['products', '콘텐츠 상품관리'], ['banners', '배너·팝업'],
  ['payments', '결제·구독'], ['push', '푸시 알림'], ['ads', '광고 관리'], ['stats', '통계 분석'], ['account', '관리자 계정'],
] as const;

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const r = await adminApi<{ token: string; role: 'super' | 'operator'; email: string }>('/login', { method: 'POST', json: { email, password } });
      saveSession(r);
      nav('/admin/dashboard', { replace: true });
    } catch (x) { setErr((x as Error).message); }
  };
  return (
    <div className="ad-login">
      <form onSubmit={submit}>
        <h1><span className="seal">運</span>나만의 운세 관리자</h1>
        <label>이메일<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required /></label>
        <label>비밀번호<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label>
        {err && <p className="ad-err">{err}</p>}
        <button className="ad-btn gold">로그인</button>
        <p className="ad-muted">계정 추가·비밀번호 변경은 로그인 후 「관리자 계정」 메뉴 · 5회 틀리면 10분 잠김</p>
      </form>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const s = session();
  const nav = useNavigate();
  if (!s) return <Navigate to="/admin/login" replace />;
  return (
    <div className="adm">
      <aside>
        <div className="ad-brand"><span className="seal">運</span>나만의 운세<small>관리자</small></div>
        <nav>{MENU.map(([k, l], i) => <NavLink key={k} to={`/admin/${k}`}><i>{i + 1}</i>{l}</NavLink>)}</nav>
        <div className="ad-me">{s.email}<br /><b>{s.role === 'super' ? '최고관리자' : '운영자'}</b>
          <button className="ad-btn line sm" onClick={() => { saveSession(null); nav('/admin/login'); }}>로그아웃</button>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}

export default function Admin() {
  useEffect(() => { document.title = '나만의 운세 관리자'; }, []);
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="dashboard" element={<Shell><Dashboard /></Shell>} />
      <Route path="members" element={<Shell><Members /></Shell>} />
      <Route path="products" element={<Shell><Products /></Shell>} />
      <Route path="banners" element={<Shell><Banners /></Shell>} />
      <Route path="payments" element={<Shell><Payments /></Shell>} />
      <Route path="push" element={<Shell><Push /></Shell>} />
      <Route path="ads" element={<Shell><Ads /></Shell>} />
      <Route path="stats" element={<Shell><Stats /></Shell>} />
      <Route path="account" element={<Shell><Account /></Shell>} />
      <Route path="*" element={<Navigate to={session() ? '/admin/dashboard' : '/admin/login'} replace />} />
    </Routes>
  );
}

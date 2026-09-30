import { type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { optionalImg } from '../assets/images';
import { lunarPill } from '../lib/dates';
import { useApp } from '../store/app';

// 로고 — 대표님 아이콘 글씨 이미지(web/public/img/brand/logo.png, _incoming 의 logo_brand)가 오면 그 이미지, 없으면 임시 Song Myung 글씨
export function BrandLogo() {
  const img = optionalImg('logo_brand');
  if (img) return <img className="brandlogo" src={img.src} alt="나만의 운세" height={34} />;
  const seal = optionalImg('logo_seal');
  return (
    <>
      {seal ? <img className="seal" src={seal.src} width={24} height={24} alt="" /> : <span className="seal" aria-hidden>運</span>}
      나만의 운세
    </>
  );
}

// 홈 헤더 — 좌: 날짜 알약(날씨는 키 받은 뒤) / 가운데: 로고 / 우: 로그인
export function AppHeader() {
  const account = useApp((s) => s.account);
  return (
    <header className="hdr">
      <span className="chip-h" aria-label={`오늘 음력 ${lunarPill()}`}>🌙 음 {lunarPill()}</span>
      <Link to="/" className="logo" aria-label="나만의 운세 홈"><BrandLogo /></Link>
      <Link to={account ? '/box' : '/login'} className="chip-h">{account ? '내 계정' : '로그인'}</Link>
    </header>
  );
}

export function SubHeader({ title, sub, back = true, right }: { title: string; sub?: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sub">
      {back ? (
        <button className="bk" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="뒤로">‹</button>
      ) : <span className="r" />}
      <h1 className="t"><b>{title}</b>{sub && <small>{sub}</small>}</h1>
      <span className="r">{right}</span>
    </header>
  );
}

export function SectionHeader({ en, title, desc, center, style }: { en: string; title: ReactNode; desc?: string; center?: boolean; style?: React.CSSProperties }) {
  return (
    <div className={`sec${center ? ' center' : ''}`} style={style}>
      <div className="en">{en}</div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
    </div>
  );
}

const TABS = [
  { to: '/', label: '홈', i: '家', end: true },
  { to: '/fate', label: '나만의 운명', i: '命' },
  { to: '/love', label: '나만의 인연', i: '緣' },
  { to: '/talisman', label: '나만의 부적', i: '符' },
  { to: '/box', label: '나의 운세함', i: '函' },
];
export function TabBar() {
  return (
    <nav className="tabs" aria-label="주 메뉴">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          <span className="i" aria-hidden>{t.i}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

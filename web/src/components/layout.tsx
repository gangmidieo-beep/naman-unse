import { type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { optionalImg } from '../assets/images';

export function Seal() {
  const logo = optionalImg('logo_seal');
  return logo ? <img className="seal" src={logo.src} width={26} height={26} alt="" /> : <span className="seal" aria-hidden>運</span>;
}

export function AppHeader({ lunar }: { lunar: string }) {
  return (
    <header className="hdr">
      <span className="pill" aria-label={`오늘 음력 ${lunar}`}>🌙 음 {lunar}</span>
      <Link to="/" className="logo" aria-label="나만의 운세 홈"><Seal />나만의 운세</Link>
      <Link to="/me" className="pill">내 정보</Link>
    </header>
  );
}

export function SubHeader({ title, back = true, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="subhdr">
      {back && (
        <button className="back" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="뒤로">‹</button>
      )}
      <h1 style={{ fontSize: 'inherit', paddingLeft: back ? 0 : 12 }}>{title}</h1>
      {right && <div className="right">{right}</div>}
    </header>
  );
}

export function SectionHeader({ en, title, desc }: { en: string; title: ReactNode; desc?: string }) {
  return (
    <div className="sec">
      <small>{en}</small>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
    </div>
  );
}

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: '홈', icon: 'home', end: true },
  { to: '/today', label: '오늘운세', icon: 'today' },
  { to: '/consult', label: '사주상담', icon: 'chat' },
  { to: '/zodiac', label: '띠별운세', icon: 'zodiac' },
  { to: '/me', label: '내 정보', icon: 'user' },
];
export function TabBar() {
  return (
    <nav className="tabs" aria-label="주 메뉴">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          <span className="i" aria-hidden><Icon name={t.icon} size={26} mono /></span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

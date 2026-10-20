import { type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { optionalImg } from '../assets/images';
import { lunarPill } from '../lib/dates';
import { useApp } from '../store/app';

// 작은 글씨 로고 — 투명 배경 글씨 이미지(_incoming 의 logo_wordmark)가 오면 그 이미지, 없으면 Song Myung 글씨. 홈 최상단은 AppHeader 의 logo_brand 배너
export function BrandLogo() {
  const img = optionalImg('logo_wordmark');
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
  const banner = optionalImg('logo_brand');
  // 대표님 상단 로고 배너가 있으면: 배너를 가로 꽉 차게 맨 위에, 날짜·로그인은 배너 위 양쪽 모서리에
  if (banner) {
    return (
      <header className="hdr hdr-banner">
        <Link to="/" className="brandbanner" aria-label="나만의 운세 홈">
          <img src={banner.src} srcSet={banner.srcset} sizes="(min-width: 520px) 480px, 100vw" width={banner.w} height={banner.h} alt="나만의 운세" fetchPriority="high" />
        </Link>
        <span className="chip-h on-banner l" aria-label={`오늘 음력 ${lunarPill()}`}>🌙 음 {lunarPill()}</span>
        <Link to={account ? '/box' : '/login'} className="chip-h on-banner r">{account ? '내 계정' : '로그인·가입'}</Link>
      </header>
    );
  }
  return (
    <header className="hdr">
      <span className="chip-h" aria-label={`오늘 음력 ${lunarPill()}`}>🌙 음 {lunarPill()}</span>
      <Link to="/" className="logo" aria-label="나만의 운세 홈"><BrandLogo /></Link>
      <Link to={account ? '/box' : '/login'} className="chip-h">{account ? '내 계정' : '로그인·가입'}</Link>
    </header>
  );
}

export function SubHeader({ title, sub, back = true, right, big }: { title: string; sub?: string; back?: boolean; right?: ReactNode; big?: boolean }) {
  const nav = useNavigate();
  return (
    <header className={`sub${big ? ' big' : ''}`}>
      {back ? (
        <button className="bk" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="뒤로">‹</button>
      ) : <span className="r" />}
      <h1 className="t"><b>{title}</b>{sub && <small>{sub}</small>}</h1>
      <span className="r">{right}</span>
    </header>
  );
}

export function SectionHeader({ en, title, desc, center, style, more }: { en: string; title: ReactNode; desc?: string; center?: boolean; style?: React.CSSProperties; more?: { to: string; label: string } }) {
  return (
    <div className={`sec${center ? ' center' : ''}`} style={style}>
      {more && <Link to={more.to} className="sec-more">{more.label} ›</Link>}
      <div className="en">{en}</div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
    </div>
  );
}

// 하단 탭 아이콘 — 2026-10-20 대표님 점검 사항2: 단조로운 윤곽 아이콘 → 카테고리마다 특징이 보이는 컬러 아이콘
// (한옥·팔괘 나침반·타로 카드·붉은 부적·보물함, 사장님 Higgsfield 생성). 다크모드에서도 잘 보이게 그림 자체 색을 쓴다. 활성 = 먹색 칸
const TABS = [
  { to: '/', label: '홈', i: 'tabc_home', end: true },
  { to: '/unse', label: '운세', i: 'tabc_unse' },
  { to: '/tarot', label: '타로', i: 'tabc_tarot' },
  { to: '/talisman', label: '부적', i: 'tabc_talisman' },
  { to: '/box', label: '운세함', i: 'tabc_box' },
];
export function TabBar() {
  return (
    <nav className="tabs" aria-label="주 메뉴">
      <Link to="/" className="tabs-logo" aria-label="나만의 운세 홈"><BrandLogo /></Link>
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>
          <span className="i" aria-hidden><img className="icc" src={`/img/v4/${t.i}.webp`} alt="" width={56} height={56} /></span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

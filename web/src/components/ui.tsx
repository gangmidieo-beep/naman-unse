// 공통 컴포넌트 v2 — 시안 v2 기준. /dev/components 에 전부 나열.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Img } from './Img';
import type { ImgKey } from '../assets/images';
import { CHAR, charOf, displayCopy, displayTitle, isTalisman, memberPrice, thumbOf, won, type CharId, type Product, type Talisman } from '../lib/catalog';

/* ---------- 버튼·칩·탭 ---------- */
type BtnKind = 'gold' | 'ink' | 'line';
export function Button({ kind = 'ink', to, onClick, children, disabled, type = 'button', className = '' }: {
  kind?: BtnKind; to?: string; onClick?: () => void; children: ReactNode; disabled?: boolean; type?: 'button' | 'submit'; className?: string;
}) {
  if (to) return <Link to={to} className={`btn ${kind} ${className}`}>{children}</Link>;
  return <button type={type} className={`btn ${kind} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function ChipGroup<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value?: T | null; onChange: (v: T) => void }) {
  return (
    <div className="chips" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" className={`chip${o.value === value ? ' on' : ''}`} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
export function SegTabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className={`seg${tabs.length === 2 ? ' two' : ''}`} role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={t.value === value} className={t.value === value ? 'on' : ''} onClick={() => onChange(t.value)}>{t.label}</button>
      ))}
    </div>
  );
}
export function CategoryTabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ctabs" role="tablist">
      {tabs.map((t) => <button key={t} role="tab" aria-selected={t === value} className={t === value ? 'on' : ''} onClick={() => onChange(t)}>{t}</button>)}
    </div>
  );
}

/* ---------- 별점·점수 ---------- */
export const starText = (n: number) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
export function Stars({ n }: { n: number }) {
  return <span className="stars" aria-label={`별 5개 중 ${n}개`}>{starText(n)}</span>;
}
export function useCountUp(target: number) {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      setV(Math.round(target * k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

/* ---------- 홈 ---------- */
export function HeroDuo() {
  return (
    <section className="hero2" aria-label="천궁도사와 월하선녀">
      <Img k="cheongungCard" className="l" eager alt="천궁도사" />
      <Img k="wolhaCard" className="r" eager alt="월하선녀" />
      <div className="names"><span className="tagdark">천궁도사</span><span className="tagdark">월하선녀</span></div>
      <div className="shade" />
      <div className="txt"><small>天 宮 · 月 下</small><b>천궁도사와 월하선녀가<br />당신의 운세를 알려드립니다</b></div>
    </section>
  );
}

// 오늘의 운세 먹색 카드 (홈 — 결제 권유 금지)
export function TodayCard({ name, isSample, date, total, stars, line, to = '/today' }: {
  name: string; isSample: boolean; date: string; total: number; stars: number; line: string; to?: string;
}) {
  const shown = useCountUp(total);
  return (
    <section className="today" aria-label="오늘의 운세">
      <div className="in">
        <div className="top"><small>TODAY'S FORTUNE</small><span>{date}</span></div>
        <h4>{name}님, 오늘의 운세예요{isSample && <span className="sample-badge">예시</span>}</h4>
        <div className="sc" aria-label={`${total}점`}><b aria-hidden>{shown}</b><span aria-hidden>점</span><Stars n={stars} /></div>
        <p className="q">“{line}”</p>
        {isSample && <Link to="/profile/new" className="sample-link">예시 화면이에요. <b>내 정보를 입력</b>하면 나만의 운세로 바뀌어요 ›</Link>}
        <Button kind="gold" to={to} className="mt">오늘의 운세 자세히 보기</Button>
      </div>
    </section>
  );
}

// 롤링 배너 — 4초 자동 넘김 + 스와이프 + 페이지 점. banners 는 관리자 데이터로 바꿀 수 있게 prop.
export type BannerItem = { id: string; title: string; copy: string; link: string; character: string; img?: string; hanja?: string };
export function RollingBanner({ items }: { items: BannerItem[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const paused = useRef(false);
  const go = (n: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
    setI(n);
  };
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => { if (!paused.current) go((i + 1) % items.length); }, 4000);
    return () => clearInterval(t);
  }, [i, items.length]);
  return (
    <div className="banner-wrap" onPointerDown={() => (paused.current = true)} onPointerUp={() => (paused.current = false)}>
      <div className="banner-track" ref={track} onScroll={(e) => { const n = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth); if (n !== i) setI(n); }}>
        {items.map((b, n) => (
          <Link key={b.id} to={b.link} className="banner" aria-label={`${b.title} — ${b.copy}`} tabIndex={n === i ? 0 : -1}>
            {b.img ? <img src={b.img} alt="" loading={n === 0 ? 'eager' : 'lazy'} /> : <Img k={b.character === 'wolha' ? 'wolhaBanner' : 'cheongungBanner'} alt="" eager={n === 0} />}
            <div className="shade" />
            <div className="txt"><small>{CHAR[b.character as CharId]?.name ?? '나만의 운세'} · {b.title}</small><b>{b.title}</b><span>{b.copy}</span></div>
          </Link>
        ))}
      </div>
      <div className="dots" role="tablist" aria-label="배너 넘기기">
        {items.map((b, n) => <button key={b.id} role="tab" aria-selected={n === i} aria-label={`${n + 1}번째 배너`} className={n === i ? 'on' : ''} onClick={() => go(n)}><i /></button>)}
      </div>
    </div>
  );
}

// 무료 = 가벼운 한지 카드
export function FreeCard({ to, onClick, hanja, title, desc, wide }: { to?: string; onClick?: () => void; hanja: string; title: string; desc: string; wide?: boolean }) {
  const body = (
    <>
      {!wide && <span className="fb">무료</span>}
      <div className="fi" aria-hidden>{hanja}</div>
      <div><b>{title}</b><span className="d">{desc}</span></div>
    </>
  );
  const cls = `free${wide ? ' wide' : ''}`;
  return to ? <Link to={to} className={cls}>{body}</Link> : <button type="button" className={cls} onClick={onClick}>{body}</button>;
}

// 유료 = 먹색+금 레어 카드
export function RareCard({ p, owned }: { p: Product; owned?: boolean }) {
  const t = thumbOf(p);
  const badge = owned ? '✓ 보유중' : (p as any).badge ? `✦ ${(p as any).badge}` : null;
  return (
    <Link to={isTalisman(p) ? `/talisman/${p.id}` : `/product/${p.id}`} className="rare" aria-label={`${displayTitle(p)} ${won(p.price)}`}>
      {badge && <span className={`pb${owned ? ' owned' : ''}`}>{badge}</span>}
      <div className="in">
        {t.src ? <img src={t.src} alt="" width={224} height={224} loading="lazy" /> : <div className={`hz${t.hanja.length > 1 ? ' two' : ''}`} aria-hidden>{t.hanja}</div>}
        <div className="shade" />
        <div className="tx"><b>{displayTitle(p)}</b><span>{displayCopy(p)}</span><div className="pr">{won(p.price)}</div></div>
      </div>
    </Link>
  );
}

export function CharacterSectionHead({ who, title, desc, to }: { who: CharId; title: string; desc: string; to: string }) {
  return (
    <Link to={to} className="chhead" aria-label={`${title} 전체 보기`}>
      <Img k={CHAR[who].card} alt="" />
      <div className="tx"><small>{CHAR[who].hanja}</small><b>{title}</b><span>{desc}</span></div>
      <span className="more">전체 보기 ›</span>
    </Link>
  );
}

// 상품 썸네일(이미지 또는 먹색+금 한자) — 목록 행·결제 요약에서 공용
export function ProductThumb({ p, size = 112 }: { p: Product; size?: number }) {
  if (isTalisman(p)) return <div className={`bjth ${talismanTone(p)}`} style={size !== 112 ? { width: size, height: size, flexBasis: size } : undefined}><TalismanPaper t={p} size={size < 100 ? 0.55 : 1} /></div>;
  const t = thumbOf(p);
  return (
    <div className="th" style={size !== 112 ? { width: size, height: size, flexBasis: size } : undefined}>
      <div className={`in${t.hanja.length > 1 ? ' two' : ''}`}>{t.src ? <img src={t.src} alt="" width={224} height={224} loading="lazy" /> : <span aria-hidden>{t.hanja}</span>}</div>
    </div>
  );
}

// 상품 목록 행 (도사 컨텐츠 형식)
export function ProductRow({ p, owned }: { p: Product; owned?: boolean }) {
  const who = charOf(p);
  const badge = (p as any).badge as string | null;
  return (
    <Link to={isTalisman(p) ? `/talisman/${p.id}` : `/product/${p.id}`} className="row">
      <ProductThumb p={p} />
      <div className="meta">
        <div className="by">
          {!isTalisman(p) && <Img k={CHAR[who].face} alt="" />}
          {p.group} · {CHAR[who].name}
          {badge && <span className={`badge${badge === 'BEST' ? ' best' : badge === 'NEW' ? ' new' : ''}`}>{badge}</span>}
          {owned && <span className="badge owned">보유중</span>}
        </div>
        <b className="nm">{displayTitle(p)}</b>
        <p>{displayCopy(p)}</p>
        <div className="price"><span className="n">{won(p.price)}</span><span className="m">회원 {won(memberPrice(p))}</span></div>
      </div>
    </Link>
  );
}

/* ---------- 부적 ---------- */
export const talismanTone = (t: Talisman) => ({ '재물·성공': 'w', '사랑·인연': 'l', '소원·성취': 's', '평안·보호': 'p' } as Record<string, string>)[t.group] ?? 'w';
// 코드로 그리는 노란 한지 부적: 붉은 테두리 + 세로 한자. hanjaPhrase 4글자 중 앞 2~3글자를 크게, 전체를 작은 머리글로.
export function TalismanPaper({ t, size = 1, name, birth, wish, issued }: { t: Talisman; size?: number; name?: string; birth?: string; wish?: string; issued?: string }) {
  const phrase = (t as any).hanjaPhrase as string;
  const chars = [...phrase].slice(0, size >= 2 && !name ? 3 : 2);
  const w = 64 * size, h = 100 * size;
  return (
    <div className="bj" style={{ width: w, height: h, gap: 1 * size }} role="img" aria-label={`${t.title} (${phrase})`}>
      <em style={{ fontSize: 9 * size }}>{phrase}符</em>
      {chars.map((c, i) => <b key={i} style={{ fontSize: 22 * size }}>{c}</b>)}
      {name && (
        <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, color: '#6E1C14', fontSize: 5.4 * size, lineHeight: 1.35, textAlign: 'center', marginTop: 3 * size, padding: `0 ${4 * size}px` }}>
          {name} · {birth}<br />{wish}<br />{issued}
        </span>
      )}
    </div>
  );
}
export function EffectCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="eff"><div className="in"><div className="ic" aria-hidden>{icon}</div><div><b>{title}</b><span>{desc}</span></div></div></div>
  );
}
export function StepList({ label, steps, hanjaNums }: { label: string; steps: { title: string; desc: string }[]; hanjaNums?: boolean }) {
  const H = ['一', '二', '三', '四', '五'];
  return (
    <div className="frame">
      <span className="lbl">{label}</span>
      {steps.map((s, i) => (
        <div className="li" key={i}><span className="n" aria-hidden>{hanjaNums ? H[i] : i + 1}</span><div><b>{s.title}</b><span>{s.desc}</span></div></div>
      ))}
    </div>
  );
}
export function StickyBuyBar({ price, member, premium, label, onBuy, disabled }: { price: number; member: number; premium: boolean; label: string; onBuy: () => void; disabled?: boolean }) {
  return (
    <div className="sticky">
      <div className="pp">
        {premium ? <><s>{won(price)}</s><b>{won(member)}</b><em>프리미엄 회원가</em></> : <><b>{won(price)}</b><em>· 회원 {won(member)}</em></>}
      </div>
      <Button kind="gold" onClick={onBuy} disabled={disabled}>{label}</Button>
    </div>
  );
}

/* ---------- 캐릭터 말풍선 ---------- */
export type Who = CharId | 'me';
export function CharacterBubble({ who, children }: { who: Who; children: ReactNode }) {
  if (who === 'me') return <div className="bubble me"><div className="say">{children}</div></div>;
  return (
    <div className={`bubble ${who}`}>
      <Img k={CHAR[who].face} className="avatar" alt="" />
      <div className="say"><small>{CHAR[who].name}</small>{children}</div>
    </div>
  );
}

/* ---------- 잠금·광고 ---------- */
export function PremiumLock({ children, label = '✦ 프리미엄 회원은 전체를 볼 수 있어요' }: { children: ReactNode; label?: string }) {
  return (
    <div className="plock">
      <div className="blur" aria-hidden>{children}</div>
      <div className="over"><b>{label}</b><Button kind="gold" to="/premium">프리미엄 알아보기</Button></div>
    </div>
  );
}
// 웹 = 자리 표시, 앱 = AdMob(10 단계). 프리미엄은 숨김.
export function AdSlot({ premium, kind = '배너' }: { premium?: boolean; kind?: string }) {
  if (premium) return null;
  return <div className="ad" role="complementary" aria-label="광고">광고 영역 (AdMob {kind} · 프리미엄 회원은 숨김)</div>;
}

/* ---------- 바텀시트·토스트·스켈레톤 ---------- */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    ref.current?.focus();
    return () => removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h4>{title}</h4>
        {children}
      </div>
    </div>
  );
}
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(0);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export function Skeleton({ h = 20, w = '100%' }: { h?: number; w?: number | string }) {
  return <div className="skel" style={{ height: h, width: w }} aria-hidden />;
}
export { ImgKey };

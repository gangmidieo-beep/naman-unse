// 공통 컴포넌트 v2 — 시안 v2 기준. /dev/components 에 전부 나열.
import { hideBanner, showBanner } from '../platform/native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Img } from './Img';
import type { ImgKey } from '../assets/images';
import { usePremium } from '../store/app';
import { adProvider, adSlots, isNativeApp, loadAdSense } from '../lib/ads';
import { CHAR, charOf, displayCopy, displayTitle, isTalisman, memberPrice, priceView, productPath, thumbOf, won, type CharId, type Product, type Talisman } from '../lib/catalog';

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

// 롤링 배너 — 4초 자동 넘김 + 손가락·마우스 좌우 드래그 + 무한 루프 + "4/9" 숫자 표시(결정필요 D27)
// 손 대는 동안(누르고 있거나 마우스를 올리면) 자동 넘김 멈춤, prefers-reduced-motion 이면 자동 넘김 끔. 라이브러리 없이 직접(결정필요 D26).
export type BannerItem = { id: string; title: string; copy: string; link: string; character: string; img?: string; hanja?: string };
export function RollingBanner({ items, interval = 4000 }: { items: BannerItem[]; interval?: number }) {
  const n = items.length;
  const [pos, setPos] = useState(1); // 앞뒤에 복제 슬라이드 1장씩 → 실제 i = pos-1
  const [anim, setAnim] = useState(true);
  const [drag, setDrag] = useState(0);
  const hold = useRef(false);
  const start = useRef<{ x: number; dx: number; moved: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const go = useCallback((to: number) => { setAnim(true); setPos(to); }, []);
  useEffect(() => {
    if (n < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => { if (!hold.current && !start.current) go(pos + 1); }, interval);
    return () => clearInterval(t);
  }, [pos, n, interval, go]);
  // 복제 슬라이드에 도착하면 애니메이션 없이 진짜 슬라이드로 순간 이동(무한 루프)
  const onEnd = () => {
    if (pos === 0) { setAnim(false); setPos(n); }
    else if (pos === n + 1) { setAnim(false); setPos(1); }
  };
  const down = (e: React.PointerEvent) => { start.current = { x: e.clientX, dx: 0, moved: false }; setAnim(false); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    start.current.dx = dx;
    if (Math.abs(dx) > 6) start.current.moved = true;
    setDrag(dx);
  };
  const up = () => {
    if (!start.current) return;
    const w = wrap.current?.clientWidth ?? 1;
    const { moved, dx } = start.current;
    if (dx < -w * 0.18) go(pos + 1);
    else if (dx > w * 0.18) go(pos - 1);
    else setAnim(true);
    setDrag(0);
    // 드래그였으면 링크 클릭 막기
    if (moved) wrap.current?.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
    start.current = null;
  };
  if (!n) return null;
  const slides = [items[n - 1], ...items, items[0]];
  const cur = ((pos - 1 + n) % n) + 1;
  return (
    <div className="banner-wrap" onMouseEnter={() => (hold.current = true)} onMouseLeave={() => (hold.current = false)} aria-roledescription="carousel" aria-label="추천 풀이">
      <div className="banner-view" ref={wrap} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="banner-track" onTransitionEnd={onEnd}
          style={{ transform: `translateX(calc(${-pos * 100}% + ${drag}px))`, transition: anim ? 'transform .45s ease' : 'none' }}>
          {slides.map((b, k) => (
            <Link key={`${b.id}-${k}`} to={b.link} className="banner" draggable={false} aria-hidden={k !== pos} tabIndex={k === pos ? 0 : -1} aria-label={`${b.title} — ${b.copy}`}>
              {b.img ? <img src={b.img} alt="" draggable={false} loading={k === 1 ? 'eager' : 'lazy'} /> : <Img k={b.character === 'wolha' ? 'wolhaBanner' : 'cheongungBanner'} alt="" eager={k === 1} />}
              <div className="shade" />
              <div className="txt"><small>{CHAR[b.character as CharId]?.name ?? '나만의 운세'}</small><b>{b.title}</b><span>{b.copy}</span></div>
            </Link>
          ))}
        </div>
        <span className="banner-count" aria-live="polite"><b>{cur}</b> / {n}</span>
      </div>
      <div className="banner-nav">
        <button onClick={() => go(pos - 1)} aria-label="이전 배너">‹</button>
        <button onClick={() => go(pos + 1)} aria-label="다음 배너">›</button>
      </div>
    </div>
  );
}

// 공통 상품 카드 — 목록형(list: 도사 컨텐츠 목록) / 그리드형(grid: 썸네일 그리드, scroll: 가로 스크롤)
export type CardItem = { id: string; title: string; copy: string; link: string; hanja: string; img?: string; by?: string; face?: ImgKey; badge?: string | null; owned?: boolean; price?: { rate: number; strike: number; final: number; label: string } | null; free?: boolean };
export function toCardItem(p: Product, owned = false): CardItem {
  const t = thumbOf(p);
  const who = CHAR[charOf(p)];
  return {
    id: p.id, title: displayTitle(p), copy: displayCopy(p), link: productPath(p), hanja: t.hanja, img: t.src,
    by: `${p.group} · ${who.name}`, face: isTalisman(p) ? undefined : who.face, badge: (p as any).badge, owned, price: priceView(p),
  };
}
const badgeCls = (b: string) => `badge${b === 'BEST' ? ' best' : b === 'NEW' ? ' new' : ''}`;
function PriceLine({ c }: { c: CardItem }) {
  if (c.free || !c.price) return <div className="pc-price"><span className="free-tag">무료</span></div>;
  const p = c.price;
  return (
    <div className="pc-price">
      {p.rate > 0 && <span className="rate">{p.rate}%</span>}
      {p.rate > 0 && <s>{p.strike.toLocaleString('ko-KR')}</s>}
      <b>{won(p.final)}</b>{p.label && <small>{p.label}</small>}
    </div>
  );
}
export function ProductCard({ c, mode = 'list', talisman }: { c: CardItem; mode?: 'list' | 'grid' | 'scroll'; talisman?: Talisman }) {
  const thumb = talisman ? (
    <div className={`bjth ${talismanTone(talisman)}`}><TalismanPaper t={talisman} /></div>
  ) : (
    <div className={`th${c.free ? ' light' : ''}`}><div className={`in${c.hanja.length > 1 ? ' two' : ''}`}>{c.img ? <img src={c.img} alt="" width={224} height={224} loading="lazy" /> : <span aria-hidden>{c.hanja}</span>}</div></div>
  );
  if (mode === 'list')
    return (
      <Link to={c.link} className="row">
        {thumb}
        <div className="meta">
          <div className="by">{c.face && <Img k={c.face} alt="" />}{c.by}{c.badge && <span className={badgeCls(c.badge)}>{c.badge}</span>}{c.owned && <span className="badge owned">보유중</span>}</div>
          <b className="nm">{c.title}</b>
          <p>{c.copy}</p>
          <PriceLine c={c} />
        </div>
      </Link>
    );
  return (
    <Link to={c.link} className={`pcard${mode === 'scroll' ? ' scroll' : ''}${c.free ? ' free-card' : ''}`}>
      <div className="pc-img">
        {talisman ? <div className={`pc-bj ${talismanTone(talisman)}`}><TalismanPaper t={talisman} size={1.2} /></div> : c.img ? <img src={c.img} alt="" width={224} height={224} loading="lazy" /> : <span className={`hz${c.hanja.length > 1 ? ' two' : ''}`} aria-hidden><i>{c.hanja}</i></span>}
        {(c.badge || c.owned) && <span className={c.owned ? 'badge owned' : badgeCls(c.badge!)}>{c.owned ? '보유중' : c.badge}</span>}
      </div>
      <div className="pc-tx"><b>{c.title}</b><span>{c.copy}</span><PriceLine c={c} /></div>
    </Link>
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

// 상품 목록 행 (도사 컨텐츠 형식) = ProductCard 목록형
export function ProductRow({ p, owned }: { p: Product; owned?: boolean }) {
  return <ProductCard c={toCardItem(p, owned)} mode="list" talisman={isTalisman(p) ? p : undefined} />;
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
// 하단 고정 구매바 — [할인율%] 정가(취소선) 판매가 · 회원가 + 버튼. 프리미엄이면 회원가로 결제.
export function StickyBuyBar({ p, premium, label, onBuy, disabled }: { p: Product; premium: boolean; label: string; onBuy: () => void; disabled?: boolean }) {
  const list = (p as any).listPrice as number | undefined;
  const m = memberPrice(p);
  return (
    <div className="sticky">
      <div className="pp">
        {premium ? <><s>{won(p.price)}</s><b>{won(m)}</b><em>프리미엄 회원가</em></>
          : <>{list && list > p.price && <><span className="rate">{Math.round(((list - p.price) / list) * 100)}%</span><s>{won(list)}</s></>}<b>{won(p.price)}</b><em>· 회원 {won(m)}</em></>}
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
// 광고 자리 — 프리미엄이면 아예 렌더하지 않음. 앱 = AdMob(네이티브 플러그인 자리), 웹 = 애드센스(ADSENSE_CLIENT_ID 있을 때만), 둘 다 아니면 자리 표시.
// slot 은 관리자 광고 관리의 위치 키(home_banner · detail_native · content_banner · tarot_banner) — OFF 면 숨김, 애드센스 슬롯 ID 도 여기서.
export function AdSlot({ premium, kind = '배너', slot = 'content_banner' }: { premium?: boolean; kind?: string; slot?: string }) {
  const isPremium = usePremium() || !!premium;
  const provider = adProvider({ premium: isPremium, native: isNativeApp(), adsenseClient: __ADSENSE_CLIENT_ID__ });
  const [cfg, setCfg] = useState<{ enabled: boolean; config: { adsenseSlot?: string } | null } | null | undefined>(undefined);
  const ins = useRef<HTMLModElement>(null);
  useEffect(() => { if (provider !== 'none') adSlots().then((m) => setCfg(m[slot] ?? null)); }, [provider, slot]);
  useEffect(() => {
    if (provider !== 'adsense' || !cfg?.config?.adsenseSlot || !ins.current) return;
    loadAdSense(__ADSENSE_CLIENT_ID__);
    try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch { /* 광고 차단 등 */ }
  }, [provider, cfg]);
  // 앱: AdMob 배너를 하단 탭 위에 띄우고, 화면에는 배너 높이만큼 빈칸(글이 가려지지 않게)
  useEffect(() => {
    if (provider !== 'admob' || cfg === undefined || cfg?.enabled === false) return;
    void showBanner();
    return () => { void hideBanner(); };
  }, [provider, cfg]);
  if (provider === 'none' || cfg?.enabled === false) return null;
  if (provider === 'admob' && isNativeApp()) return <div className="ad-native-space" role="complementary" aria-label="광고" data-ad-provider="admob" style={{ height: 64 }} />;
  if (provider === 'adsense' && cfg?.config?.adsenseSlot)
    return <ins ref={ins} className="adsbygoogle ad-web" style={{ display: 'block' }} data-ad-client={__ADSENSE_CLIENT_ID__} data-ad-slot={cfg.config.adsenseSlot} data-ad-format="auto" data-full-width-responsive="true" />;
  return <div className="ad" role="complementary" aria-label="광고" data-ad-provider={provider}>광고 영역 ({provider === 'admob' ? 'AdMob' : '웹 광고'} {kind} · 프리미엄 회원은 숨김)</div>;
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

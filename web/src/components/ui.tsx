import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Img } from './Img';
import type { ImgKey } from '../assets/images';

/* ---------- 버튼·칩·탭 ---------- */
type BtnKind = 'primary' | 'gold' | 'line';
export function Button({ kind = 'primary', to, onClick, children, disabled, type = 'button' }: {
  kind?: BtnKind; to?: string; onClick?: () => void; children: ReactNode; disabled?: boolean; type?: 'button' | 'submit';
}) {
  if (to) return <Link to={to} className={`btn ${kind}`}>{children}</Link>;
  return <button type={type} className={`btn ${kind}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

export function Chip({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: ReactNode }) {
  return <button type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={!!on} onClick={onClick}>{children}</button>;
}
export function ChipGroup<T extends string>({ options, value, onChange, align = 'right' }: {
  options: { value: T; label: string }[]; value?: T | null; onChange: (v: T) => void; align?: 'left' | 'right';
}) {
  return (
    <div className={`chips${align === 'left' ? ' left' : ''}`} role="group">
      {options.map((o) => <Chip key={o.value} on={o.value === value} onClick={() => onChange(o.value)}>{o.label}</Chip>)}
    </div>
  );
}

export function SegTabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={t.value === value} className={t.value === value ? 'on' : ''} onClick={() => onChange(t.value)}>{t.label}</button>
      ))}
    </div>
  );
}

/* ---------- 별점·점수 ---------- */
export const starText = (n: number) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
export function Stars({ n, size }: { n: number; size?: number }) {
  return <span className="stars" style={size ? { fontSize: size } : undefined} aria-label={`별 5개 중 ${n}개`}>{starText(n)}</span>;
}
export function ScoreStars({ score, stars }: { score: number; stars: number }) {
  const [shown, setShown] = useState(score);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(score);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      setShown(Math.round(score * k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  return (
    <div className="score" aria-label={`${score}점`}>
      <b aria-hidden>{shown}</b><span aria-hidden>점</span><Stars n={stars} />
    </div>
  );
}

/* ---------- 카드 ---------- */
export function FreeCard({ to, onClick, icon, title, desc }: { to?: string; onClick?: () => void; icon: ReactNode; title: string; desc: string }) {
  const body = (
    <>
      <span className="tag">매일 무료</span>
      <div><div className="ico" aria-hidden>{icon}</div><b>{title}</b><span className="d">{desc}</span></div>
    </>
  );
  return to ? <Link to={to} className="card">{body}</Link> : <button type="button" className="card" onClick={onClick}>{body}</button>;
}

export function RareCard({ to, onClick, img, big, title, desc, owned }: {
  to?: string; onClick?: () => void; img?: ImgKey; big?: string; title: string; desc: string; owned?: boolean;
}) {
  const body = (
    <>
      <span className={`badge-p${owned ? ' owned' : ''}`}>{owned ? '✓ 보유중' : '✦ 프리미엄'}</span>
      <div className="in">
        {img ? <Img k={img} alt="" /> : <div className="big" aria-hidden>{big}</div>}
        <div className="shade" />
        <div className="txt"><b>{title}</b><span>{desc}</span></div>
      </div>
    </>
  );
  const cls = `rare${img ? '' : ' plain'}`;
  return to ? <Link to={to} className={cls}>{body}</Link> : <button type="button" className={cls} onClick={onClick}>{body}</button>;
}

export function RareListItem({ img, th, title, desc, price, sel, onClick, to }: {
  img?: ImgKey; th?: string; title: string; desc: string; price?: ReactNode; sel?: boolean; onClick?: () => void; to?: string;
}) {
  const body = (
    <div className="in">
      {img ? <Img k={img} alt="" /> : <div className="th" aria-hidden>{th}</div>}
      <div className="meta"><b>{title}</b><span>{desc}</span></div>
      {price != null && <div className="price">{price}</div>}
    </div>
  );
  const cls = `prod${sel ? ' sel' : ''}`;
  if (to) return <Link to={to} className={cls}>{body}</Link>;
  return <button type="button" className={cls} aria-pressed={sel} onClick={onClick}>{body}</button>;
}

/* ---------- 캐릭터 말풍선 ---------- */
export type Who = 'sunnyeo' | 'dosa' | 'me';
export function CharacterBubble({ who, children }: { who: Who; children: ReactNode }) {
  if (who === 'me') return <div className="bubble me"><div className="say">{children}</div></div>;
  return (
    <div className={`bubble${who === 'dosa' ? ' dosa' : ''}`}>
      <Img k={who === 'dosa' ? 'dosaFace' : 'sunnyeoFace'} className={`avatar${who === 'dosa' ? ' navy' : ''}`} alt="" />
      <div className="say"><small>{who === 'dosa' ? '천궁도령' : '월하선녀'}</small>{children}</div>
    </div>
  );
}

/* ---------- 오늘 인사 카드 (홈 — 결제 권유 금지) ---------- */
export function GreetingCard({ name, isSample, score, stars, oneLine }: { name: string; isSample: boolean; score: number; stars: number; oneLine: string }) {
  return (
    <section className="greet" aria-label="오늘의 한마디">
      <div className="row">
        <Img k="sunnyeoFace" className="avatar" eager alt="월하선녀" />
        <div>
          <div className="who">월하선녀의 오늘 한마디</div>
          <h2>{name}님,{isSample && <span className="sample">예시</span>}<br />오늘의 운세가 도착했어요</h2>
        </div>
      </div>
      <ScoreStars score={score} stars={stars} />
      <div className="oneline">“{oneLine}”</div>
      {isSample && (
        <Link to="/profile/new" className="sample-link">예시 화면이에요. <b>내 정보를 입력</b>하면 나만의 운세로 바뀌어요 ›</Link>
      )}
      <Button to="/today">오늘의 운세 자세히 보기 ›</Button>
    </section>
  );
}

export function CategoryRow({ label, color, summary, stars, to }: { label: string; color?: string; summary: string; stars: number; to?: string }) {
  const inner = (
    <>
      <b style={color ? { color } : undefined}>{label}</b><p>{summary}</p><Stars n={stars} />{to && <span className="chev" aria-hidden>›</span>}
    </>
  );
  return to ? <Link to={to} className="cat" aria-label={`${label} 자세히`}>{inner}</Link> : <div className="cat">{inner}</div>;
}

export function LuckyGrid({ color, colorHex, number, direction }: { color: string; colorHex?: string; number: number | string; direction: string }) {
  return (
    <div className="panel lucky">
      <div>행운 색<b>{colorHex && <i className="sw" style={{ background: colorHex }} aria-hidden />}{color}</b></div>
      <div>행운 숫자<b>{number}</b></div>
      <div>행운 방향<b>{direction}</b></div>
    </div>
  );
}

export function PremiumLock({ children, label = '✦ 프리미엄 회원은 전체를 볼 수 있어요', to = '/premium' }: { children: ReactNode; label?: string; to?: string }) {
  return (
    <div className="plock">
      <div className="blur" aria-hidden>{children}</div>
      <div className="over"><b>{label}</b><Button kind="gold" to={to}>프리미엄 알아보기</Button></div>
    </div>
  );
}

// 웹 = 자리 표시, 앱 = AdMob(10 단계). 프리미엄 회원은 숨김.
export function AdSlot({ premium }: { premium?: boolean }) {
  if (premium) return null;
  return <div className="ad" role="complementary" aria-label="광고">광고 영역 (AdMob 배너 · 프리미엄 회원은 숨김)</div>;
}

export function NoticeCard({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div className="notice">
      <div className="bell" aria-hidden>🔔</div>
      <div><b>매일 아침 챙겨드릴게요</b><span>오늘의 운세 알림</span></div>
      <button className={on ? 'done' : ''} onClick={onToggle} aria-pressed={on}>{on ? '받는 중' : '받기'}</button>
    </div>
  );
}

export const ZODIAC = [
  { key: 'rat', hanja: '子', name: '쥐' }, { key: 'ox', hanja: '丑', name: '소' }, { key: 'tiger', hanja: '寅', name: '범' },
  { key: 'rabbit', hanja: '卯', name: '토끼' }, { key: 'dragon', hanja: '辰', name: '용' }, { key: 'snake', hanja: '巳', name: '뱀' },
  { key: 'horse', hanja: '午', name: '말' }, { key: 'sheep', hanja: '未', name: '양' }, { key: 'monkey', hanja: '申', name: '원숭이' },
  { key: 'rooster', hanja: '酉', name: '닭' }, { key: 'dog', hanja: '戌', name: '개' }, { key: 'pig', hanja: '亥', name: '돼지' },
] as const;
export function ZodiacGrid({ active }: { active?: string }) {
  return (
    <div className="zodiac">
      {ZODIAC.map((z) => (
        <Link key={z.key} to={`/zodiac/${z.key}`} className={`z${active === z.key ? ' on' : ''}`} aria-label={`${z.name}띠 운세`}>
          <i aria-hidden>{z.hanja}</i><span>{z.name}띠</span>
        </Link>
      ))}
    </div>
  );
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

/* ---------- 준비 중 바텀시트 ---------- */
export function ComingSoonSheet({ open, onClose, what }: { open: boolean; onClose: () => void; what: string }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={`${what} — 준비 중이에요`}>
      <CharacterBubble who="sunnyeo">곧 열려요! 문이 열리면 가장 먼저 알려드릴게요.</CharacterBubble>
      <Button kind="line" onClick={onClose}>확인</Button>
    </BottomSheet>
  );
}

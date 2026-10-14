// 타로 탭 /tarot v4 (대표님 2차 수정) — 깊은 밤하늘 + 금 선. 머리 그림 → 오늘의 타로(무료, 실전 타로 테이블) → 주제별 타로·스프레드(그림 썸네일, 3,000원 / 켈틱 4,900원) → 나의 타로 기록
// 실전 타로 테이블(TarotTable): 카드 섞기(효과음) → 테이블 위에 부채꼴로 펼침 → 직접 고르기 → 한 장씩 뒤집으며 해석 → 마지막 종합 메시지. 음소거 버튼.
// 뽑히는 카드는 주문 번호(유료)·날짜+사주(오늘의 타로)로 미리 정해져 있어 다시 열어도 같다 — 사용자가 고른 순서대로 그 카드가 드러난다.
import { PremiumButton } from '../components/PremiumPopup';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { tarotDraw, tarotSpread, tarotSide, type TarotCard } from '@naman/content';
import { AdSlot, ProductCard, toCardItem } from '../components/ui';
import { Img } from '../components/Img';
import { Icon } from '../components/Icon';
import { useRewarded } from '../components/Rewarded';
import { optionalImg, v4 } from '../assets/images';
import { TAROTS, BRAND, displayTitle, productById, type TarotProduct } from '../lib/catalog';
import { isUnlockedToday, useApp, useMainProfile, usePremium } from '../store/app';
import { koDate } from '../lib/dates';
import { track } from '../lib/track';
import { music, sfx } from '../lib/sound';
import { SoundToggle } from '../components/SoundToggle';
import { apiAuth } from '../platform/payments';
import { MOCK_MODE } from '../lib/api';
import { ShareBlock, useShare } from './Fun';

export type Drawn = { card: TarotCard; reversed: boolean };
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
const SUIT = { wands: { icon: 'flame', ko: '완드', theme: '열정과 행동' }, cups: { icon: 'wine', ko: '컵', theme: '감정과 관계' }, swords: { icon: 'sword', ko: '소드', theme: '생각과 결단' }, pentacles: { icon: 'pentagon', ko: '펜타클', theme: '재물과 현실' } } as const;
const MAJOR_ICON: Record<string, string> = { 'major-17': 'star', 'major-18': 'moon', 'major-19': 'sun', 'major-10': 'refresh-cw', 'major-06': 'heart', 'major-01': 'wand-sparkles' };

function Guide({ children }: { children: ReactNode }) {
  const img = optionalImg('wolha_tarot');
  return (
    <div className="tguide">
      {img ? <img src={img.src} alt="" /> : <Img k="wolhaFace" alt="" />}
      <p><small>월하선녀</small>{children}</p>
    </div>
  );
}

// 카드 뒷면 — 남색 바탕 금색 달·별 문양
export function CardBack() {
  return (
    <svg viewBox="0 0 100 160" className="tback" aria-hidden>
      <rect x="4" y="4" width="92" height="152" rx="7" fill="none" stroke="#D9B45A" strokeWidth="1.6" />
      <rect x="9" y="9" width="82" height="142" rx="5" fill="none" stroke="#D9B45A" strokeWidth=".6" opacity=".7" />
      <circle cx="50" cy="80" r="27" fill="none" stroke="#D9B45A" strokeWidth="1" />
      <circle cx="50" cy="80" r="33" fill="none" stroke="#D9B45A" strokeWidth=".5" strokeDasharray="2 3" />
      <path d="M58 66a16 16 0 1 0 0 28a13 13 0 1 1 0-28z" fill="#E6C877" />
      <path d="M50 22l2.4 7 7 2.4-7 2.4L50 41l-2.4-7-7-2.4 7-2.4z M50 119l2.4 7 7 2.4-7 2.4-2.4 7-2.4-7-7-2.4 7-2.4z" fill="#E6C877" />
      {[[20, 20], [80, 20], [20, 140], [80, 140]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill="#E6C877" />)}
      <path d="M14 80h6M80 80h6" stroke="#D9B45A" strokeWidth=".8" />
    </svg>
  );
}
// 카드 앞면 — 1909 라이더-웨이트-스미스 원판 그림(퍼블릭 도메인, 78장 /img/tarot/tarot_<id>.webp).
// _incoming/tarot_<id> 로 다른 그림을 넣으면 그 그림이 우선. 그림이 없을 때만 금테 + 번호 + 상징 아이콘 + 이름.
export const TAROT_ART = true;
export const tarotArt = (id: string) => optionalImg(`tarot_${id}`)?.src ?? (TAROT_ART ? `/img/tarot/tarot_${id}.webp` : null);
export function TarotFace({ d }: { d: Drawn }) {
  const src = tarotArt(d.card.id);
  if (src) return <img src={src} alt={`${d.card.nameEn} ${d.card.nameKo}${d.reversed ? ' 역방향' : ''}`} className={`tface${d.reversed ? ' rev' : ''}`} width={400} height={660} />;
  const c = d.card as TarotCard & { arcana: string; suit: keyof typeof SUIT | null };
  const icon = c.suit ? SUIT[c.suit].icon : MAJOR_ICON[c.id] ?? 'sparkles';
  const num = c.suit ? c.nameKo.replace(/^\S+\s/, '') : ROMAN[+c.id.slice(-2)] ?? '';
  return (
    <div className={`tfront${d.reversed ? ' rev' : ''}`}>
      <span className="num">{num}</span>
      <span className="sym"><Icon name={icon} size={34} stroke={1.3} /></span>
      <b>{c.nameKo}</b>
      <small>{c.nameEn}</small>
    </div>
  );
}

// 실전 타로 테이블 — need 장을 직접 고른다. 다 고르면 자리마다 한 장씩 뒤집는다.
const FAN = 22;
export function TarotTable({ cards, need, positions, onFlip, onDone }: { cards: Drawn[]; need: number; positions?: string[]; onFlip?: (i: number) => void; onDone: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'shuffle' | 'spread' | 'reveal'>('ready');
  const [picked, setPicked] = useState<number[]>([]); // 부채꼴 안의 위치
  const [open, setOpen] = useState(0);
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 배경음악: 테이블이 있는 동안만. 카드 섞기(첫 손짓)에 시작, 테이블을 떠나면 서서히 꺼짐
  useEffect(() => { music.acquire(); return () => music.release(); }, []);
  const shuffle = () => {
    setPhase('shuffle');
    music.start();
    sfx.shuffle();
    setTimeout(() => { setPhase('spread'); sfx.spread(FAN); }, reduce ? 50 : 1500);
  };
  const pickedRef = useRef<number[]>([]); // 빠르게 여러 번 눌러도 최신 값으로 센다
  const pick = (i: number) => {
    const cur = pickedRef.current;
    if (cur.includes(i) || cur.length >= need) return;
    sfx.pick();
    const next = [...cur, i];
    pickedRef.current = next;
    setPicked(next);
    if (next.length === need) setTimeout(() => { sfx.place(); setPhase('reveal'); }, reduce ? 50 : 650);
  };
  const openRef = useRef(0);
  const flip = (k: number) => {
    if (k !== openRef.current) return;
    openRef.current = k + 1;
    sfx.flip(cards[k]?.reversed);
    onFlip?.(k);
    const n = k + 1;
    setOpen(n);
    if (n === need) setTimeout(() => { sfx.finale(); onDone(); }, 900);
  };
  const flipAll = () => {
    for (let k = openRef.current; k < need; k++) onFlip?.(k);
    openRef.current = need;
    sfx.flip(false);
    setOpen(need);
    setTimeout(() => { sfx.finale(); onDone(); }, 700);
  };
  return (
    <div className={`ttable ph-${phase}`}>
      <SoundToggle />
      {phase === 'ready' || phase === 'shuffle' ? (
        <div className="tdeck4">
          <div className={`stack${phase === 'shuffle' ? ' go' : ''}`} aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ ['--k' as string]: i }}><CardBack /></i>)}
          </div>
          <button className="tgold" onClick={shuffle} disabled={phase === 'shuffle'}>{phase === 'shuffle' ? '카드를 섞는 중…' : '카드 섞고 펼치기 ›'}</button>
        </div>
      ) : phase === 'spread' ? (
        <>
          <p className="tlead">마음속 질문을 떠올리며 <b>{need}장</b>을 골라 주세요 <em>{picked.length} / {need}</em></p>
          <div className="tfan4" role="group" aria-label="펼쳐진 타로 카드">
            {Array.from({ length: FAN }, (_, i) => {
              const r = -32 + (64 / (FAN - 1)) * i;
              const sel = picked.indexOf(i);
              return (
                <button key={i} className={`fc${sel >= 0 ? ' sel' : ''}`} style={{ ['--r' as string]: `${r}deg`, ['--d' as string]: `${i * 28}ms` }}
                  onClick={() => pick(i)} disabled={sel >= 0} aria-label={sel >= 0 ? `${sel + 1}번째로 고른 카드` : `${i + 1}번째 카드 고르기`}>
                  <CardBack />
                  {sel >= 0 && <span className="no">{sel + 1}</span>}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="tlead">{open < need ? <>카드를 <b>순서대로 눌러</b> 뒤집어 보세요</> : '모든 카드가 펼쳐졌어요'}</p>
          <div className={`tslots n${need}`}>
            {cards.slice(0, need).map((d, k) => (
              <button key={k} className={`slot${k < open ? ' open' : ''}${k === open ? ' next' : ''}`} onClick={() => flip(k)} disabled={k !== open}
                aria-label={k < open ? `${positions?.[k] ?? ''} ${d.card.nameKo}${d.reversed ? ' 역방향' : ''}` : `${positions?.[k] ?? `${k + 1}번째`} 카드 뒤집기`}>
                <div className="flipper"><div className="back"><CardBack /></div><div className="front">{k < open && <TarotFace d={d} />}</div></div>
                {positions?.[k] && <em>{positions[k]}</em>}
              </button>
            ))}
          </div>
          {open < need && need > 1 && <div className="center"><button className="textlink tall" onClick={flipAll}>한 번에 모두 뒤집기</button></div>}
        </>
      )}
    </div>
  );
}

// 마지막 종합 메시지 — 나온 카드 구성(메이저 수·수트·역방향)과 마지막 자리 카드로 만든다(무료 제공, 결정 2026-10-08)
export function summaryOf(cards: Drawn[], topic?: 'love' | 'money' | 'work') {
  const majors = cards.filter((d) => (d.card as any).arcana === 'major').length;
  const rev = cards.filter((d) => d.reversed).length;
  const suits: Record<string, number> = {};
  for (const d of cards) { const s = (d.card as any).suit; if (s) suits[s] = (suits[s] ?? 0) + 1; }
  const top = Object.entries(suits).sort((a, b) => b[1] - a[1])[0];
  const last = cards[cards.length - 1];
  const ls = tarotSide(last);
  const lines: string[] = [];
  if (cards.length > 1) {
    if (majors >= Math.ceil(cards.length / 2)) lines.push(`메이저 카드가 ${majors}장이나 나왔어요. 지금은 작은 일보다 삶의 큰 흐름이 움직이는 때예요.`);
    else if (majors > 0) lines.push(`메이저 카드 ${majors}장이 중심을 잡아 주고 있어요. 흐름의 방향은 이미 정해지고 있어요.`);
    if (top && top[1] >= 2) lines.push(`${SUIT[top[0] as keyof typeof SUIT].ko} 카드가 많아요 — 이번 고민의 열쇠는 '${SUIT[top[0] as keyof typeof SUIT].theme}'에 있어요.`);
    lines.push(rev === 0 ? '역방향 카드가 없어 기운이 막힘없이 흐르고 있어요.' : rev * 2 > cards.length ? '역방향 카드가 많아요. 서두르기보다 잠시 멈추어 마음을 정리할 때예요.' : '몇 장의 역방향 카드는 조심할 부분을 알려 주는 신호예요.');
  }
  lines.push(`마지막 카드 「${last.card.nameKo}」가 전하는 말 — ${ls.title}.`);
  if (topic) lines.push(ls[topic]);
  return { title: ls.title, lines, keywords: ls.keywords };
}

function TodayTarot() {
  const { profile } = useMainProfile();
  const { unlocked, unlock } = useApp();
  const premium = usePremium();
  const { run, modal } = useRewarded();
  const draw = useMemo(() => tarotDraw(new Date(), profile.id), [profile.id]);
  const dayKey = `tarot:${profile.id}`;
  const done = [0, 1, 2].some((i) => isUnlockedToday(unlocked, `${dayKey}:${i}`));
  const read = isUnlockedToday(unlocked, `${dayKey}:read`);
  const share = useShare();
  const c = done ? draw[0] : null;
  const side = c ? tarotSide(c) : null;
  return (
    <section className="tsec" aria-label="오늘의 타로">
      <h2 className="thead"><small>TODAY'S CARD</small>오늘의 타로<em>무료</em></h2>
      <Guide>{c ? `${c.card.nameKo} 카드가 나왔어요. 오늘 당신에게 건네는 이야기를 들어 봐요.` : '마음을 가라앉히고, 끌리는 카드 한 장을 골라 봐요.'}</Guide>
      {!done ? (
        <TarotTable cards={draw} need={1} onDone={() => { unlock(`${dayKey}:0`); track('page_view', { content: 'tarot' }); }} />
      ) : (
        <div className="tslots n1 done"><div className="slot open"><div className="flipper"><div className="front"><TarotFace d={c!} /></div></div></div></div>
      )}
      {c && side && <p className="tname">{c.card.nameEn}<small>{c.card.nameKo} · {c.reversed ? '역방향' : '정방향'}</small></p>}
      {c && side && !read && (
        <div className="pad mt14">
          <button className="tgold" onClick={() => run(() => unlock(`${dayKey}:read`), 'tarot')}>✦ 카드의 이야기 듣기</button>
          <div className="adnote">{premium ? '프리미엄 회원은 광고 없이 상세 해석까지 바로 열려요' : '짧은 광고 후 카드의 이야기가 열려요'}</div>
          {modal}
        </div>
      )}
      {c && side && read && (
        <>
          <div className="tread">
            <small>{side.keywords.join(' · ')}</small>
            <b>{side.title}</b>
            <p>{side.message[0]}</p>
            {premium ? (
              <>
                {side.message.slice(1).map((m) => <p key={m}>{m}</p>)}
                <dl>
                  <dt>연애</dt><dd>{side.love}</dd>
                  <dt>금전</dt><dd>{side.money}</dd>
                  <dt>일</dt><dd>{side.work}</dd>
                </dl>
                <p className="tprem">✦ 프리미엄 상세 해석 (하루 1회)</p>
              </>
            ) : (
              <Link to="/premium" className="tlock"><b>✦ 연애·금전·일 상세 해석</b><span>프리미엄 회원은 매일 오늘의 카드 상세 해석을 받아요 ›</span></Link>
            )}
          </div>
          <ShareBlock s={share} title="오늘의 타로" text={`오늘의 카드는 ${c.card.nameKo} — ${side.title}`} path="/tarot" id="tarot">
            <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 24, lineHeight: 1.4 }}>{c.card.nameKo} · {side.title}</p>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.75, marginTop: 16 }}>{side.message.join(' ')}</p>
          </ShareBlock>
        </>
      )}
    </section>
  );
}

function Records() {
  const purchases = useApp((s) => s.purchases);
  const mine = purchases.filter((p) => p.productId.startsWith('tarot_') && p.status === 'paid');
  return (
    <section className="tsec" id="records">
      <h2 className="thead"><small>MY TAROT</small>나의 타로 기록</h2>
      {mine.length ? (
        <ul className="trec">
          {mine.map((p) => (
            <li key={p.orderId}><Link to={`/reading/${p.orderId}`}><b>{displayTitle(productById(p.productId)!)}</b><span>{koDate(new Date(p.createdAt))}</span></Link></li>
          ))}
        </ul>
      ) : <p className="tempty">아직 받은 타로 리딩이 없어요. 주제별 타로나 스프레드를 골라 보세요.</p>}
    </section>
  );
}

export default function TarotTab() {
  const premium = usePremium();
  const owned = useApp((s) => s.purchases);
  const byGroup = (g: string) => TAROTS.filter((t) => t.group === g && t.visible !== false).sort((a, b) => a.sort - b.sort);
  return (
    <main className="screen tarot-tab t4">
      <div className="stars" aria-hidden />
      <header className="thero"><img src={v4('tarot_header')} alt="" /><h1 className="sr-only">타로 — 별빛 아래, 카드가 전하는 이야기</h1></header>
      <TodayTarot />
      <PremiumButton />
      {BRAND.groups.tarot.map((g) => (
        <section className="tsec" key={g}>
          <h2 className="thead"><small>{g === '스프레드' ? 'SPREAD' : 'TOPIC'}</small>{g}</h2>
          <div className="plist tlist">{byGroup(g).map((t) => <ProductCard key={t.id} c={toCardItem(t, owned.some((o) => o.productId === t.id))} mode="list" />)}</div>
        </section>
      ))}
      <Records />
      <AdSlot premium={premium} kind="타로 하단" slot="tarot_banner" />
    </main>
  );
}

// 유료 타로 결과 — 처음 열면 실전 타로 테이블에서 직접 고르고 뒤집기, 다 끝나면(또는 다시 열면) 자리별 풀이 + 종합 메시지
const TOPIC: Record<string, 'love' | 'money' | 'work'> = {
  tarot_love: 'love', tarot_reunion: 'love', tarot_mind: 'love', tarot_contact: 'love', tarot_newlove: 'love', tarot_match: 'love',
  tarot_money: 'money', tarot_work: 'work', tarot_choice: 'work', tarot_job: 'work',
};
// 카드를 뽑기 전에 묻는 질문(선택) — 선택의 기로는 A·B 두 선택지를 꼭 적는다. 답은 AI 풀이에 쓰이고, 이 기기에 기억(다시 열어도 같은 질문)
const ASK: Record<string, { label: string; ph: string }> = {
  tarot_mind: { label: '궁금한 그 사람과의 상황', ph: '예) 소개로 만난 지 두 달, 요즘 연락이 뜸해졌어요' },
  tarot_contact: { label: '기다리는 연락에 대해', ph: '예) 2주 전 다툰 뒤로 연락이 없어요' },
  tarot_reunion: { label: '헤어진 상황', ph: '예) 석 달 전 제가 먼저 헤어지자고 했어요' },
  tarot_newlove: { label: '바라는 인연', ph: '예) 진지하게 만날 사람을 찾고 있어요' },
  tarot_match: { label: '두 사람의 관계', ph: '예) 사귄 지 1년, 요즘 자주 다퉈요' },
  tarot_choice: { label: '고민하는 상황', ph: '예) 이직 제안을 받았어요' },
  tarot_job: { label: '지금 상황', ph: '예) 회사 5년 차, 이직 준비 중이에요' },
  tarot_3month: { label: '특히 궁금한 것(연애·일·돈)', ph: '예) 일과 돈의 흐름이 궁금해요' },
};
type TarotIn = { question?: string; a?: string; b?: string };
type TarotAi = { positions: { title: string; text: string }[]; summary: { title: string; text: string }; advice: string[]; keywords: string[]; answer?: string };
const askKey = (o: string) => `naman-tarot-q:${o}`;
const savedAsk = (o: string): TarotIn | null => { try { return JSON.parse(localStorage.getItem(askKey(o)) ?? 'null'); } catch { return null; } };
function TarotAsk({ p, onStart }: { p: TarotProduct; onStart: (x: TarotIn) => void }) {
  const ask = ASK[p.id] ?? { label: '마음속 질문', ph: '예) 지금 이 고민, 어떻게 하면 좋을까요?' };
  const choice = p.id === 'tarot_choice';
  const [q, setQ] = useState(''); const [a, setA] = useState(''); const [b, setB] = useState('');
  const ok = !choice || (a.trim() && b.trim());
  return (
    <form className="task" onSubmit={(e) => { e.preventDefault(); if (ok) onStart({ question: q.trim(), a: a.trim(), b: b.trim() }); }}>
      <p className="tlead">카드를 뽑기 전에 <b>마음속 질문</b>을 떠올려 주세요</p>
      {choice && (
        <div className="ab">
          <label htmlFor="ta">선택지 A<input id="ta" className="input" maxLength={40} value={a} onChange={(e) => setA(e.target.value)} placeholder="예) 지금 회사에 남기" /></label>
          <label htmlFor="tb">선택지 B<input id="tb" className="input" maxLength={40} value={b} onChange={(e) => setB(e.target.value)} placeholder="예) 제안받은 회사로 옮기기" /></label>
        </div>
      )}
      <label htmlFor="tq">{ask.label} <small>(적지 않아도 돼요)</small><textarea id="tq" className="input" maxLength={200} rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder={ask.ph} /></label>
      <button className="tgold" type="submit" disabled={!ok}>{choice && !ok ? '선택지 A·B 를 적어 주세요' : '질문을 품고 카드 펼치러 가기 ›'}</button>
    </form>
  );
}
const doneKey = (o: string) => `naman-tarot-done:${o}`;
const wasDone = (o: string) => { try { return localStorage.getItem(doneKey(o)) === '1'; } catch { return false; } };
export function TarotReading({ p, orderId }: { p: TarotProduct; orderId: string }) {
  const cards = useMemo(() => tarotSpread(`${orderId}:${p.id}`, p.cards), [orderId, p]);
  const [done, setDone] = useState(() => wasDone(orderId));
  const [shown, setShown] = useState(done ? cards.length : 0);
  const [input, setInput] = useState<TarotIn | null>(() => savedAsk(orderId) ?? (wasDone(orderId) ? {} : null));
  const [ai, setAi] = useState<TarotAi | null>(null);
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'off'>('idle');
  const topic = TOPIC[p.id];
  useEffect(() => { if (done) try { localStorage.setItem(doneKey(orderId), '1'); } catch { /* 저장 불가 */ } }, [done, orderId]);
  // 질문을 받으면 바로 AI 풀이를 부탁해 둔다 — 카드를 뒤집는 동안 만들어져, 다 뒤집으면 바로 보인다(다시 열면 저장된 풀이)
  useEffect(() => {
    if (!input || ai || MOCK_MODE) { if (MOCK_MODE) setAiState('off'); return; }
    let live = true;
    setAiState('loading');
    apiAuth<{ ai: TarotAi }>(`/tarot/${encodeURIComponent(orderId)}/reading`, { method: 'POST', body: JSON.stringify(input) })
      .then((r) => { if (live) { setAi(r.ai); setAiState('idle'); } })
      .catch(() => { if (live) setAiState('off'); });
    return () => { live = false; };
  }, [input, orderId]); // 풀이(ai)가 생기면 다시 부르지 않음
  const start = (x: TarotIn) => { try { localStorage.setItem(askKey(orderId), JSON.stringify(x)); } catch { /* 저장 불가 */ } setInput(x); };
  const sum = done && !ai ? summaryOf(cards, topic) : null;
  return (
    <div className="tarot-tab t4 treading">
      <div className="stars" aria-hidden />
      {!input && !done ? <TarotAsk p={p} onStart={start} />
        : !done ? (
          <TarotTable cards={cards} need={p.cards} positions={p.positions.map((x) => x.replace(/^A/, input?.a ? `A(${input.a})` : 'A').replace(/^B/, input?.b ? `B(${input.b})` : 'B'))} onFlip={(k) => setShown((n) => Math.max(n, k + 1))} onDone={() => setDone(true)} />
        ) : (
          <div className={`tslots n${cards.length} done`}>
            {cards.map((d, k) => (
              <div key={k} className="slot open"><div className="flipper"><div className="front"><TarotFace d={d} /></div></div><em>{p.positions[k]}</em></div>
            ))}
          </div>
        )}
      {input?.question && <p className="tq">“{input.question}”</p>}
      {cards.slice(0, shown).map((d, i) => {
        const s = tarotSide(d);
        const x = done ? ai?.positions[i] : undefined;
        return (
          <section className="tread" key={i}>
            <small>{i + 1}. {p.positions[i]} · {d.card.nameEn} ({d.card.nameKo}) {d.reversed ? '역방향' : '정방향'}</small>
            <b>{x?.title || s.title}</b>
            {x ? <p>{x.text}</p> : <>
              <p>{topic ? s[topic] : s.message.join(' ')}</p>
              {topic && <p>{s.message[0]}</p>}
            </>}
          </section>
        );
      })}
      {done && aiState === 'loading' && !ai && <p className="tload" aria-live="polite">월하선녀가 질문에 맞춰 카드를 읽고 있어요…</p>}
      {done && ai && (
        <section className="tsum">
          <small>✦ 월하선녀의 종합 메시지 ✦</small>
          {ai.answer && <p className="tans">{ai.answer}</p>}
          <b>{ai.summary.title}</b>
          <p>{ai.summary.text}</p>
          {ai.advice.length > 0 && <ul className="tadv">{ai.advice.map((x) => <li key={x}>{x}</li>)}</ul>}
          {ai.keywords.length > 0 && <p className="kw">{ai.keywords.map((k) => <span key={k}>#{k}</span>)}</p>}
        </section>
      )}
      {sum && (aiState === 'off' || aiState === 'idle') && (
        <section className="tsum">
          <small>✦ 월하선녀의 종합 메시지 ✦</small>
          <b>{sum.title}</b>
          {sum.lines.map((l) => <p key={l}>{l}</p>)}
          <p className="kw">{sum.keywords.map((k) => <span key={k}>#{k}</span>)}</p>
        </section>
      )}
    </div>
  );
}

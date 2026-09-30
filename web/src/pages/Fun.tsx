// 재미로 보는 운세 (무료·비회원 이용 가능) — 별자리 · 혈액형 · 오늘의 타로 · 꿈 해몽 · MZ 팩폭 사주 · MBTI 사주
// 띠별·혈액형·MBTI·타로 결과는 보상형 광고 후(하루 제한·프리미엄 제외). 문구는 월하선녀 해요체(팩폭만 가벼운 말투).
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  STAR_SIGNS, starSignOf, starToday, BLOOD_TYPES, bloodToday, tarotDraw, tarotSide, DREAM_CATS, DREAM_POPULAR, DREAMS, searchDream,
  factbomb, mbtiResult, MBTI_TYPES, type StarId, type Blood, type DreamEntry,
} from '@naman/content';
import { lunarToSolar } from '@naman/engine';
import { SubHeader, SectionHeader } from '../components/layout';
import { AdSlot, Button, CharacterBubble, PremiumLock, Stars, useToast } from '../components/ui';
import { ShareSheet } from '../components/ShareSheet';
import { ShareCard } from '../components/ShareCard';
import { useRewarded } from '../components/Rewarded';
import { isUnlockedToday, useApp, useMainProfile, usePremium, type Profile } from '../store/app';
import { useSaju } from '../lib/fortune';
import { koDate } from '../lib/dates';
import { track } from '../lib/track';

const solarOf = (p: Profile) => (p.calendar === 'lunar' ? lunarToSolar(p.year, p.month, p.day, p.leap) : { year: p.year, month: p.month, day: p.day });

// 결과 공유 공통: 공유 버튼 + 시트 + 카드
function useShare() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return { open, setOpen, ref };
}
function ShareBlock({ s, title, text, path, id, children }: { s: ReturnType<typeof useShare>; title: string; text: string; path: string; id: string; children: ReactNode }) {
  const toast = useToast();
  return (
    <>
      <div className="pad mt14"><Button kind="ink" onClick={() => s.setOpen(true)}>결과 이미지로 공유하기</Button></div>
      <ShareSheet open={s.open} onClose={() => s.setOpen(false)} card={s.ref} title={title} text={text} path={path} contentId={id} onDone={(m) => m && toast(m)} />
      <ShareCard ref={s.ref} title={title} sub={koDate()}>{children}</ShareCard>
    </>
  );
}
// 보상형 광고 게이트
function Gate({ k, label, children }: { k: string; label: string; children: ReactNode }) {
  const premium = usePremium();
  const { unlocked, unlock } = useApp();
  const { run, modal } = useRewarded();
  if (premium || isUnlockedToday(unlocked, k)) return <>{children}</>;
  return (
    <div className="pad mt14">
      <Button kind="gold" onClick={() => run(() => unlock(k), k)}>✦ {label}</Button>
      <div className="adnote">짧은 광고를 보시면 결과가 열립니다 · 하루 횟수 제한 · 프리미엄 회원은 광고 없음</div>
      {modal}
    </div>
  );
}

/* ---------------- 별자리 ---------------- */
export function StarPage() {
  const { profile } = useMainProfile();
  const b = solarOf(profile);
  const mine = starSignOf(b.month, b.day);
  const [sign, setSign] = useState<StarId>(mine);
  const r = starToday(sign, new Date(), profile.id);
  const share = useShare();
  const premium = usePremium();
  return (
    <>
      <SubHeader title="별자리 운세" sub="별자리가 알려주는 오늘의 운" />
      <main className="screen">
        <div className="mt14" />
        <div className="pickgrid">
          {STAR_SIGNS.map((s) => (
            <button key={s.id} className={s.id === sign ? 'on' : ''} aria-pressed={s.id === sign} onClick={() => setSign(s.id)}>
              <i aria-hidden>{s.id === mine ? '★' : '☆'}</i>{s.name}
            </button>
          ))}
        </div>
        <section className="dres">
          <div className="in">
            <small>{r.sign.name} · {r.elementKo}의 별자리{sign === mine ? ' · 나의 별자리' : ''}</small>
            <b className="t">{r.oneLine}</b>
            <Stars n={r.stars} />
            <div className="rows">
              <div><b>연애</b><span>{r.love}</span></div>
              <div><b>금전</b><span>{r.money}</span></div>
              <div><b>일</b><span>{r.work}</span></div>
              <div><b>행운템</b><span>{r.item}</span></div>
              <div><b>행운 시간</b><span>{r.time}</span></div>
            </div>
          </div>
        </section>
        <div className="freeresult"><h2>{r.sign.name}는 이런 사람이에요</h2>{r.intro.map((t) => <p key={t}>{t}</p>)}</div>
        <ShareBlock s={share} title={`${r.sign.name} 오늘의 운세`} text={`${r.sign.name} 오늘 — ${r.oneLine}`} path="/fun/zodiac-star" id={`star-${sign}`}>
          <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 26 }}>{r.sign.name} <Stars n={r.stars} /></p>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 20, lineHeight: 1.7, margin: '12px 0' }}>{r.oneLine}</p>
          <p style={{ fontSize: 17, lineHeight: 1.7 }}>연애 · {r.love}<br />금전 · {r.money}<br />일 · {r.work}<br />행운템 · {r.item}</p>
        </ShareBlock>
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

/* ---------------- 혈액형 ---------------- */
export function BloodPage() {
  const { profile, isSample } = useMainProfile();
  const { patchProfile } = useApp();
  const saju = useSaju(profile);
  const [type, setType] = useState<Blood | null>(profile.bloodType ?? null);
  const share = useShare();
  const premium = usePremium();
  const choose = (t: Blood) => { setType(t); if (!isSample) patchProfile(profile.id, { bloodType: t }); };
  const r = type ? bloodToday(type, saju, new Date(), profile.id) : null;
  return (
    <>
      <SubHeader title="혈액형 운세" sub="혈액형으로 보는 오늘의 운" />
      <main className="screen">
        <div className="mt14" />
        <CharacterBubble who="wolha">혈액형을 골라 주세요. 한 번 고르면 기억해 둘게요.</CharacterBubble>
        <div className="pickgrid">{BLOOD_TYPES.map((t) => <button key={t} className={type === t ? 'on' : ''} aria-pressed={type === t} onClick={() => choose(t)}><i aria-hidden>血</i>{t}형</button>)}</div>
        {r && (
          <Gate k={`blood:${r.type}`} label={`${r.type}형 오늘 운세 보기`}>
            <section className="dres">
              <div className="in">
                <small>{r.type}형 · {koDate()}</small>
                <b className="t">{r.oneLine}</b>
                <Stars n={r.stars} />
                <div className="rows">
                  <div><b>관계 팁</b><span>{r.tip}</span></div>
                  <div><b>조심</b><span>{r.caution}</span></div>
                  <div><b>잘 맞아요</b><span>{r.best}형 — {r.match}</span></div>
                </div>
              </div>
            </section>
            <div className="freeresult"><h2>{r.type}형의 오늘 기질</h2>{r.trait.map((t) => <p key={t}>{t}</p>)}</div>
            <ShareBlock s={share} title={`${r.type}형 오늘의 운세`} text={`${r.type}형 오늘 — ${r.oneLine}`} path="/fun/blood" id={`blood-${r.type}`}>
              <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 30 }}>{r.type}형 <Stars n={r.stars} /></p>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 20, lineHeight: 1.7, margin: '12px 0' }}>{r.oneLine}</p>
              <p style={{ fontSize: 17, lineHeight: 1.7 }}>관계 팁 · {r.tip}<br />잘 맞는 혈액형 · {r.best}형</p>
            </ShareBlock>
          </Gate>
        )}
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

/* ---------------- 오늘의 타로 ---------------- */
export function TarotPage() {
  const { profile } = useMainProfile();
  const premium = usePremium();
  const { unlocked, unlock } = useApp();
  const { run, modal } = useRewarded();
  const draw = useMemo(() => tarotDraw(new Date(), profile.id), [profile.id]);
  const dayKey = `tarot:${profile.id}`;
  // 오늘 고른 카드(같은 날 다시 와도 같은 카드) — unlocked 에 "tarot:<프로필>:<번호>" 로 기록
  const saved = [0, 1, 2].find((i) => isUnlockedToday(unlocked, `${dayKey}:${i}`));
  const [pickI, setPickI] = useState<number | null>(saved ?? null);
  const [flip, setFlip] = useState(false);
  const share = useShare();
  const choose = (i: number) => {
    if (pickI != null) return;
    run(() => { setPickI(i); setFlip(true); unlock(`${dayKey}:${i}`); track('content_view', { content: 'tarot' }); }, 'tarot');
  };
  const c = pickI != null ? draw[pickI] : null;
  const side = c ? tarotSide(c) : null;
  const FIELDS: [string, 'love' | 'money' | 'work'][] = [['연애', 'love'], ['금전', 'money'], ['일', 'work']];
  return (
    <>
      <SubHeader title="오늘의 타로" sub="카드 한 장으로 보는 오늘의 메시지" />
      <main className="screen">
        <div className="mt14" />
        {!c && <CharacterBubble who="wolha">마음을 가라앉히고, 끌리는 카드 한 장을 골라 보세요.</CharacterBubble>}
        <div className="tarot">
          {draw.map((d, i) => {
            const picked = pickI === i;
            return (
              <button key={i} className={`tc${picked ? ` pick${flip ? ' flip' : ''}${d.reversed ? ' rev' : ''}` : ''}`} onClick={() => choose(i)} disabled={pickI != null && !picked} aria-label={picked ? `${d.card.nameKo}${d.reversed ? ' 역방향' : ''}` : `${i + 1}번째 카드 고르기`}>
                <div className="in">{picked ? <><span>{d.card.symbol}</span><small>{d.card.nameEn}</small></> : <span>{['月', '星', '日'][i]}</span>}</div>
              </button>
            );
          })}
        </div>
        {modal}
        {c && side && (
          <>
            <section className="dres">
              <div className="in">
                <small>오늘의 카드 · {c.card.nameKo}({c.card.nameEn}) {c.reversed ? '역방향' : '정방향'} · {side.keywords.join(' · ')}</small>
                <b className="t">{side.title}</b>
                {side.message.map((m) => <p key={m}>{m}</p>)}
                {!premium && <div className="lock">✦ 프리미엄 — 연애·금전·일 카드 3장 상세 해석</div>}
              </div>
            </section>
            {premium ? (
              <div className="spread">
                {draw.map((d, i) => { const s = tarotSide(d); return <div key={i}><b>{FIELDS[i][0]}</b><strong>{d.card.nameKo}{d.reversed ? '(역)' : ''}</strong><p>{s[FIELDS[i][1]]}</p></div>; })}
              </div>
            ) : (
              <PremiumLock label="✦ 연애·금전·일 3장 스프레드는 프리미엄 회원에게 열려요">
                <div className="spread">{FIELDS.map(([l]) => <div key={l}><b>{l}</b><strong>카드</strong><p>상세 해석이 여기에 보여요.</p></div>)}</div>
              </PremiumLock>
            )}
            <ShareBlock s={share} title="오늘의 타로" text={`오늘의 카드는 ${c.card.nameKo} — ${side.title}`} path="/fun/tarot" id="tarot">
              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <div className="tc big pick" style={{ transform: 'none' }}><div className="in"><span>{c.card.symbol}</span><small>{c.card.nameEn}</small></div></div>
                <div><p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 22, lineHeight: 1.4 }}>{side.title}</p><p style={{ fontSize: 16, marginTop: 8 }}>{c.card.nameKo} · {c.reversed ? '역방향' : '정방향'}</p></div>
              </div>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.75, marginTop: 16 }}>{side.message.join(' ')}</p>
            </ShareBlock>
          </>
        )}
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

/* ---------------- 꿈 해몽 ---------------- */
export function DreamPage() {
  const premium = usePremium();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [res, setRes] = useState<ReturnType<typeof searchDream> | null>(null);
  const [sel, setSel] = useState<DreamEntry | null>(null);
  const share = useShare();
  const doSearch = (text: string) => {
    setQ(text);
    const r = searchDream(text);
    setRes(r);
    setCat(null);
    setSel(r.hits.length === 1 ? r.hits[0] : null);
    track('dream_search', { q: text, hits: r.hits.length });
  };
  const list = cat ? DREAMS.filter((d) => d.category === cat) : res?.hits ?? [];
  const TONE = { good: '길몽', bad: '조심', neutral: '보통' } as Record<string, string>;
  return (
    <>
      <SubHeader title="꿈 해몽" sub="어젯밤 꿈, 어떤 의미일까?" />
      <main className="screen">
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) doSearch(q); }}>
          <span aria-hidden>🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="어떤 꿈을 꾸셨나요?" aria-label="꿈 검색" enterKeyHint="search" />
          <button type="submit">풀이</button>
        </form>
        <div className="kw">{DREAM_POPULAR.map((k) => <button key={k} onClick={() => doSearch(k)}>{k}</button>)}</div>
        <div className="dcat">
          {DREAM_CATS.map((c) => <button key={c.id} className={cat === c.id ? 'on' : ''} aria-pressed={cat === c.id} onClick={() => { setCat(cat === c.id ? null : c.id); setSel(null); setRes(null); }}><i aria-hidden>{c.hanja}</i>{c.label}</button>)}
        </div>
        {sel ? (
          <>
            <section className="dres">
              <div className="in">
                <small>{sel.word} · {DREAM_CATS.find((c) => c.id === sel.category)?.label} · {TONE[sel.tone]}</small>
                <b className="t">{sel.title}</b>
                {sel.basic.map((t) => <p key={t}>{t}</p>)}
                {!premium && <div className="lock">✦ 프리미엄 — 꿈의 상황별 상세 해몽 · 오늘의 행동 조언</div>}
              </div>
            </section>
            {premium ? (
              <div className="freeresult">
                <h2>상황별 상세 해몽</h2>
                <div className="kv">{sel.details.map((d) => <div key={d.situation}><b>{d.situation}</b><span>{d.meaning}</span></div>)}<div><b>오늘의 조언</b><span>{sel.advice}</span></div></div>
              </div>
            ) : (
              <PremiumLock label="✦ 상황별 상세 해몽은 프리미엄 회원에게 열려요"><div className="freeresult"><div className="kv">{sel.details.map((d) => <div key={d.situation}><b>{d.situation}</b><span>…</span></div>)}</div></div></PremiumLock>
            )}
            <ShareBlock s={share} title="꿈 해몽" text={`${sel.word} — ${sel.title}`} path="/fun/dream" id={`dream-${sel.id}`}>
              <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 24 }}>{sel.word}</p>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 21, margin: '10px 0', color: 'var(--gold-deep)' }}>{sel.title}</p>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.75 }}>{sel.basic.join(' ')}</p>
            </ShareBlock>
            <div className="center"><button className="textlink" onClick={() => setSel(null)}>다른 꿈 보기</button></div>
          </>
        ) : (
          <>
            {res && !res.hits.length && (
              <div className="freeresult"><h2>딱 맞는 꿈을 찾지 못했어요</h2><p>비슷한 꿈을 골라 보세요.</p></div>
            )}
            <ul className="dlist">
              {(res && !res.hits.length ? res.near : list).map((d) => (
                <li key={d.id}><button onClick={() => { setSel(d); track('content_view', { content: 'dream', id: d.id }); }}>{d.word}<span className={`tone-${d.tone}`}>{TONE[d.tone]}</span></button></li>
              ))}
            </ul>
          </>
        )}
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

/* ---------------- MZ 팩폭 사주 ---------------- */
export function FactbombPage() {
  const { profile, isSample } = useMainProfile();
  const saju = useSaju(profile);
  const r = factbomb(saju, profile.id);
  const share = useShare();
  const premium = usePremium();
  return (
    <>
      <SubHeader title="MZ 팩폭 사주" sub="뼈 때리는 나의 찐 성격" />
      <main className="screen">
        <section className="fbcard">
          <div className="in">
            <small>{profile.name}님의 사주 팩폭{isSample ? ' (예시)' : ''}</small>
            <h2>“{r.title}”</h2>
            <ol>{r.bombs.map((b) => <li key={b}>{b}</li>)}</ol>
            <p className="good"><b>그래도 좋은 점</b><br />{r.merit}</p>
            <p className="good"><b>찰떡 궁합 일간</b> — {r.buddy} 일간인 사람</p>
            <div className="tags">{r.hashtags.map((h) => <span key={h}>#{h}</span>)}</div>
          </div>
        </section>
        <p className="note pad">일간 {r.stemName} · 가장 강한 기운 기준 · 재미로만 봐 주세요</p>
        <ShareBlock s={share} title="MZ 팩폭 사주" text={`나의 사주 팩폭: “${r.title}”`} path="/fun/factbomb" id="factbomb">
          <div style={{ background: 'var(--ink)', color: 'var(--on-ink)', borderRadius: 18, padding: 22, height: '100%' }}>
            <p style={{ color: 'var(--gold-light)', fontSize: 15, letterSpacing: '.2em' }}>MZ 팩폭 사주</p>
            <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 28, lineHeight: 1.35, margin: '10px 0 16px' }}>“{r.title}”</p>
            {r.bombs.map((b, i) => <p key={b} style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 8 }}>{i + 1}. {b}</p>)}
            <p style={{ fontSize: 17, marginTop: 12, color: 'var(--gold-light)' }}>{r.hashtags.map((h) => `#${h}`).join(' ')}</p>
          </div>
        </ShareBlock>
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

/* ---------------- MBTI 사주 ---------------- */
export function MbtiPage() {
  const { profile, isSample } = useMainProfile();
  const { patchProfile } = useApp();
  const saju = useSaju(profile);
  const premium = usePremium();
  const [type, setType] = useState<string | null>(profile.mbti ?? null);
  const share = useShare();
  const r = type ? mbtiResult(type, saju) : null;
  const choose = (t: string) => { setType(t); if (!isSample) patchProfile(profile.id, { mbti: t }); };
  return (
    <>
      <SubHeader title="MBTI 사주" sub="MBTI와 사주로 알아보는 진짜 나의 성격" />
      <main className="screen">
        <div className="mt14" />
        <CharacterBubble who="wolha">MBTI 유형을 골라 주세요. 사주의 기운과 함께 풀어 드릴게요.</CharacterBubble>
        <div className="pickgrid">{MBTI_TYPES.map((t) => <button key={t} className={type === t ? 'on' : ''} aria-pressed={type === t} onClick={() => choose(t)}>{t}</button>)}</div>
        {r && (
          <Gate k={`mbti:${r.type}`} label={`${r.type} 풀이 보기`}>
            <section className="dres">
              <div className="in">
                <small>{r.type}</small>
                <b className="t">{r.nick}</b>
                {r.traits.map((t) => <p key={t}>{t}</p>)}
                <div className="rows"><div><b>강점</b><span>{r.strength}</span></div><div><b>조심</b><span>{r.caution}</span></div></div>
              </div>
            </section>
            <SectionHeader en="WITH SAJU" title={<>{r.type} × <em>{r.elementKo} 일간</em></>} />
            {premium ? <div className="freeresult"><p>{r.saju}</p></div> : <PremiumLock label="✦ MBTI × 사주 연결 풀이는 프리미엄 회원에게 열려요"><div className="freeresult"><p>{r.saju}</p></div></PremiumLock>}
            <ShareBlock s={share} title="MBTI 사주" text={`나는 ${r.type} — ${r.nick}`} path="/fun/mbti" id={`mbti-${r.type}`}>
              <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 40 }}>{r.type}</p>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--gold-deep)', margin: '6px 0 14px' }}>{r.nick}</p>
              {r.traits.map((t) => <p key={t} style={{ fontSize: 18, lineHeight: 1.7 }}>{t}</p>)}
            </ShareBlock>
          </Gate>
        )}
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

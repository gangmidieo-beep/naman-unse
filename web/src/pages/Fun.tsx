// 재미로 보는 운세 (무료·비회원 이용 가능) — 별자리 · 혈액형 · 꿈 해몽 · MZ 팩폭 사주 · MBTI 사주 · 스몰사주 · 한줄사주
// 3차 요청(2026-10-14, 대표님 시안): 한자 대신 그림, 카드형 화면, 읽을거리 보강
// 띠별·혈액형·MBTI·타로 결과는 보상형 광고 후(하루 제한·프리미엄 제외). 문구는 월하선녀 해요체(팩폭만 가벼운 말투).
import { useRef, useState, type ReactNode } from 'react';
import {
  STAR_SIGNS, starSignOf, starToday, BLOOD_TYPES, bloodToday, DREAM_CATS, DREAM_POPULAR, DREAMS, searchDream,
  factbomb, factbombToday, mbtiResult, mbtiToday, mbtiNick, MBTI_TYPES, smallSaju, oneLineSaju, type StarId, type Blood, type DreamEntry,
} from '@naman/content';
import { lunarToSolar } from '@naman/engine';
import { SubHeader } from '../components/layout';
import { AdSlot, Button, CharacterBubble, PremiumLock, Stars, useToast } from '../components/ui';
import { ShareSheet } from '../components/ShareSheet';
import { ShareCard } from '../components/ShareCard';
import { useRewarded } from '../components/Rewarded';
import { Icon } from '../components/Icon';
import { isUnlockedToday, useApp, useMainProfile, usePremium, type Profile } from '../store/app';
import { useSaju } from '../lib/fortune';
import { koDate } from '../lib/dates';
import { track } from '../lib/track';
import { BloodDrop, StarArt, funImg } from '../components/FunArt';

const solarOf = (p: Profile) => (p.calendar === 'lunar' ? lunarToSolar(p.year, p.month, p.day, p.leap) : { year: p.year, month: p.month, day: p.day });

// 결과 공유 공통: 공유 버튼 + 시트 + 카드
export function useShare() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return { open, setOpen, ref };
}
export function ShareBlock({ s, title, text, path, id, children }: { s: ReturnType<typeof useShare>; title: string; text: string; path: string; id: string; children: ReactNode }) {
  const toast = useToast();
  return (
    <>
      <div className="pad mt14"><Button kind="gold" onClick={() => s.setOpen(true)}>결과 이미지로 공유하기</Button></div>
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
// 시안 순서(양자리부터) + 날짜 표시
const STAR_ORDER: StarId[] = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
function starRange(id: StarId) {
  const k = STAR_SIGNS.findIndex((s) => s.id === id);
  const s = STAR_SIGNS[k];
  const n = STAR_SIGNS[(k + 1) % STAR_SIGNS.length];
  const end = new Date(Date.UTC(2001, n.from[0] - 1, n.from[1] - 1));
  return `${s.from[0]}.${s.from[1]} - ${end.getUTCMonth() + 1}.${end.getUTCDate()}`;
}
export function StarPage() {
  const { profile } = useMainProfile();
  const b = solarOf(profile);
  const mine = starSignOf(b.month, b.day);
  const [sign, setSign] = useState<StarId>(mine);
  const r = starToday(sign, new Date(), profile.id);
  const share = useShare();
  const premium = usePremium();
  const rows = [
    { icon: 'heart', label: '연애', v: r.love },
    { icon: 'coins', label: '금전', v: r.money },
    { icon: 'briefcase', label: '일', v: r.work },
    { icon: 'clover', label: '행운컬러', v: r.color },
    { icon: 'gift', label: '행운템', v: r.item },
    { icon: 'clock', label: '행운시간', v: r.time },
  ];
  return (
    <>
      <SubHeader title="별자리 운세" sub="별자리가 알려주는 오늘의 운" />
      <main className="screen fun-page">
        <div className="mt14" />
        <div className="sgrid">
          {STAR_ORDER.map((id) => {
            const s = STAR_SIGNS.find((x) => x.id === id)!;
            return (
              <button key={id} className={id === sign ? 'on' : ''} aria-pressed={id === sign} onClick={() => setSign(id)}>
                <StarArt id={id} size={58} />
                <b>{s.name}</b>
                <small>{starRange(id)}</small>
                {id === mine && <em>나</em>}
              </button>
            );
          })}
        </div>
        <section className="shero">
          <StarArt id={sign} size={170} className="big" />
          <StarArt id={sign} kind="starc" size={60} className="cons" />
          <small><StarArt id={sign} size={30} className="mini" />{r.sign.name} · 오늘의 운세{sign === mine ? ' · 나의 별자리' : ''}</small>
          <b className="t">{r.oneLine}</b>
          <Stars n={r.stars} />
          <div className="srows">{rows.map((x) => <div key={x.label}><Icon name={x.icon} size={19} /><b>{x.label}</b><span>{x.v}</span></div>)}</div>
          <span className="en">{r.sign.en.toUpperCase()}</span>
        </section>
        <section className="sabout">
          <StarArt id={sign} kind="starc" size={64} className="cons" />
          <h2><span aria-hidden>✦</span> {r.sign.name}는 이런 사람이에요</h2>
          {r.intro.map((t) => <p key={t}>{t}</p>)}
          <p className="muted">{r.elementKo}의 별자리</p>
        </section>
        <ShareBlock s={share} title={`${r.sign.name} 오늘의 운세`} text={`${r.sign.name} 오늘 — ${r.oneLine}`} path="/fun/zodiac-star" id={`star-${sign}`}>
          <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 26 }}>{r.sign.name} <Stars n={r.stars} /></p>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 20, lineHeight: 1.7, margin: '12px 0' }}>{r.oneLine}</p>
          <p style={{ fontSize: 17, lineHeight: 1.7 }}>연애 · {r.love}<br />금전 · {r.money}<br />일 · {r.work}<br />행운컬러 · {r.color}</p>
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
      <main className="screen fun-page">
        <div className="mt14" />
        <CharacterBubble who="wolha">혈액형을 골라 주세요. 한 번 고르면 오늘의 운을 자세히 알려 드릴게요.</CharacterBubble>
        <div className="bpick">{BLOOD_TYPES.map((t) => <button key={t} className={type === t ? 'on' : ''} aria-pressed={type === t} onClick={() => choose(t)}><BloodDrop type={t} size={34} />{t}형</button>)}</div>
        {r && (
          <Gate k={`blood:${r.type}`} label={`${r.type}형 오늘 운세 보기`}>
            <section className="bhero">
              <div className="bmed"><BloodDrop type={r.type} size={74} ring /></div>
              <div className="btx">
                <small>{r.type}형 · {koDate()}</small>
                <b className="t">{r.oneLine}</b>
                <Stars n={r.stars} />
                <p>오늘은 {r.groupLabel}입니다.</p>
              </div>
              <div className="bcards">
                <div><Icon name="heart" size={20} /><b>연애운</b><Stars n={r.love.stars} /><span>{r.love.line}</span></div>
                <div><Icon name="coins" size={20} /><b>금전운</b><Stars n={r.money.stars} /><span>{r.money.line}</span></div>
                <div><Icon name="briefcase" size={20} /><b>일·학업운</b><Stars n={r.work.stars} /><span>{r.work.line}</span></div>
                <div><Icon name="flower" size={20} /><b>행운 아이템</b><em>{r.lucky.item}</em><span>{r.lucky.why}</span></div>
                <div><Icon name="clock" size={20} /><b>행운 시간</b><em>{r.lucky.time}</em><span>이 시간대에 좋은 소식이나 연락이 올 수 있어요.</span></div>
              </div>
            </section>
            <div className="bpoints">
              <div><small>오늘의 키워드</small><b>{r.keywords.join(' · ')}</b></div>
              <div><small>행운의 색</small><b>{r.lucky.color}</b></div>
              <div><small>주의할 점</small><b>{r.caution}</b></div>
            </div>
            <section className="btoday">
              <img src={funImg('blood_land')} alt="" aria-hidden />
              <h2><span aria-hidden>✦</span> {r.type}형의 오늘 기질</h2>
              <p className="bq">“{r.quote}”</p>
              {r.todayTrait.map((t) => <p key={t}>{t}</p>)}
            </section>
            <section className="babout">
              <h2>{r.type}형은 이런 사람이에요</h2>
              <p>{r.about}</p>
              <div className="chips">{r.tags.map((t) => <span key={t}>{t}</span>)}</div>
              <p className="bmatch"><b>오늘 잘 맞는 혈액형</b> {r.best}형 — {r.match}</p>
            </section>
            <ShareBlock s={share} title={`${r.type}형 오늘의 운세`} text={`${r.type}형 오늘 — ${r.oneLine}`} path="/fun/blood" id={`blood-${r.type}`}>
              <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 30 }}>{r.type}형 <Stars n={r.stars} /></p>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 20, lineHeight: 1.7, margin: '12px 0' }}>{r.oneLine}</p>
              <p style={{ fontSize: 17, lineHeight: 1.7 }}>오늘의 키워드 · {r.keywords.join(' · ')}<br />행운 아이템 · {r.lucky.item}<br />행운 시간 · {r.lucky.time}</p>
            </ShareBlock>
          </Gate>
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
  // 프리미엄 상세 해몽은 하루 1회(대표님 표 2026-10-12) — 오늘 연 꿈은 다시 봐도 됨
  const { unlocked, unlock } = useApp();
  const openedToday = Object.keys(unlocked).filter((k) => k.startsWith('dream-detail:') && isUnlockedToday(unlocked, k));
  const detailOpen = !!sel && openedToday.includes(`dream-detail:${sel.id}`);
  const detailUsed = openedToday.length ? DREAMS.find((d) => `dream-detail:${d.id}` === openedToday[0])?.word ?? '다른 꿈' : null;
  const TONE = { good: '길몽', bad: '조심', neutral: '보통' } as Record<string, string>;
  const catLabel = (id: string) => DREAM_CATS.find((c) => c.id === id)?.label ?? '';
  return (
    <>
      <SubHeader title="꿈 해몽" sub="어젯밤 꿈, 어떤 의미일까?" />
      <main className="screen fun-page">
        <div className="dhero" style={{ backgroundImage: `url(${funImg('dream_hero')})` }} aria-hidden />
        <form className="search dsearch" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) doSearch(q); }}>
          <Icon name="search" size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="어떤 꿈을 꾸셨나요?" aria-label="꿈 검색" enterKeyHint="search" />
          <button type="submit">풀이</button>
        </form>
        <div className="kw">{DREAM_POPULAR.map((k) => <button key={k} onClick={() => doSearch(k)}>{k}</button>)}</div>
        {sel ? (
          <>
            <section className="dres dres-img">
              <img src={funImg(`dream_${sel.category}`)} alt="" aria-hidden />
              <div className="in">
                <small>{sel.word} · {catLabel(sel.category)} <span className={`tone tone-${sel.tone}`}>{TONE[sel.tone]}</span></small>
                <b className="t">{sel.title}</b>
                {sel.basic.map((t) => <p key={t}>{t}</p>)}
                {!premium && <div className="lock">✦ 프리미엄 — 꿈의 상황별 상세 해몽 · 오늘의 행동 조언</div>}
              </div>
            </section>
            {premium && !detailOpen ? (
              <div className="freeresult center">
                {detailUsed ? <p className="muted">상세 꿈 해몽은 <b>하루 1회</b>예요. 오늘은 「{detailUsed}」를 보셨어요. 내일 다시 열려요.</p>
                  : <Button kind="gold" onClick={() => unlock(`dream-detail:${sel.id}`)}>✦ 상세 꿈 해몽 열기 (오늘 1회)</Button>}
              </div>
            ) : premium ? (
              <div className="freeresult">
                <h2>상황별 상세 해몽</h2>
                <div className="kv">{sel.details.map((d) => <div key={d.situation}><b>{d.situation}</b><span>{d.meaning}</span></div>)}<div><b>오늘의 조언</b><span>{sel.advice}</span></div></div>
              </div>
            ) : (
              <PremiumLock label="✦ 상황별 상세 해몽은 프리미엄 회원에게 열려요"><div className="freeresult"><div className="kv">{sel.details.map((d) => <div key={d.situation}><b>{d.situation}</b><span>…</span></div>)}</div></div></PremiumLock>
            )}
            <ShareBlock s={share} title="꿈 해몽" text={`${sel.word} — ${sel.title}`} path="/fun/dream" id={`dream-${sel.id}`}>
              <img src={funImg(`dream_${sel.category}`)} alt="" style={{ width: '100%', borderRadius: 14, marginBottom: 12 }} />
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
            {(cat || res) && <h3 className="dlist-t">{cat ? `${catLabel(cat)} 꿈` : `「${q}」 검색 결과`}</h3>}
            <ul className="dlist">
              {(res && !res.hits.length ? res.near : list).map((d) => (
                <li key={d.id}><button onClick={() => { setSel(d); track('content_view', { content: 'dream', id: d.id }); }}>{d.word}<span className={`tone-${d.tone}`}>{TONE[d.tone]}</span></button></li>
              ))}
            </ul>
          </>
        )}
        {!sel && (
          <div className="dcards">
            {DREAM_CATS.map((c) => (
              <button key={c.id} className={cat === c.id ? 'on' : ''} aria-pressed={cat === c.id} onClick={() => { setCat(cat === c.id ? null : c.id); setSel(null); setRes(null); }}>
                <img src={funImg(`dream_${c.id}`)} alt="" loading="lazy" decoding="async" />
                <b>{c.label}</b><i aria-hidden>›</i>
              </button>
            ))}
          </div>
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
  const rx = factbombToday(profile.id, new Date());
  const share = useShare();
  const premium = usePremium();
  const MERIT_ICON = ['leaf', 'gem'];
  return (
    <>
      <SubHeader title="MZ 팩폭 사주" sub="뼈 때리는 나의 찐 성격" />
      <main className="screen fun-page">
        <section className="fhero mt14" style={{ backgroundImage: `url(${funImg('fact_hero')})` }}>
          <small>{profile.name}님의 사주 팩폭{isSample ? ' (예시)' : ''}</small>
          <h2>“{r.title}”</h2>
          <p>나는 <b>{r.me.name}</b> — {r.me.desc}</p>
        </section>
        <div className="fgrid2">
          <section className="fbox">
            <h3><Icon name="target" size={22} /> 찔리는 포인트 <small>이런 모습, 혹시 공감되시나요?</small></h3>
            <ol className="fnum">{r.bombs.map((b) => <li key={b}>{b}</li>)}</ol>
          </section>
          <section className="fbox">
            <h3><Icon name="sparkles" size={22} /> 그래도 좋은 점 <small>이런 매력이 있어요!</small></h3>
            <ul className="fmerit">{r.merits.map((m, i) => <li key={m}><i aria-hidden><Icon name={MERIT_ICON[i] ?? 'star'} size={20} /></i>{m}</li>)}</ul>
          </section>
        </div>
        <div className="f3">
          <div><i aria-hidden><Icon name="heart" size={22} /></i><b>연애 팩폭</b><p>{r.love}</p></div>
          <div><i aria-hidden><Icon name="coins" size={22} /></i><b>돈 팩폭</b><p>{r.money}</p></div>
          <div><i aria-hidden><Icon name="briefcase" size={22} /></i><b>일 팩폭</b><p>{r.work}</p></div>
        </div>
        <section className="frx"><Icon name="sparkles" size={22} /><b>오늘의 처방</b><p>“{rx}”</p></section>
        <div className="ftype">
          <div>
            <small><Icon name="users" size={18} /> 찰떡 궁합 타입</small>
            <b>{r.buddyType.name}</b>
            <p>{r.buddyType.desc}</p>
            <em>[{r.buddyType.stem} 기운이 강한 사람]</em>
          </div>
          <div>
            <small><Icon name="message-circle" size={18} /> 오늘 피곤해질 수 있는 타입</small>
            <b>{r.tiredType.name}</b>
            <p>{r.tiredType.line}</p>
            <em>[{r.tiredType.stem} 기운이 강한 사람]</em>
          </div>
        </div>
        <div className="fkw"><b>#</b><span>한 줄 키워드</span>{r.tags4.map((h) => <em key={h}>#{h}</em>)}</div>
        <p className="note pad">일간(나를 나타내는 글자) {r.stemName} · 가장 강한 기운 기준 · 재미로만 봐 주세요</p>
        <ShareBlock s={share} title="MZ 팩폭 사주" text={`나의 사주 팩폭: “${r.title}”`} path="/fun/factbomb" id="factbomb">
          <div style={{ background: 'var(--ink)', color: 'var(--on-ink)', borderRadius: 18, padding: 22, height: '100%' }}>
            <p style={{ color: 'var(--gold-light)', fontSize: 15, letterSpacing: '.2em' }}>MZ 팩폭 사주</p>
            <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 28, lineHeight: 1.35, margin: '10px 0 16px' }}>“{r.title}”</p>
            {r.bombs.map((b, i) => <p key={b} style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 8 }}>{i + 1}. {b}</p>)}
            <p style={{ fontSize: 17, marginTop: 12 }}>찰떡 궁합 · {r.buddyType.name}</p>
            <p style={{ fontSize: 17, marginTop: 8, color: 'var(--gold-light)' }}>{r.tags4.map((h) => `#${h}`).join(' ')}</p>
          </div>
        </ShareBlock>
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

/* ---------------- MBTI 운세 ---------------- */
// 3차 요청: 유형마다 별명 + 오늘의 간단 풀이 디자인, "ISFJ × 토 일간" 대신 "ISFJ의 사주 기질은?" 버튼 → 보상형 광고 후 상세 풀이
export function MbtiPage() {
  const { profile, isSample } = useMainProfile();
  const { patchProfile, unlocked, unlock } = useApp();
  const saju = useSaju(profile);
  const premium = usePremium();
  const { run, modal } = useRewarded();
  const [type, setType] = useState<string | null>(profile.mbti ?? null);
  const share = useShare();
  const r = type ? mbtiResult(type, saju) : null;
  const t = type ? mbtiToday(type, new Date(), profile.id) : null;
  const choose = (x: string) => { setType(x); if (!isSample) patchProfile(profile.id, { mbti: x }); };
  const sajuKey = r ? `mbti-saju:${r.type}` : '';
  const sajuOpen = !!r && (premium || isUnlockedToday(unlocked, sajuKey));
  return (
    <>
      <SubHeader title="MBTI 운세" sub="MBTI로 알아보는 오늘의 운세" />
      <main className="screen fun-page">
        <div className="mt14" />
        <CharacterBubble who="wolha">MBTI 유형을 골라 주세요. 당신의 성향에 맞는 오늘의 운세를 알려 드릴게요.</CharacterBubble>
        <div className="mgrid">{MBTI_TYPES.map((x) => <button key={x} className={type === x ? 'on' : ''} aria-pressed={type === x} onClick={() => choose(x)}><b>{x}</b><small>{mbtiNick(x)}</small></button>)}</div>
        {r && t && (
          <Gate k={`mbti:${r.type}`} label={`${r.type} 오늘 운세 보기`}>
            <section className="mhero" style={{ ['--land' as string]: `url(${funImg('mbti_land')})` }}>
              <div className="mtop">
                <div className="mmed"><b>{r.type}</b></div>
                <div>
                  <small>{r.type} · {r.nick} · {koDate()}</small>
                  <b className="t">{t.head}</b>
                  <p>{t.sub}</p>
                </div>
              </div>
              <div className="mbox">
                <div className="m4">
                  <div><Icon name="heart" size={22} /><small>오늘의 키워드</small><b>{t.keywords}</b></div>
                  <div><Icon name="gift" size={22} /><small>행운 아이템</small><b>{t.item}</b></div>
                  <div><Icon name="clock" size={22} /><small>행운 시간</small><b>{t.time}</b></div>
                  <div><Icon name="flower" size={22} /><small>행운 컬러</small><b>{t.color}</b></div>
                </div>
                <div className="m2">
                  <div className="good"><Icon name="award" size={22} /><span><b>강점</b>{r.strength}</span></div>
                  <div className="warn"><Icon name="shield" size={22} /><span><b>조심</b>{r.caution}</span></div>
                </div>
              </div>
              {!sajuOpen ? (
                <button type="button" className="msaju" onClick={() => run(() => unlock(sajuKey), 'mbti-saju')}>{r.type}의 사주 기질은? <i aria-hidden>›</i></button>
              ) : (
                <div className="msaju-open">
                  <h3>{r.type}의 사주 기질</h3>
                  <p>{r.elementSaju}</p>
                  <p>{r.type}({r.nick})의 성향과 만나면 — {r.saju}</p>
                  <ul>{r.traits.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )}
              {!sajuOpen && !premium && <p className="adnote ink">짧은 광고를 보시면 사주 기질 풀이가 열립니다</p>}
            </section>
            <ShareBlock s={share} title="MBTI 운세" text={`${r.type} 오늘 — ${t.head}`} path="/fun/mbti" id={`mbti-${r.type}`}>
              <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 40 }}>{r.type}</p>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--gold-deep)', margin: '6px 0 14px' }}>{r.nick}</p>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 700, lineHeight: 1.6 }}>{t.head}</p>
              <p style={{ fontSize: 17, lineHeight: 1.7, marginTop: 8 }}>{t.sub}</p>
              <p style={{ fontSize: 16, lineHeight: 1.7, marginTop: 10 }}>오늘의 키워드 · {t.keywords}<br />행운 컬러 · {t.color}</p>
            </ShareBlock>
          </Gate>
        )}
        {modal}
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

/* ---------------- 스몰사주 · 한줄사주 (v3, 문구 DB · AI 없음) ---------------- */
const EL_KO: Record<string, string> = { wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)' };
const EL_ICON: Record<string, string> = { wood: 'leaf', fire: 'flame', earth: 'mountain', metal: 'gem', water: 'waves' };
export function SmallPage() {
  const { profile, isSample } = useMainProfile();
  const saju = useSaju(profile);
  const r = smallSaju(saju, profile.id, new Date());
  const share = useShare();
  const premium = usePremium();
  return (
    <>
      <SubHeader title="스몰사주" sub="한 장으로 보는 나의 사주 요약" />
      <main className="screen fun-page">
        <section className="smhero mt14" style={{ backgroundImage: `url(${funImg('small_hero')})` }}>
          <small>{profile.name}님의 스몰사주{isSample ? ' (예시)' : ''}</small>
          <h2>{r.name}</h2>
          <p className="img">{r.image}</p>
          <p className="ps">{r.persona.name} — {r.persona.desc}</p>
        </section>
        <ol className="smfeat">{r.lines.map((l, i) => <li key={l}><i aria-hidden>{i + 1}</i>{l}</li>)}</ol>
        <div className="smcards">
          <div className={`el-${r.strong}`}><i aria-hidden><Icon name={EL_ICON[r.strong]} size={24} /></i><b>강한 기운 · {EL_KO[r.strong]}</b><p>{r.strongLine}</p></div>
          <div className={`el-${r.weak}`}><i aria-hidden><Icon name={EL_ICON[r.weak]} size={24} /></i><b>채우면 좋은 기운 · {EL_KO[r.weak]}</b><p>{r.weakLine}</p></div>
          <div className="tip"><i aria-hidden><Icon name="sparkles" size={24} /></i><b>오늘의 작은 팁</b><p>{r.tip}</p></div>
        </div>
        <p className="note pad">일간·오행 비율로 풀은 요약이에요. 자세한 풀이는 정통운세에서 볼 수 있어요.</p>
        <ShareBlock s={share} title="스몰사주" text={`나는 ${r.name} — ${r.image}`} path="/fun/small" id="small">
          <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 28, lineHeight: 1.35 }}>{r.name}</p>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 20, margin: '6px 0 16px', color: 'var(--gold-deep)' }}>{r.image}</p>
          {r.lines.map((l) => <p key={l} style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 8 }}>{l}</p>)}
          <p style={{ fontSize: 17, lineHeight: 1.6, marginTop: 8 }}>강한 기운 {EL_KO[r.strong]} · 채우면 좋은 기운 {EL_KO[r.weak]}</p>
        </ShareBlock>
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

export function OnelinePage() {
  const { profile, isSample } = useMainProfile();
  const saju = useSaju(profile);
  const r = oneLineSaju(saju, profile.id, new Date());
  const share = useShare();
  const premium = usePremium();
  return (
    <>
      <SubHeader title="한줄사주" sub="오늘 나에게 건네는 한 줄" />
      <main className="screen fun-page">
        <section className="oneline ol2">
          <img className="land" src={funImg('oneline_land')} alt="" aria-hidden />
          <img className="pine" src={funImg('oneline_pine')} alt="" aria-hidden />
          <span className="orn" aria-hidden>❖</span>
          <small>{koDate()} · {profile.name}님{isSample ? ' (예시)' : ''}</small>
          <p>“{r.line}”</p>
          <em>{r.sub}</em>
          <div className="olkw">{r.keywords.map((k) => <span key={k}>#{k}</span>)}</div>
          <span className="orn" aria-hidden>❖</span>
        </section>
        <p className="note pad">오늘 일진과 나의 기운이 만나는 관계로 고른 한 줄이에요. 내일은 또 다른 한 줄이 기다려요.</p>
        <ShareBlock s={share} title="오늘의 한줄사주" text={`오늘의 한줄사주: “${r.line}”`} path="/fun/oneline" id="oneline">
          <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 30, lineHeight: 1.5, textAlign: 'center', marginTop: 40 }}>“{r.line}”</p>
          <p style={{ fontFamily: 'var(--serif)', fontSize: 19, lineHeight: 1.6, textAlign: 'center', marginTop: 14 }}>{r.sub}</p>
          <p style={{ fontSize: 18, textAlign: 'center', marginTop: 14, color: 'var(--gold-deep)' }}>{r.keywords.map((k) => `#${k}`).join('  ')}</p>
        </ShareBlock>
        <AdSlot premium={premium} />
      </main>
    </>
  );
}

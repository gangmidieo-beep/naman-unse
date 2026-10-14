// 풀이 결과 — 생성 대기(별자리 판 애니메이션) → "천궁도사가 풀어드린 나의 운명서" / "월하선녀가 풀어드린 인연서"
// 한지 문서(금 테두리 프레임 + 명조 본문 18px). MOCK_MODE 는 예시 풀이(11 단계에서 AI 풀이로 교체).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import saju from '@naman/content/data/sample-readings/saju.json';
import gunghap from '@naman/content/data/sample-readings/gunghap.json';
import newyear from '@naman/content/data/sample-readings/newyear.json';
import { sajuOf } from '@naman/content';
import { analyzeSaju, solarToLunar, tojeong, type SajuReport } from '@naman/engine';
import { ReportTables } from '../components/ReportTables';
import { newYearTarget } from '../lib/dates';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, ProductCard, toCardItem, useToast } from '../components/ui';
import { Img } from '../components/Img';
import { ShareSheet } from '../components/ShareSheet';
import { ShareCard } from '../components/ShareCard';
import { SAMPLE_PROFILE, useApp, type Profile } from '../store/app';
import { CHAR, charOf, displayTitle, isPhoto, isTarot, productById, recommendFor, resultTitle, type Product } from '../lib/catalog';
import { TarotReading } from './Tarot';
import { PhotoReading } from './Photo';
import { optionalImg } from '../assets/images';
import { birthLabel, hourLabel } from './ProfileNew';
import { MOCK_MODE } from '../lib/api';
import { apiAuth, isNativeApp } from '../platform/payments';

type Sample = (typeof saju);
const sampleFor = (productId: string, who: string): Sample =>
  (['newyear', 'tojeong', 'monthly'].includes(productId) ? newyear : who === 'wolha' ? gunghap : saju) as Sample;
const STEPS = ['원국 계산', '흐름 읽기', '글 정리'];

function Body({ text, highlight }: { text: string; highlight: string }) {
  return (
    <>
      {text.split(/\n\n+/).map((para, i) => {
        const at = highlight ? para.indexOf(highlight) : -1;
        return <p className="rbody" key={i}>{at < 0 ? para : <>{para.slice(0, at)}<mark>{highlight}</mark>{para.slice(at + highlight.length)}</>}</p>;
      })}
    </>
  );
}

// 오행 색(대표님 요청 2026-10-13): 목 초록 · 화 빨강 · 토 노랑 · 금 흰색 · 수 검정. 일주(나)는 빨간 테두리로 구분
const EL: Record<string, 'wood' | 'fire' | 'earth' | 'metal' | 'water'> = {
  甲: 'wood', 乙: 'wood', 寅: 'wood', 卯: 'wood',
  丙: 'fire', 丁: 'fire', 巳: 'fire', 午: 'fire',
  戊: 'earth', 己: 'earth', 辰: 'earth', 戌: 'earth', 丑: 'earth', 未: 'earth',
  庚: 'metal', 辛: 'metal', 申: 'metal', 酉: 'metal',
  壬: 'water', 癸: 'water', 亥: 'water', 子: 'water',
};
const EL_KO = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' } as const;
export function PillarTable({ p }: { p: Profile }) {
  const s = useMemo(() => sajuOf(p), [p]);
  const cols = [['시주', s.pillars.hour], ['일주', s.pillars.day], ['월주', s.pillars.month], ['연주', s.pillars.year]] as const;
  const chars = cols.flatMap(([, v]) => (v ? [v.hanja[0], v.hanja[1]] : []));
  const count = (Object.keys(EL_KO) as (keyof typeof EL_KO)[]).map((k) => [k, chars.filter((c) => EL[c] === k).length] as const);
  const cell = (k: string, ch?: string) => {
    const e = ch ? EL[ch] : undefined;
    return <td key={k} className={`hz${e ? ` el-${e}` : ''}${k === '일주' ? ' me' : ''}`} title={e ? `${EL_KO[e]}(${ch})` : undefined}>{ch ?? '?'}{e && <small>{EL_KO[e]}</small>}</td>;
  };
  return (
    <>
      <table className="pillars" aria-label="사주 원국 여덟 글자">
        <thead><tr>{cols.map(([k]) => <th key={k} className={k === '일주' ? 'me' : ''}>{k}{k === '일주' && <small>나</small>}</th>)}</tr></thead>
        <tbody>
          <tr>{cols.map(([k, v]) => cell(k, v?.hanja[0]))}</tr>
          <tr>{cols.map(([k, v]) => cell(k, v?.hanja[1]))}</tr>
        </tbody>
      </table>
      <p className="el-legend" aria-label="오행 분포">
        {count.map(([k, n]) => <span key={k} className={n ? '' : 'none'}><i className={`el-${k}`} />{EL_KO[k]} {n}</span>)}
      </p>
    </>
  );
}

// 토정비결: 그해 괘 번호(상·중·하) — 계산은 엔진 tojeong(), 풀이는 11 단계 AI 가 이 번호로 새로 쓴다
function Gwae({ p }: { p: Profile }) {
  const l = p.calendar === 'lunar' ? { year: p.year, month: p.month, day: p.day } : solarToLunar(p.year, p.month, p.day);
  const g = tojeong({ lunarYear: l.year, lunarMonth: l.month, lunarDay: l.day, targetYear: newYearTarget().year });
  return <p className="note" style={{ margin: '10px 18px 0', fontSize: 16 }}>{newYearTarget().year}년 괘 번호 <b>{g.number}</b> · 상괘 {g.upper} · 중괘 {g.middle} · 하괘 {g.lower}</p>;
}

export default function ReadingPage() {
  const { orderId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { purchases, profiles } = useApp();
  // 실결제 모드: 서버가 쓴 풀이를 3초마다 확인(queued → generating → done). 다른 기기에서 열어도 서버 주문으로 찾음
  const live = !MOCK_MODE && !orderId.startsWith('sample-');
  const [srv, setSrv] = useState<{ status: string; content?: any; productId?: string; profileId?: string; attempts?: number } | null>(null);
  useEffect(() => {
    if (!live) return;
    let stop = false;
    const poll = async () => {
      const r = await apiAuth<any>(`/readings/${encodeURIComponent(orderId)}`).catch(() => ({ status: 'missing' }));
      if (stop) return;
      setSrv(r);
      // 장편은 몇 분 걸리고, 실패해도 서버가 자동으로 다시 쓴다(최대 3번)
      if (r.status === 'queued' || r.status === 'generating' || (r.status === 'failed' && (r.attempts ?? 0) < 3)) setTimeout(poll, 4000);
    };
    poll();
    return () => { stop = true; };
  }, [live, orderId]);
  // /reading/sample-<상품id> 는 예시 주소(시안·공유 미리보기용)
  const order = purchases.find((x) => x.orderId === orderId) ?? (live && srv?.productId ? { orderId, productId: srv.productId, profileId: srv.profileId ?? '', price: 0, createdAt: '', kind: 'reading' as const, status: 'paid' as const } : null) ?? (orderId.startsWith('sample-') ? { orderId, productId: orderId.slice(7), profileId: 'sample', price: 0, createdAt: '', kind: 'reading' as const, status: 'paid' as const } : null);
  const p = order ? productById(order.productId) : null;
  const pre = order ? productById(order.productId) : null;
  // 타로·사진 풀이는 자체 연출(카드 뒤집기·분석 중)이 있어 대기 화면을 건너뛴다
  const [step, setStep] = useState(orderId.startsWith('sample-') || (pre && (isTarot(pre) || isPhoto(pre))) ? STEPS.length : 0);
  const [share, setShare] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step >= STEPS.length) return;
    // 서버 풀이를 기다리는 중이면 마지막 단계에서 멈춰 있다가 done 이 오면 넘어감
    if (live && step === STEPS.length - 1 && srv?.status !== 'done') return;
    const t = setTimeout(() => setStep((s) => s + 1), 1300);
    return () => clearTimeout(t);
  }, [step, live, srv?.status]);

  const retrying = srv?.status === 'failed' && (srv.attempts ?? 0) < 3;
  if (live && srv && ((srv.status === 'failed' && !retrying) || srv.status === 'missing') && !(pre && (isTarot(pre) || isPhoto(pre))))
    return (
      <>
        <SubHeader title="풀이" />
        <main className="screen no-tab"><p className="muted center mt24">{srv.status === 'failed' ? '풀이를 쓰는 중 문제가 생겼어요. 잠시 후 다시 열어 주세요. 계속되면 문의해 주세요.' : '풀이를 찾을 수 없어요.'}</p><div className="pad mt14"><Button to="/box">나의 운세함으로</Button></div></main>
      </>
    );
  if (!order || !p)
    return (
      <>
        <SubHeader title="풀이" />
        <main className="screen no-tab"><p className="muted center mt24">풀이를 찾을 수 없어요.</p><div className="pad mt14"><Button to="/box">나의 운세함으로</Button></div></main>
      </>
    );

  const who = charOf(p);
  const c = CHAR[who];
  const r: Sample = live && srv?.status === 'done' && srv?.content?.chapters?.length ? srv.content : sampleFor(p.id, who);
  const isSampleText = !(live && srv?.content?.generatedBy === 'ai');
  const [pid, partnerId] = order.profileId.split('+');
  const person = profiles.find((x) => x.id === pid) ?? SAMPLE_PROFILE;
  const partner = partnerId ? profiles.find((x) => x.id === partnerId) : undefined;
  const title = displayTitle(p);
  const loading = optionalImg('loading_cheongung');
  const prog = srv?.content?.progress as { done: number; total: number } | undefined;
  const v2 = live && srv?.status === 'done' && srv?.content?.version === 2 ? srv.content : null;
  const reports: { r: SajuReport; name: string; birth?: string }[] = v2
    ? v2.reports.map((rr: SajuReport, i: number) => ({ r: rr, name: v2.people[i]?.name ?? '', birth: v2.people[i]?.birth }))
    : [person, partner].filter(Boolean).map((x) => ({ r: analyzeSaju(sajuOf(x!)), name: x!.name, birth: `${birthLabel(x!)} · ${hourLabel(x!.hour)}` }));
  const savePdf = async () => {
    try {
      const { url } = await apiAuth<{ url: string }>(`/readings/${encodeURIComponent(orderId)}/pdf-link`, { method: 'POST', body: '{}' });
      if (isNativeApp()) window.open(url, '_system'); else window.location.assign(url);
      toast('PDF 를 만들고 있어요. 잠시 뒤 내려받기가 시작돼요.');
    } catch (e: any) { toast(e.message ?? 'PDF 를 만들지 못했어요'); }
  };

  if (step < STEPS.length)
    return (
      <main className="screen no-tab waiting" aria-live="polite">
        <div className="starboard" aria-hidden>
          {loading && who === 'cheongung' ? <img className="wait-face" src={loading.src} alt="" /> : <Img k={c.face} className="wait-face" eager alt="" />}
          <span className="ring r1" /><span className="ring r2" />
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 36}deg) translateY(-118px)` }}>✦</i>)}
        </div>
        <h1 className="wait-title">{who === 'cheongung' ? '별을 읽고 있소…' : '붉은 실을 따라가고 있어요…'}<small>{title} · {live ? 'A4 40~50장 정통 감정서 · 3~5분' : '약 1분'}</small></h1>
        {live && prog && (
          <div className="wait-prog" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.done}>
            <span className="tr"><b style={{ width: `${Math.round((prog.done / prog.total) * 100)}%` }} /></span>
            <p>{retrying ? '잠시 문제가 있어 이어서 쓰고 있어요' : `${prog.done} / ${prog.total}장 작성`}</p>
          </div>
        )}
        <ol className="wait-steps">
          {STEPS.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'on' : ''}>{i < step ? '✓ ' : ''}{s}</li>)}
        </ol>
        <p className="muted center pad">화면을 닫아도 풀이는 ‘나의 운세함’에 보관돼요.</p>
      </main>
    );

  return (
    <>
      <SubHeader title={resultTitle(p)} sub={title} />
      <main className="screen no-tab">
        <article className="doc">
          <div className="in">
            <div className="doc-cover">
              <Img k={c.banner} eager alt="" />
              <div className="shade" />
              <div className="tx"><small>{c.hanja}</small><h1>{titleLines(resultTitle(p))}</h1></div>
            </div>
            <div className="doc-meta">
              <div className="nm">{title}</div>
              <p><span className="nb">{person.name}님</span> · <span className="nb">{birthLabel(person)}</span> · <span className="nb">{hourLabel(person.hour)}</span></p>
              {partner && <p><span className="nb">{partner.name}님</span> · <span className="nb">{birthLabel(partner)}</span></p>}
            </div>
            {isTarot(p) ? <TarotReading p={p} orderId={order.orderId} /> : isPhoto(p) ? <PhotoReading p={p} orderId={order.orderId} /> : <>
            {p.id === 'tojeong' && <Gwae p={person} />}
            {isSampleText && person.id !== SAMPLE_PROFILE.id && !isTarot(p) && !isPhoto(p) && <p className="note" style={{ margin: '10px 18px 0' }}>지금은 예시 풀이예요. 정식 감정서(A4 40~50장)는 {person.name}님 사주로 새로 써 드려요. 아래 분석표는 {person.name}님 사주로 계산한 실제 값이에요.</p>}
            {reports.map((x) => <ReportTables key={x.name} r={x.r} name={x.name} birth={x.birth} />)}
            {v2 ? <LongBody c={v2} who={who} /> : <>
            <div className="chap"><CharacterBubble who={who}>{r.intro}</CharacterBubble></div>
            <nav className="toc" id="toc" aria-label="목차">
              <h2>목차</h2>
              <ol>{r.chapters.map((ch, i) => <li key={ch.id}><a href={`#${ch.id}`}><i>{i + 1}</i>{ch.title}</a></li>)}</ol>
            </nav>
            {r.chapters.map((ch, i) => (
              <section className="chap" id={ch.id} key={ch.id}>
                <small>第 {i + 1} 章</small>
                <h2>{ch.title}</h2>
                <CharacterBubble who={who}>{ch.say}</CharacterBubble>
                <Body text={ch.body} highlight={ch.highlight} />
              </section>
            ))}
            <section className="chap closing">
              <h2>{r.closing.title}</h2>
              <Body text={r.closing.body} highlight="" />
              <ul className="tips">{r.closing.tips.map((t) => <li key={t}>{t}</li>)}</ul>
            </section>
            </>}
            </>}
            <div className="doc-seal">{c.name}<span className="seal" aria-hidden>運</span></div>
          </div>
        </article>

        {v2 && <div className="pdf-bar"><Button kind="gold" onClick={savePdf}>A4 PDF 로 저장하기</Button></div>}
        {v2 && <a className="toc-fab" href="#toc">목차</a>}
        <div className="pad mt24">
          <div className="btn-row">
            <Button kind="ink" onClick={() => setShare(true)}>핵심만 공유하기</Button>
            <Button kind="line" onClick={() => nav(isTarot(p) ? '/tarot' : `/unse?cat=${isPhoto(p) ? 'photo' : who === 'cheongung' ? 'fate' : 'love'}`)}>다른 풀이 보기</Button>
          </div>
          <p className="note">풀이는 <Link to="/box" className="u">나의 운세함</Link>에 보관돼요. 공유 카드에는 전체 풀이가 아닌 핵심 한 줄만 담겨요.</p>
        </div>
        <TalismanRecommend p={p} />
      </main>
      <ShareSheet open={share} onClose={() => setShare(false)} card={cardRef} title={`${resultTitle(p)} · ${title}`} text={`“${r.chapters[0].highlight}” — ${c.name}`} path={`/product/${p.id}`} contentId={p.id} onDone={(m) => m && toast(m)} />
      <ShareCard ref={cardRef} title={title} sub={c.name}>
        <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 24, lineHeight: 1.4 }}>{resultTitle(p)}</p>
        <p style={{ fontFamily: 'var(--serif)', fontSize: 20, lineHeight: 1.8, marginTop: 18 }}>“{r.chapters[0].highlight}”</p>
        <p style={{ marginTop: 18, fontSize: 16, color: 'var(--ink-3)' }}>전체 풀이는 나만의 운세 앱에서 볼 수 있어요</p>
      </ShareCard>
    </>
  );
}

// 장편 정통 감정서 본문 — 부(part)마다 제목, 장 번호는 처음부터 이어서
function LongBody({ c, who }: { c: any; who: 'cheongung' | 'wolha' }) {
  const parts = (c.parts as { title: string }[]).map((pt, i) => ({ ...pt, chapters: (c.chapters as any[]).filter((x) => x.part === i) })).filter((pt) => pt.chapters.length);
  let n = 0, t = 0;
  return (
    <>
      {c.intro && <div className="chap"><div className="lintro">{c.intro}</div></div>}
      <nav className="toc toc4" id="toc" aria-label="목차">
        <h2>목차</h2>
        {parts.map((pt) => (
          <div key={pt.title}>
            <div className="pt">{pt.title}</div>
            <ol>{pt.chapters.map((ch) => <li key={ch.id}><a href={`#${ch.id}`}><i>{++t}</i>{ch.title}</a></li>)}</ol>
          </div>
        ))}
        <div className="pt"><a href="#closing">{c.closing.title}</a></div>
      </nav>
      {parts.map((pt) => (
        <div key={pt.title}>
          <div className="part4"><small>{who === 'cheongung' ? '運命鑑定' : '因緣鑑定'}</small><h2>{pt.title}</h2></div>
          {pt.chapters.map((ch) => (
            <section className="chap" id={ch.id} key={ch.id}>
              <small>第 {++n} 章</small>
              <h2>{ch.title}</h2>
              {ch.say && <div className="lsum"><b>핵심 요약</b><p>{ch.say}</p></div>}
              <Body text={ch.body} highlight="" />
              {ch.points?.length > 0 && <div className="lpts"><b>장점·포인트</b><ul>{ch.points.map((x: string) => <li key={x}>{x}</li>)}</ul></div>}
              {(ch.caution || ch.advice) && (
                <div className="lca">
                  {ch.caution && <div className="c"><b>주의할 점</b><p>{ch.caution}</p></div>}
                  {ch.advice && <div className="a"><b>이렇게 해 보세요</b><p>{ch.advice}</p></div>}
                </div>
              )}
              {ch.highlight && <p className="lline"><span>한 줄 정리</span>{ch.highlight}</p>}
            </section>
          ))}
        </div>
      ))}
      <section className="chap closing" id="closing">
        <h2>{c.closing.title}</h2>
        <Body text={c.closing.body} highlight="" />
        {c.closing.tips?.length > 0 && <ul className="tips">{c.closing.tips.map((x: string) => <li key={x}>{x}</li>)}</ul>}
      </section>
    </>
  );
}

// 결과 맨 아래 — 이 풀이와 함께 받으면 좋은 부적 1~2개 (packages/content/data/talisman-map.json)
function TalismanRecommend({ p }: { p: Product }) {
  const list = recommendFor(p.id);
  if (!list.length) return null;
  return (
    <section className="recom" aria-label="추천 부적">
      <h2><small>WITH TALISMAN</small>이 풀이와 함께 받으면 좋은 부적</h2>
      {list.map((t) => <ProductCard key={t.id} c={toCardItem(t)} mode="list" talisman={t} />)}
    </section>
  );
}

// 제목을 의미 단위 두 줄로 — "천궁도사가 풀어드린 / 나의 운명서" (낱말 중간에서 끊기지 않게)
function titleLines(t: string) {
  const w = t.trim().split(/\s+/);
  if (w.length < 3) return t;
  let best = 1, diff = Infinity;
  for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } }
  return <><span className="tl">{w.slice(0, best).join(' ')}</span> <span className="tl">{w.slice(best).join(' ')}</span></>;
}

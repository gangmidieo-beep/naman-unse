// 풀이 결과 — 생성 대기(별자리 판 애니메이션) → "천궁도사가 풀어드린 나의 운명서" / "월하선녀가 풀어드린 인연서"
// 한지 문서(금 테두리 프레임 + 명조 본문 18px). MOCK_MODE 는 예시 풀이(11 단계에서 AI 풀이로 교체).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import saju from '@naman/content/data/sample-readings/saju.json';
import gunghap from '@naman/content/data/sample-readings/gunghap.json';
import newyear from '@naman/content/data/sample-readings/newyear.json';
import { sajuOf } from '@naman/content';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, useToast } from '../components/ui';
import { Img } from '../components/Img';
import { ShareSheet } from '../components/ShareSheet';
import { ShareCard } from '../components/ShareCard';
import { SAMPLE_PROFILE, useApp, type Profile } from '../store/app';
import { CHAR, charOf, displayTitle, productById, resultTitle } from '../lib/catalog';
import { optionalImg } from '../assets/images';
import { birthLabel, hourLabel } from './ProfileNew';

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

function PillarTable({ p }: { p: Profile }) {
  const s = useMemo(() => sajuOf(p), [p]);
  const cols = [['시주', s.pillars.hour], ['일주', s.pillars.day], ['월주', s.pillars.month], ['연주', s.pillars.year]] as const;
  return (
    <table className="pillars" aria-label="사주 원국 여덟 글자">
      <thead><tr>{cols.map(([k]) => <th key={k}>{k}</th>)}</tr></thead>
      <tbody>
        <tr>{cols.map(([k, v]) => <td key={k} className="hz">{v ? v.hanja[0] : '?'}</td>)}</tr>
        <tr>{cols.map(([k, v]) => <td key={k} className="hz">{v ? v.hanja[1] : '?'}</td>)}</tr>
      </tbody>
    </table>
  );
}

export default function ReadingPage() {
  const { orderId = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { purchases, profiles } = useApp();
  // /reading/sample-<상품id> 는 예시 주소(시안·공유 미리보기용)
  const order = purchases.find((x) => x.orderId === orderId) ?? (orderId.startsWith('sample-') ? { orderId, productId: orderId.slice(7), profileId: 'sample', price: 0, createdAt: '', kind: 'reading' as const, status: 'paid' as const } : null);
  const p = order ? productById(order.productId) : null;
  const [step, setStep] = useState(orderId.startsWith('sample-') ? STEPS.length : 0);
  const [share, setShare] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step >= STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1300);
    return () => clearTimeout(t);
  }, [step]);

  if (!order || !p)
    return (
      <>
        <SubHeader title="풀이" />
        <main className="screen no-tab"><p className="muted center mt24">풀이를 찾을 수 없어요.</p><div className="pad mt14"><Button to="/box">나의 운세함으로</Button></div></main>
      </>
    );

  const who = charOf(p);
  const c = CHAR[who];
  const r = sampleFor(p.id, who);
  const [pid, partnerId] = order.profileId.split('+');
  const person = profiles.find((x) => x.id === pid) ?? SAMPLE_PROFILE;
  const partner = partnerId ? profiles.find((x) => x.id === partnerId) : undefined;
  const title = displayTitle(p);
  const loading = optionalImg('loading_cheongung');

  if (step < STEPS.length)
    return (
      <main className="screen no-tab waiting" aria-live="polite">
        <div className="starboard" aria-hidden>
          {loading && who === 'cheongung' ? <img className="wait-face" src={loading.src} alt="" /> : <Img k={c.face} className="wait-face" eager alt="" />}
          <span className="ring r1" /><span className="ring r2" />
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 36}deg) translateY(-118px)` }}>✦</i>)}
        </div>
        <h1 className="wait-title">{who === 'cheongung' ? '별을 읽고 있소…' : '붉은 실을 따라가고 있어요…'}<small>{title} · 약 1분</small></h1>
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
              <div className="tx"><small>{c.hanja}</small><h1>{resultTitle(p)}</h1></div>
            </div>
            <div className="doc-meta">
              <div className="nm">{title}</div>
              <p>{person.name}님 · {birthLabel(person)} · {hourLabel(person.hour)}</p>
              {partner && <p>{partner.name}님 · {birthLabel(partner)}</p>}
            </div>
            <PillarTable p={person} />
            {person.id !== SAMPLE_PROFILE.id && <p className="note" style={{ margin: '10px 18px 0' }}>시안 단계라 본문은 예시 인물(홍길동)의 풀이예요. 정식 오픈 때 {person.name}님 사주로 새로 써 드려요.</p>}
            <div className="chap"><CharacterBubble who={who}>{r.intro}</CharacterBubble></div>
            <nav className="toc" aria-label="목차">
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
            <div className="doc-seal">{c.name}<span className="seal" aria-hidden>運</span></div>
          </div>
        </article>

        <div className="pad mt24">
          <div className="btn-row">
            <Button kind="ink" onClick={() => setShare(true)}>핵심만 공유하기</Button>
            <Button kind="line" onClick={() => nav(who === 'cheongung' ? '/fate' : '/love')}>다른 풀이 보기</Button>
          </div>
          <p className="note">풀이는 <Link to="/box" className="u">나의 운세함</Link>에 보관돼요. 공유 카드에는 전체 풀이가 아닌 핵심 한 줄만 담겨요.</p>
        </div>
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

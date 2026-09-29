// S8 풀이 결과 — 생성 대기(도령이 별을 읽는 애니메이션) → 표지·목차·장별 카드·마무리 → 이미지 저장·링크 공유.
// MOCK_MODE: packages/content/data/sample-readings 의 예시 풀이를 보여준다(11 단계에서 AI 풀이로 교체).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import saju from '@naman/content/data/sample-readings/saju.json';
import gunghap from '@naman/content/data/sample-readings/gunghap.json';
import newyear from '@naman/content/data/sample-readings/newyear.json';
import { sajuOf } from '@naman/content';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, useToast } from '../components/ui';
import { Img } from '../components/Img';
import { SAMPLE_PROFILE, useApp, type Profile } from '../store/app';
import { productById } from '../lib/brand';
import { saveImage, shareLink } from '../lib/share';
import { productTitle } from './Consult';
import { birthLabel, hourLabel } from './ProfileNew';

const SAMPLES = { saju, gunghap, newyear } as const;
type Reading = (typeof SAMPLES)['saju'];
const baseOf = (productId: string) => (productId.startsWith('saju') ? 'saju' : productId) as keyof typeof SAMPLES;
const STEPS = ['원국 계산', '흐름 읽기', '글 정리'];

// 핵심 문장에 금색 형광 밑줄
function Body({ text, highlight }: { text: string; highlight: string }) {
  return (
    <>
      {text.split(/\n\n+/).map((para, i) => {
        const at = highlight ? para.indexOf(highlight) : -1;
        return (
          <p className="rbody" key={i}>
            {at < 0 ? para : <>{para.slice(0, at)}<mark>{highlight}</mark>{para.slice(at + highlight.length)}</>}
          </p>
        );
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
  // /reading/sample-saju 처럼 예시 주소로도 열린다(시안·공유 미리보기용)
  const order = purchases.find((x) => x.orderId === orderId) ?? (orderId.startsWith('sample-') ? { orderId, productId: orderId.slice(7), profileId: 'sample', price: 0, createdAt: '' } : null);
  const product = order ? productById(order.productId) : null;
  const [step, setStep] = useState(orderId.startsWith('sample-') ? STEPS.length : 0);
  const coverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step >= STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 1300);
    return () => clearTimeout(t);
  }, [step]);

  if (!order || !product)
    return (
      <>
        <SubHeader title="풀이" />
        <main className="screen no-tab"><p className="muted">풀이를 찾을 수 없어요.</p><Button to="/me">구매한 풀이 보기</Button></main>
      </>
    );

  const r = SAMPLES[baseOf(product.id)] as Reading;
  const who = r.character as 'dosa' | 'sunnyeo';
  const [pid, partnerId] = order.profileId.split('+');
  const person = profiles.find((x) => x.id === pid) ?? SAMPLE_PROFILE;
  const partner = partnerId ? profiles.find((x) => x.id === partnerId) : undefined;
  const title = productTitle(product);

  if (step < STEPS.length)
    return (
      <main className="screen no-tab waiting" aria-live="polite">
        <div className="starboard" aria-hidden>
          <Img k="dosaFace" className="wait-face" eager alt="" />
          <span className="ring r1" /><span className="ring r2" />
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 36}deg) translateY(-118px)` }}>✦</i>)}
        </div>
        <h1 className="wait-title">별을 읽고 있소… <small>(약 1분)</small></h1>
        <ol className="wait-steps">
          {STEPS.map((s, i) => <li key={s} className={i < step ? 'done' : i === step ? 'on' : ''}>{i < step ? '✓ ' : ''}{s}</li>)}
        </ol>
        <p className="muted center">화면을 닫아도 풀이는 ‘내 정보 › 구매한 풀이’에 저장돼요.</p>
      </main>
    );

  const share = async () => {
    const res = await shareLink({ title, text: `${person.name}님의 ${title} 풀이`, url: `${location.origin}/reading/sample-${baseOf(product.id)}` });
    if (res === 'copied') toast('링크를 복사했어요');
  };
  const save = async () => {
    if (coverRef.current) { await saveImage(coverRef.current, `${title}_${person.name}.png`); toast('이미지로 저장했어요'); }
  };

  return (
    <>
      <SubHeader title={title} />
      <main className="screen no-tab reading">
        <section className="rcover" ref={coverRef}>
          <div className="rc-in">
            <Img k={who === 'dosa' ? 'dosaBanner' : 'sunnyeoBanner'} eager alt="" />
            <div className="shade" />
            <div className="rc-txt">
              <small>{who === 'dosa' ? '천궁도령' : '월하선녀'}의 풀이</small>
              <h1>{title}</h1>
              <p>{person.name}님 · {birthLabel(person)} · {hourLabel(person.hour)}</p>
              {partner && <p>{partner.name}님 · {birthLabel(partner)}</p>}
            </div>
          </div>
          <PillarTable p={person} />
          <div className="rc-mark">나만의 운세</div>
        </section>
        {person.id !== SAMPLE_PROFILE.id && <p className="note">시안 단계라 본문은 예시 인물(홍길동)의 풀이예요. 정식 오픈 때 {person.name}님 사주로 새로 써 드려요.</p>}

        <CharacterBubble who={who}>{r.intro}</CharacterBubble>

        <nav className="toc panel" aria-label="목차">
          <h2 className="h2">목차</h2>
          <ol>{r.chapters.map((c, i) => <li key={c.id}><a href={`#${c.id}`}>{i + 1}. {c.title}</a></li>)}</ol>
        </nav>

        {r.chapters.map((c, i) => (
          <article className="rchap" id={c.id} key={c.id}>
            <small>제{i + 1}장</small>
            <h2>{c.title}</h2>
            <CharacterBubble who={who}>{c.say}</CharacterBubble>
            <Body text={c.body} highlight={c.highlight} />
          </article>
        ))}

        <article className="rchap closing">
          <h2>{r.closing.title}</h2>
          <Body text={r.closing.body} highlight="" />
          <ul className="advice">{r.closing.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </article>

        <div className="btn-row">
          <button className="btn line" onClick={save}>🖼 이미지로 저장</button>
          <button className="btn line" onClick={share}>🔗 링크 공유</button>
        </div>
        <Button onClick={() => nav('/consult')}>다른 풀이 보기</Button>
        <p className="note">풀이는 <Link to="/me" className="u">내 정보 › 구매한 풀이</Link>에서 언제든 다시 볼 수 있어요.</p>
      </main>
    </>
  );
}

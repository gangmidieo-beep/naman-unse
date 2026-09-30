// 나만의 부적 — 목록(분류 4) / 상세(부적 설명서·효험 3·사용 방법·구매) / 작성 연출(결제 후) → 부적함 보관·저장·공유(선물)
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import effectsDb from '@naman/content/data/talisman-effects.json';
import { SubHeader, SectionHeader } from '../components/layout';
import { Button, CategoryTabs, EffectCard, ProductRow, StepList, StickyBuyBar, TalismanPaper, talismanTone, useToast } from '../components/ui';
import { Img } from '../components/Img';
import { ShareSheet } from '../components/ShareSheet';
import { BRAND, CHAR, TALISMANS, buyLabel, charOf, memberPrice, productById, isTalisman, type Talisman } from '../lib/catalog';
import { newId, useApp, useMainProfile, usePremium } from '../store/app';
import { saveImage } from '../lib/share';
import { birthLabel } from './ProfileNew';

type Eff = { effects: { icon: string; title: string; desc: string }[]; wishExamples: string[] };
const EFF = effectsDb as Record<string, Eff>;

export function TalismanList() {
  const [sp, setSp] = useSearchParams();
  const groups = BRAND.groups.talisman;
  const g = sp.get('g') && groups.includes(sp.get('g')!) ? sp.get('g')! : groups[0];
  const mine = useApp((s) => s.talismans);
  return (
    <>
      <SubHeader title="나만의 부적" sub="간절한 소망을 담은 나만의 부적" back={false} />
      <main className="screen">
        <CategoryTabs tabs={groups} value={g} onChange={(v) => setSp({ g: v }, { replace: true })} />
        <p className="listhead">간절한 소망을 마음에 담아, 나를 위한 특별한 부적을 만들어 보세요.</p>
        {TALISMANS.filter((t) => t.group === g).sort((a, b) => a.sort - b.sort).map((t) => (
          <ProductRow key={t.id} p={t} owned={mine.some((m) => m.talismanId === t.id)} />
        ))}
      </main>
    </>
  );
}

export function TalismanDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const premium = usePremium();
  const t = productById(id);
  if (!t || !isTalisman(t)) return <Navigate to="/talisman" replace />;
  const who = CHAR[charOf(t)];
  const eff = EFF[t.id];
  return (
    <>
      <SubHeader title={t.title} sub="소원을 새기는 나만의 부적" />
      <main className="screen no-tab sticky-pad">
        <div className={`bjstage ${talismanTone(t)}`}><TalismanPaper t={t} size={2.35} /></div>
        <div className="frame"><span className="lbl">부적 설명서</span><p className="body">{t.detail}</p></div>
        <SectionHeader en="EFFECT" title={<>부적의 <em>효험</em></>} center />
        {eff?.effects.map((e) => <EffectCard key={e.title} {...e} />)}
        <StepList label="사용 방법" steps={[
          { title: '소원 적기', desc: '이름·생년월일과 간절한 소원을 적어요' },
          { title: '부적 완성', desc: `${who.name}가 소원을 담아 부적을 씁니다` },
          { title: '부적함 보관 · 저장 · 선물', desc: '휴대폰에 저장하고 소중한 사람에게 선물해요' },
        ]} />
        <p className="note" style={{ margin: '18px 18px 0' }}>당신의 마음을 담아 완성하는 하나뿐인 부적 — 이름과 생년월일, 마음속 소원을 담아 나만의 부적을 완성합니다.</p>
      </main>
      <StickyBuyBar p={t} premium={premium} label={buyLabel(t)} onBuy={() => nav(`/checkout/${t.id}`)} />
    </>
  );
}

const STEPS = ['소원을 담는 중..', '좋은 기운을 새기는 중..', '부적을 완성하는 중..'];
// 붓글씨 획(SVG stroke-dashoffset 로 그려지는 연출) — 부적 글자 모양을 흉내 낸 추상 획
const STROKES = ['M20 30 C40 20 60 20 80 30', 'M50 18 L50 150', 'M22 70 C40 62 62 62 78 70', 'M28 110 C40 128 60 128 72 110', 'M35 160 C45 150 55 150 65 160'];

export function TalismanMake() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const toast = useToast();
  const { profile } = useMainProfile();
  const { purchases, talismans, addTalisman } = useApp();
  const t = productById(id) as Talisman | undefined;
  const orderId = sp.get('order') ?? '';
  const done = talismans.find((x) => x.orderId === orderId);
  const [wish, setWish] = useState('');
  const [phase, setPhase] = useState<'wish' | 'writing' | 'done'>(done ? 'done' : 'wish');
  const [step, setStep] = useState(0);
  const [share, setShare] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const paid = purchases.some((p) => p.orderId === orderId && p.productId === id);

  useEffect(() => {
    if (phase !== 'writing') return;
    if (step >= STEPS.length) {
      addTalisman({ id: newId(), talismanId: id, orderId, name: profile.name, birth: birthLabel(profile), wish: wish.trim(), issuedAt: new Date().toISOString().slice(0, 10) });
      setPhase('done');
      return;
    }
    const tm = setTimeout(() => setStep((s) => s + 1), 1600);
    return () => clearTimeout(tm);
  }, [phase, step]);

  if (!t || !isTalisman(t)) return <Navigate to="/talisman" replace />;
  if (!paid && !done) return <Navigate to={`/talisman/${id}`} replace />;
  const who = CHAR[charOf(t)];
  const mine = done ?? talismans.find((x) => x.orderId === orderId);

  if (phase === 'wish')
    return (
      <main className="make">
        <Img k={who.face} className="face" eager alt={who.name} />
        <h1>{profile.name}님, 부적에 새길<br />간절한 소원을 적어 주세요</h1>
        <div className="field" style={{ width: '100%', textAlign: 'left' }}>
          <label htmlFor="wish">나의 소원</label>
          <textarea id="wish" className="input" maxLength={40} value={wish} onChange={(e) => setWish(e.target.value)} placeholder={EFF[t.id]?.wishExamples[0] ?? '소원을 적어 주세요'} />
        </div>
        <div className="kw" style={{ padding: 0, justifyContent: 'center' }}>
          {EFF[t.id]?.wishExamples.map((w) => <button key={w} onClick={() => setWish(w)}>{w}</button>)}
        </div>
        <Button kind="gold" className="mt" disabled={!wish.trim()} onClick={() => setPhase('writing')}>소원 담아 부적 쓰기</Button>
      </main>
    );

  if (phase === 'writing')
    return (
      <main className="make" aria-live="polite">
        <Img k={who.face} className="face" eager alt={who.name} />
        <h1>{profile.name}님의 마음을 담아<br />소원부적을 작성합니다</h1>
        <div className="paper">
          <svg className="brushsvg" viewBox="0 0 100 180" width={150} height={236} style={{ background: 'linear-gradient(170deg,#F0D27A,#E2B94F 60%,#D6A93E)', border: '3px solid var(--seal)', borderRadius: 4 }} aria-hidden>
            {STROKES.map((d, i) => <path key={i} d={d} />)}
          </svg>
        </div>
        <p className="step">{STEPS[Math.min(step, STEPS.length - 1)]}</p>
      </main>
    );

  return (
    <main className="make">
      <h1>나만의 {t.title}이<br />완성되었습니다</h1>
      <div className="paper" ref={paperRef} style={{ padding: 14, background: 'var(--ink)', borderRadius: 16 }}>
        <TalismanPaper t={t} size={2.6} name={mine?.name} birth={mine?.birth} wish={mine?.wish} issued={mine?.issuedAt} />
      </div>
      <div className="wishbox">“{mine?.wish}”<br /><small style={{ fontSize: 14, color: 'var(--on-ink-2)' }}>{mine?.name} · 발급일 {mine?.issuedAt}</small></div>
      <div className="done">
        <div className="btn-row">
          <Button kind="gold" onClick={async () => { if (paperRef.current) { await saveImage(paperRef.current, `나만의운세_${t.title}.png`); toast('휴대폰에 저장했어요'); } }}>휴대폰에 저장하기</Button>
          <Button kind="ink" onClick={() => setShare(true)}>공유하기(선물)</Button>
        </div>
        <Link to="/box#talismans" className="textlink" style={{ color: 'var(--gold-light)', display: 'inline-flex', alignItems: 'center', marginTop: 10 }}>나의 부적함에서 보기 ›</Link>
      </div>
      <ShareSheet open={share} onClose={() => setShare(false)} title={`${mine?.name}님이 ${t.title}을 선물했어요`} text={`마음을 담아 ${t.title}을 보내요 — “${mine?.wish}”`} path={`/talisman/${t.id}`} contentId={t.id} onDone={(m) => m && toast(m)} />
    </main>
  );
}

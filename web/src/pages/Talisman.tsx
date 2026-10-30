// 나만의 부적 — 목록(분류 4) / 상세(부적 설명서·효험 3·사용 방법·구매) / 작성 연출(결제 후) → 부적함 보관·저장·공유(선물)
import { PremiumButton } from '../components/PremiumPopup';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import effectsDb from '@naman/content/data/talisman-effects.json';
import { SubHeader } from '../components/layout';
import { Icon } from '../components/Icon';
import { v4 } from '../assets/images';
import { Button, ProductRow, TalismanPaper, talismanImg, useToast } from '../components/ui';
import { Img } from '../components/Img';
import { ShareSheet } from '../components/ShareSheet';
import { BRAND, CHAR, TALISMANS, buyLabel, charOf, memberPrice, productById, isTalisman, thumbOf, won, type Talisman } from '../lib/catalog';
import { newId, useApp, useMainProfile, usePremium } from '../store/app';
import { lastSaveMode, saveImage, saveTalismanImage } from '../lib/share';
import { MOCK_MODE } from '../lib/api';
import { isNativeApp, saveTalismanToServer } from '../platform/payments';
import { birthLabel } from './ProfileNew';

type Eff = { intro?: string; effects: { icon: string; title: string; desc: string }[]; targets?: string[]; wishExamples: string[] };
const EFF = effectsDb as Record<string, Eff>;
const GROUP_ICON: Record<string, string> = { 전체: 'layout-grid', '재물·성공': 'coins', '사랑·인연': 'heart', '소원·성취': 'flower-2', '평안·보호': 'shield' };
type Sort = 'rec' | 'low' | 'high';

// 부적 목록 v4 — 머리 그림 → 분류 탭 5개(전체·재물·성공·사랑·인연·소원·성취·평안·보호, 아이콘) → 정렬 → 부적 30종(실제 부적 그림 썸네일)
export function TalismanList() {
  const [sp, setSp] = useSearchParams();
  const groups = ['전체', ...BRAND.groups.talisman];
  const g = sp.get('g') && groups.includes(sp.get('g')!) ? sp.get('g')! : '전체';
  const [sort, setSort] = useState<Sort>('rec');
  const mine = useApp((s) => s.talismans);
  const list = TALISMANS.filter((t) => t.visible !== false && (g === '전체' || t.group === g))
    .sort((a, b) => (sort === 'low' ? a.price - b.price : sort === 'high' ? b.price - a.price : 0) || a.sort - b.sort);
  return (
    <>
      <SubHeader title="나만의 부적" sub="간절한 소망을 담은 나만의 부적" back={false} />
      <main className="screen bj4">
        <div className="bjhead">
          <img src={v4('home_talisman')} alt="" />
          <div className="tx"><small>WISH TALISMAN</small><h2>나만의 <b>부적</b></h2><p>좋은 기운이 함께하는<br />행복한 하루가 되시길 바랍니다.</p></div>
        </div>
        <PremiumButton />
        <div className="bjtabs" role="tablist" aria-label="부적 분류">
          {groups.map((x) => (
            <button key={x} role="tab" aria-selected={x === g} className={x === g ? 'on' : ''} onClick={() => setSp(x === '전체' ? {} : { g: x }, { replace: true })}>
              <Icon name={GROUP_ICON[x]} size={24} /><span>{x}</span>
            </button>
          ))}
        </div>
        <div className="bjlisthead">
          <h3>{g === '전체' ? '전체 부적' : g}<small>{list.length}종 · 좋은 기운이 늘 함께하길 바랍니다.</small></h3>
          <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="rec">추천순</option><option value="low">낮은 가격순</option><option value="high">높은 가격순</option>
          </select>
        </div>
        <div className="plist">
          {list.map((t) => <ProductRow key={t.id} p={t} owned={mine.some((m) => m.talismanId === t.id)} />)}
        </div>
      </main>
    </>
  );
}

// 부적 상세 v4 — 금전재물부 시안 기준, 30종 같은 틀: 촛불 부적 공방 그림 → 부적 설명서 → 부적에 담긴 기원 3(아이콘 카드) → 이런 분께 추천합니다 → 사용 방법 3단계 → 하단 고정(정가·회원가·구매)
export function TalismanDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const premium = usePremium();
  const t = productById(id);
  if (!t || !isTalisman(t)) return <Navigate to="/talisman" replace />;
  const who = CHAR[charOf(t)];
  const eff = EFF[t.id];
  const m = memberPrice(t);
  const lead = (t.detail ?? '').split('. ')[0].replace(/\.$/, '') + '.';
  return (
    <>
      <SubHeader title={t.title} sub={t.cardCopy} />
      <main className="screen no-tab sticky-pad bjd4">
        <div className="bjd-hero">
          <img src={v4('talisman_hero')} alt="" />
          <div className="papers" aria-hidden><TalismanPaper t={t} size={1.75} /></div>
          <div className="tx"><h1>{t.title}</h1><p className="cp">{t.cardCopy}</p><p>{lead}</p></div>
        </div>
        <section className="frame bjd-desc"><span className="lbl">부적 설명서</span><p className="body">{eff?.intro ?? t.detail}</p></section>
        <h2 className="bjd-h">부적에 담긴 기원</h2>
        <div className="bjd-effects">
          {eff?.effects.map((e) => <div key={e.title}><span className="ic"><Icon name={e.icon} size={26} /></span><b>{e.title}</b><p>{e.desc}</p></div>)}
        </div>
        {eff?.targets && (
          <>
            <h2 className="bjd-h">이런 분께 추천합니다</h2>
            <ul className="bjd-targets">{eff.targets.map((x) => <li key={x}><span aria-hidden>✓</span>{x}</li>)}</ul>
          </>
        )}
        <h2 className="bjd-h">사용 방법</h2>
        <ol className="pd-steps bjd-steps">
          <li><span className="n">1</span><span className="ic"><Icon name="flame" size={26} /></span><b>소원 적기</b><span className="ds">이름과 생년월일, 간절한 소망을 한지에 적어 마음으로 빕니다.</span></li>
          <li><span className="n">2</span><span className="ic"><Icon name="hand-helping" size={26} /></span><b>부적 완성</b><span className="ds">{who.name}가 정성으로 기운을 담아 부적을 완성합니다.</span></li>
          <li><span className="n">3</span><span className="ic"><Icon name="landmark" size={26} /></span><b>보관·지참·봉안</b><span className="ds">지갑·서랍·사무실 등 소중한 곳에 보관하거나 휴대폰에 저장하세요.</span></li>
        </ol>
        <p className="bjd-note"><Icon name="sparkles" size={18} />당신의 마음을 담아 완성하는 하나뿐인 부적입니다. 좋은 기운이 늘 함께하길 바랍니다.</p>
      </main>
      <div className="buy4 bjbuy">
        <div className="pp">
          {premium ? <><s>{won(t.price)}</s><b>{won(m)}</b><em>프리미엄 회원가</em></>
            : <><span className="lbl">정가</span><b className="list">{won(t.price)}</b><span className="mem"><strong>{won(m)}</strong> 프리미엄 회원가</span></>}
        </div>
        <button className="go" onClick={() => nav(`/checkout/${t.id}`)}>{buyLabel(t).replace(/\s*[–-]\s*[\d,]+원$/, '')} ›</button>
      </div>
    </>
  );
}

// 붓글씨 획(SVG stroke-dashoffset 로 그려지는 연출) — 부적 글자 모양을 흉내 낸 추상 획

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
  const [share, setShare] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const paid = purchases.some((p) => p.orderId === orderId && p.productId === id);

  const finish = () => {
    const mt = { id: newId(), talismanId: id, orderId, name: profile.name, birth: birthLabel(profile), wish: wish.trim(), issuedAt: new Date().toISOString().slice(0, 10) };
    addTalisman(mt);
    if (!MOCK_MODE) void saveTalismanToServer(mt); // 계정에 보관 — 다른 기기·웹/모바일 부적함에도 보이게
    setPhase('done');
  };

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
    return <TalismanRitual t={t} name={profile.name} birth={birthLabel(profile)} wish={wish.trim()} onDone={finish} />;

  return (
    <main className="make">
      <h1>나만의 {t.title}이<br />완성되었습니다</h1>
      <div className="paper" ref={paperRef} style={{ padding: 14, background: 'var(--ink)', borderRadius: 16 }}>
        <TalismanPaper t={t} size={2.6} name={mine?.name} birth={mine?.birth} wish={mine?.wish} issued={mine?.issuedAt} />
      </div>
      <div className="done">
        <div className="btn-row">
          <Button kind="gold" onClick={async () => {
            try {
              const pic = talismanImg(t.id);
              if (pic) await saveTalismanImage(pic.src, `talisman_${t.id}.png`);
              else if (paperRef.current) await saveImage(paperRef.current, `talisman_${t.id}.png`); // 그림이 없는 부적(글자형)만 화면 캡처
              if (lastSaveMode !== 'longpress') toast(isNativeApp() ? '저장했어요' : '부적 이미지를 내려받았어요');
            } catch { toast('저장하지 못했어요. 다시 시도해 주세요'); }
          }}>이미지로 저장</Button>
          <Button kind="ink" onClick={() => setShare(true)}>공유하기(선물)</Button>
        </div>
        <Link to="/box#talismans" className="textlink" style={{ color: 'var(--gold-light)', display: 'inline-flex', alignItems: 'center', marginTop: 10 }}>나의 부적함에서 보기 ›</Link>
      </div>
      {/* 공유 = 부적 대표 그림 + 부적 소개 1문장 + 부적 상품 링크(이름·소원은 넣지 않음 — 개인 정보) */}
      <ShareSheet open={share} onClose={() => setShare(false)} title={`${t.title} · 나만의 운세`} text={t.cardCopy} image={thumbOf(t).src ?? talismanImg(t.id)?.src} path={`/talisman/${t.id}`} contentId={t.id} onDone={(m) => m && toast(m)} />
    </main>
  );
}

// 부적 쓰기(결제 후) — 2026-10-29 대표님 요청: 효과음·버튼 의식이 게임처럼 가벼워 보여서
// 화면이 바뀌며 '붓으로 부적을 쓰는 장면' 이미지 한 장 + 차분한 진행 표시만 보여 주고, 다 되면 완성된 부적으로. 소리 없음.
const WRITING_IMG = '/img/talisman/writing.webp';
const WRITING_TEXT = ['정갈한 마음으로 붓을 듭니다', '소원을 한 획 한 획 새기고 있습니다', '부적에 기운을 담고 있습니다', '부적이 완성되었습니다'];
function TalismanRitual({ t, name, onDone }: { t: Talisman; name: string; birth: string; wish: string; onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const total = reduce ? 1200 : 5200; // 전체 시간(ms)
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / total) * 100);
      setPct(p);
      if (p >= 100) { window.clearInterval(id); window.setTimeout(onDone, 500); }
    }, 80);
    return () => window.clearInterval(id);
  }, []);
  const msg = WRITING_TEXT[Math.min(WRITING_TEXT.length - 1, Math.floor(pct / 34))];
  return (
    <main className="writing" aria-live="polite">
      <img src={WRITING_IMG} alt="" className="writing-bg" draggable={false} />
      <div className="writing-veil" aria-hidden />
      <div className="writing-tx">
        <b>{name}님의 {t.title}</b>
        <p>{msg}</p>
        <div className="writing-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><i style={{ width: `${pct}%` }} /></div>
      </div>
    </main>
  );
}

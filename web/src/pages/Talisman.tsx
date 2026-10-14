// 나만의 부적 — 목록(분류 4) / 상세(부적 설명서·효험 3·사용 방법·구매) / 작성 연출(결제 후) → 부적함 보관·저장·공유(선물)
import { PremiumButton } from '../components/PremiumPopup';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import effectsDb from '@naman/content/data/talisman-effects.json';
import { SubHeader } from '../components/layout';
import { Icon } from '../components/Icon';
import { v4 } from '../assets/images';
import { Button, ProductRow, TalismanPaper, useToast } from '../components/ui';
import { Img } from '../components/Img';
import { ShareSheet } from '../components/ShareSheet';
import { BRAND, CHAR, TALISMANS, buyLabel, charOf, memberPrice, productById, isTalisman, won, type Talisman } from '../lib/catalog';
import { newId, useApp, useMainProfile, usePremium } from '../store/app';
import { saveImage } from '../lib/share';
import { music, sfx } from '../lib/sound';
import { SoundToggle } from '../components/SoundToggle';
import { birthLabel } from './ProfileNew';

type Eff = { effects: { icon: string; title: string; desc: string }[]; targets?: string[]; wishExamples: string[] };
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
        <section className="frame bjd-desc"><span className="lbl">부적 설명서</span><p className="body">{t.detail}</p></section>
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
    addTalisman({ id: newId(), talismanId: id, orderId, name: profile.name, birth: birthLabel(profile), wish: wish.trim(), issuedAt: new Date().toISOString().slice(0, 10) });
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
          <Button kind="gold" onClick={async () => { if (paperRef.current) { await saveImage(paperRef.current, `talisman_${t.id}.png`); toast('휴대폰에 저장했어요'); } }}>휴대폰에 저장하기</Button>
          <Button kind="ink" onClick={() => setShare(true)}>공유하기(선물)</Button>
        </div>
        <Link to="/box#talismans" className="textlink" style={{ color: 'var(--gold-light)', display: 'inline-flex', alignItems: 'center', marginTop: 10 }}>나의 부적함에서 보기 ›</Link>
      </div>
      <ShareSheet open={share} onClose={() => setShare(false)} title={`${mine?.name}님이 ${t.title}을 선물했어요`} text={`마음을 담아 ${t.title}을 보내요 — “${mine?.wish}”`} path={`/talisman/${t.id}`} contentId={t.id} onDone={(m) => m && toast(m)} />
    </main>
  );
}

// 부적 의식(결제 후) — 타로 테이블처럼 손으로 하나씩: 향 피우기 → 붓으로 부적 그리기 → 이름·소원 새기기 → 인장 찍기 → 기운 봉인
// 효과음·배경음악(끄기 버튼 따로). 부적 그림은 대표님 그림(talisman_<id>)이 있으면 그 그림이 붓질로 드러난다.
type Rite = 'incense' | 'lit' | 'brush' | 'write' | 'seal' | 'sealed' | 'bless';
const RITE_ORDER: Rite[] = ['incense', 'lit', 'brush', 'write', 'seal', 'sealed', 'bless'];
const RITE_TEXT: Record<Rite, string> = {
  incense: '향을 피워 마음을 맑게 합니다',
  lit: '향 연기가 오르며 자리가 정갈해졌습니다',
  brush: '붓에 기운을 담아 부적을 그립니다',
  write: '소원을 담아 기운을 새기는 중입니다',
  seal: '마지막으로 인장을 찍어 주세요',
  sealed: '인장이 찍혔습니다',
  bless: '부적에 좋은 기운을 불어넣는 중입니다',
};
const RITE_DOTS: [Rite, string][] = [['incense', '향'], ['brush', '붓'], ['write', '새김'], ['seal', '인장'], ['bless', '봉인']];
function TalismanRitual({ t, name, birth, wish, onDone }: { t: Talisman; name: string; birth: string; wish: string; onDone: () => void }) {
  const [r, setR] = useState<Rite>('incense');
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, n: number) => { timers.current.push(window.setTimeout(fn, reduce ? 150 : n)); };
  useEffect(() => { music.acquire(); return () => { music.release(); timers.current.forEach(clearTimeout); }; }, []);
  const light = () => { music.start(); sfx.incense(); setR('lit'); later(() => setR('brush'), 1800); };
  const draw = () => {
    sfx.brush(3.2);
    setR('write');
    later(() => sfx.write(), 3300);
    later(() => setR('seal'), 4600);
  };
  const stamp = () => {
    sfx.stamp();
    setR('sealed');
    later(() => { sfx.bless(); setR('bless'); }, 900);
    later(onDone, 3800);
  };
  const cur = RITE_ORDER.indexOf(r);
  const drawn = cur >= RITE_ORDER.indexOf('write');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <main className={`make rite r-${r}`} aria-live="polite">
      <SoundToggle />
      <h1>{name}님의 {t.title}</h1>
      <p className="rite-step">{RITE_TEXT[r]}</p>
      <div className="altar">
        <div className="rite-paper">
          <div className="blank" aria-hidden />
          <div className={`ink${drawn ? ' go' : ''}`}><TalismanPaper t={t} size={2.6} name={cur >= RITE_ORDER.indexOf('seal') ? name : undefined} birth={birth} wish={wish} issued={today} /></div>
          {r === 'write' && <span className="brush" aria-hidden />}
          {cur >= RITE_ORDER.indexOf('sealed') && <span className="seal-mark" aria-hidden>符<br />印</span>}
          {r === 'bless' && <span className="glow" aria-hidden />}
          {r === 'bless' && <span className="sparks" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</span>}
        </div>
        {/* 대표님 10/14: 향로를 실사처럼 — 놋쇠 향로 사진(burner.webp, 배경 투명). 불씨·연기는 향 끝에서 */}
        <div className={`burner${r === 'incense' ? '' : ' on'}`} aria-hidden>
          <img src="/img/talisman/burner.webp" alt="" width={360} height={501} draggable={false} />
          {[0, 1, 2].map((k) => <span key={k} className={`tip t${k}`}><i className="ember" /><i className="smoke" /><i className="smoke s2" /></span>)}
        </div>
      </div>
      <div className="rite-act">
        {r === 'incense' && <Button kind="gold" onClick={light}>향 피우기</Button>}
        {r === 'brush' && <Button kind="gold" onClick={draw}>붓 들어 부적 그리기</Button>}
        {r === 'seal' && <button type="button" className="seal-btn" onClick={stamp}><span aria-hidden>印</span>인장 찍기</button>}
      </div>
      <ol className="rite-dots" aria-label="부적 의식 순서">
        {RITE_DOTS.map(([x, label]) => {
          const at = RITE_ORDER.indexOf(x);
          const on = cur === at || (x === 'incense' && r === 'lit') || (x === 'seal' && r === 'sealed');
          return <li key={x} className={on ? 'on' : cur > at ? 'past' : ''}>{label}</li>;
        })}
      </ol>
    </main>
  );
}

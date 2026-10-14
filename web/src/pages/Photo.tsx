// 사진운세 v4 (대표님 2차 수정) — 결제 후 /reading/:orderId 에서
// 손금·관상: 어두운 촬영 화면(가이드 + 동의 + [사진 찍기] [앨범에서 찾기]) → 분석 중 → 결과(아이보리 한지: 견본 손/얼굴 사진 + 번호 색선 7개 + 총평·전체 모양·항목별 보이는 모습/풀이/조언·시기별 흐름·습관)
// 2세 얼굴보기: 두 사람 사진 → AI 가 아들·딸 2장 → 저장·공유
// 사진은 이 화면 메모리에만 두고, 서버도 메모리에서만 처리(저장·로그 없음). 결과 글·2세 그림만 그 주문에 보관(운세함에서 다시 보기).
import { useEffect, useRef, useState } from 'react';
import sample from '@naman/content/data/photo-sample.json';
import { CharacterBubble, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { MOCK_MODE } from '../lib/api';
import { apiAuth } from '../platform/payments';
import { useApp } from '../store/app';
import type { PhotoProduct } from '../lib/catalog';

type Kind = 'palm' | 'face';
type Section = { key?: string; title: string; emoji?: string; feature?: string; body: string; advice?: string };
type Result = { title: string; intro: string; overview?: { title: string; body: string }; sections: Section[]; timeline?: { label: string; body: string }[]; tips?: string[]; closing: string; generatedBy?: string };
type Baby = { boy: string; girl: string; generatedBy?: string };

// 7개 항목 — 번호·색·이모지 (손금 = 선, 관상 = 부위). 색은 대표님 참고 화면 순서(빨강·파랑·초록·노랑·보라·분홍·주황)
const COLORS = ['#E5484D', '#2F7BEA', '#22A55E', '#E6B80B', '#A855F7', '#EC4899', '#F97316'];
export const PALM = [
  { key: 'life', title: '생명선', emoji: '💖' }, { key: 'head', title: '두뇌선', emoji: '🧠' }, { key: 'heart', title: '감정선', emoji: '❤️' },
  { key: 'fate', title: '운명선', emoji: '💼' }, { key: 'sun', title: '태양선', emoji: '🌟' }, { key: 'marriage', title: '결혼선', emoji: '💍' },
  { key: 'wealth', title: '재물선', emoji: '💰' },
].map((x, i) => ({ ...x, color: COLORS[i] }));
export const FACE = [
  { key: 'forehead', title: '이마', emoji: '🌄' }, { key: 'brow', title: '눈썹', emoji: '〰️' }, { key: 'eye', title: '눈', emoji: '👁️' },
  { key: 'nose', title: '코', emoji: '💰' }, { key: 'mouth', title: '입', emoji: '💬' }, { key: 'ear', title: '귀', emoji: '👂' },
  { key: 'chin', title: '턱', emoji: '🏔️' },
].map((x, i) => ({ ...x, color: COLORS[i] }));
const META = { palm: PALM, face: FACE };
// 항목마다 "무엇을 보는 선(부위)인지" 설명 — 대표님 10/14: 손금별 설명 문구
export const ABOUT = (sample as any).about as Record<Kind, Record<string, string>>;
const sampleOf = (kind: Kind): Result => ({ ...(sample as any)[kind], sections: (sample as any)[kind].sections.map((s: Section, i: number) => ({ ...s, ...META[kind][i] })) });

// 견본 손바닥 사진 + 번호 붙은 색선 7개 (사진: web/public/img/photo/palm_sample.webp, 좌표는 1024 기준)
const PALM_PATHS = [
  'M362 566 C 322 650, 336 770, 432 846', 'M366 566 C 452 590, 556 636, 632 690', 'M726 520 C 640 480, 540 468, 448 476',
  'M524 846 C 520 740, 516 640, 512 520', 'M616 762 C 613 680, 610 600, 608 528', 'M740 468 L 690 476', 'M686 700 C 684 650, 681 610, 678 570',
];
const PALM_TAGS: [number, number][] = [[316, 720], [648, 730], [430, 446], [526, 884], [606, 798], [778, 462], [704, 540]];
const FACE_TAGS: [number, number][] = [[500, 222], [410, 350], [612, 474], [500, 548], [500, 668], [250, 500], [500, 758]];
function Tag({ x, y, i }: { x: number; y: number; i: number }) {
  return <g><circle cx={x} cy={y} r="27" fill={COLORS[i]} stroke="#fff" strokeWidth="5" /><text x={x} y={y + 11} textAnchor="middle" fontSize="32" fontWeight="900" fill="#fff" fontFamily="Pretendard, sans-serif">{i + 1}</text></g>;
}
export function PalmChart() {
  return (
    <svg viewBox="0 0 1024 1024" className="palmsvg photo" role="img" aria-label="손금 일곱 개 선 위치 그림">
      <image href="/img/photo/palm_sample.webp" width="1024" height="1024" />
      {PALM_PATHS.map((d, i) => <path key={i} d={d} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth={i === 5 ? 18 : 15} strokeLinecap="round" />)}
      {PALM_PATHS.map((d, i) => <path key={`c${i}`} d={d} fill="none" stroke={COLORS[i]} strokeWidth={i === 5 ? 11 : 9} strokeLinecap="round" />)}
      {PALM_TAGS.map(([x, y], i) => <Tag key={i} x={x} y={y} i={i} />)}
    </svg>
  );
}
// 견본 얼굴 사진 + 번호 붙은 부위 7곳 (가상 인물 AI 사진)
export function FaceChart() {
  return (
    <svg viewBox="0 0 1024 1024" className="palmsvg photo" role="img" aria-label="관상 일곱 부위 위치 그림">
      <image href="/img/photo/face_sample.webp" width="1024" height="1024" />
      {FACE_TAGS.map(([x, y], i) => <Tag key={i} x={x} y={y} i={i} />)}
    </svg>
  );
}

// 상품 상세 "OO 분석 결과는 이렇게 보여집니다!" — 대표님 10/14 참고 화면(검은 바탕 대신 아이보리 한지)
export function PhotoPreview({ kind }: { kind: Kind }) {
  const meta = META[kind];
  const ex = sampleOf(kind);
  const first2 = (t: string) => t.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  return (
    <section className="ph-prev">
      <h2><span aria-hidden>✓</span> {kind === 'palm' ? '손금' : '관상'} 분석 결과는 이렇게 보여집니다!</h2>
      <div className="ph-circle">{kind === 'palm' ? <PalmChart /> : <FaceChart />}</div>
      <ul className="ph-list">
        {meta.map((m, i) => (
          <li key={m.key}>
            <b><i style={{ background: m.color }} aria-hidden />{m.title} <span aria-hidden>{m.emoji}</span></b>
            <small>{ABOUT[kind][m.key]}</small>
            <p>{first2(ex.sections[i].body)}<span className="more" aria-label="풀이에서 이어서 볼 수 있어요"> …</span></p>
          </li>
        ))}
      </ul>
      <p className="ph-note">예시 화면이에요. 실제 풀이는 올려 주신 {kind === 'palm' ? '손바닥' : '얼굴'} 사진을 보고 항목마다 <b>보이는 모습 · 풀이 · 조언</b>으로 자세히 알려 드려요.</p>
    </section>
  );
}

// 휴대폰 원본(수 MB)을 긴 변 1280px JPEG 로 줄여서 보낸다 — 전송량·서버 메모리 절약
async function readFile(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 1280 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || 300) * k));
    c.height = Math.max(1, Math.round((img.naturalHeight || 300) * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

// [사진 찍기] [앨범에서 찾기] 두 버튼
function PickButtons({ onPick, facing, compact }: { onPick: (d: string) => void; facing: 'user' | 'environment'; compact?: boolean }) {
  const take = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);
  const on = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPick(await readFile(f)); };
  return (
    <div className={`pick2${compact ? ' sm' : ''}`}>
      <button type="button" onClick={() => take.current?.click()}><Icon name="camera" size={compact ? 18 : 22} />사진 찍기</button>
      <button type="button" onClick={() => album.current?.click()}><Icon name="image" size={compact ? 18 : 22} />앨범에서 찾기</button>
      <input ref={take} type="file" accept="image/*" capture={facing} hidden onChange={on} />
      <input ref={album} type="file" accept="image/*" hidden onChange={on} />
    </div>
  );
}

async function loadSaved<T>(orderId: string, key: 'photo' | 'baby'): Promise<T | null> {
  if (MOCK_MODE || orderId.startsWith('sample-')) return null;
  try { const r = await apiAuth<{ content?: Record<string, unknown> }>(`/readings/${orderId}`); return (r.content?.[key] as T) ?? null; } catch { return null; }
}

export function PhotoReading({ p, orderId }: { p: PhotoProduct; orderId: string }) {
  if (p.id === 'baby') return <BabyReading orderId={orderId} />;
  return <PalmFaceReading kind={p.id as Kind} orderId={orderId} />;
}

function PalmFaceReading({ kind, orderId }: { kind: Kind; orderId: string }) {
  const { unlocked, unlock } = useApp();
  const doneKey = `photo:${orderId}`;
  const [step, setStep] = useState<'upload' | 'analyzing' | 'result'>(unlocked[doneKey] ? 'result' : 'upload');
  const [agree, setAgree] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<Result | null>(unlocked[doneKey] && MOCK_MODE ? sampleOf(kind) : null);
  useEffect(() => { if (unlocked[doneKey] && !result) void loadSaved<Result>(orderId, 'photo').then((r) => setResult(r ?? sampleOf(kind))); }, []);
  useEffect(() => {
    if (step !== 'analyzing' || !image) return;
    const run = MOCK_MODE
      ? new Promise<Result>((r) => setTimeout(() => r(sampleOf(kind)), 2400))
      : apiAuth<Result>('/photo/analyze', { method: 'POST', body: JSON.stringify({ kind, image, orderId }) });
    run.then((r) => { setResult(r); setImage(null); unlock(doneKey); setStep('result'); }) // 결과가 나오면 사진은 바로 버린다
      .catch((e) => { setErr((e as Error).message); setStep('upload'); });
  }, [step]);
  const label = kind === 'palm' ? '손바닥' : '얼굴 정면';
  const meta = META[kind];

  if (step === 'upload')
    return (
      <section className="ph-dark">
        <small className="en">{kind === 'palm' ? 'PALM READING' : 'FACE READING'}</small>
        <h2>{label} 사진을 올려 주세요</h2>
        <div className="ph-frame">
          {image ? <img src={image} alt="올린 사진 미리보기" /> : (kind === 'palm' ? <PalmChart /> : <FaceChart />)}
          {!image && <span className="corner" aria-hidden />}
        </div>
        <ul className="ph-tips">{sample.guide[kind].map((t) => <li key={t}><Icon name="check" size={16} />{t}</li>)}</ul>
        <label className="ph-agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>사진은 이번 풀이에만 쓰고 <b>풀이 직후 바로 삭제</b>돼요. 동의합니다.</span></label>
        {err && <p className="err" role="alert">{err}</p>}
        {agree && (image
          ? <><button className="tgold" onClick={() => setStep('analyzing')}>✦ 풀이 시작하기</button><PickButtons onPick={(d) => { setErr(''); setImage(d); }} facing={kind === 'face' ? 'user' : 'environment'} compact /></>
          : <PickButtons onPick={(d) => { setErr(''); setImage(d); }} facing={kind === 'face' ? 'user' : 'environment'} />)}
      </section>
    );
  if (step === 'analyzing')
    return (
      <section className="ph-dark analyzing" aria-live="polite">
        <div className="ph-frame scan">{kind === 'palm' ? <PalmChart /> : <FaceChart />}<i aria-hidden /></div>
        <h2>{kind === 'palm' ? '손금' : '관상'}을 자세히 살피고 있어요…</h2>
        <p className="muted center">일곱 {kind === 'palm' ? '선' : '부위'}을 차례로 읽는 중이에요 (약 30~60초)</p>
      </section>
    );
  return (
    <div className="ph-res">
      <p className="photo-deleted">✓ 올려 주신 사진은 풀이 직후 삭제되었어요</p>
      {result && (
        <>
          <section className="ph-map">
            <div className="ph-circle">{kind === 'palm' ? <PalmChart /> : <FaceChart />}</div>
            <ol>{meta.map((m, i) => <li key={m.key}><span style={{ background: m.color }}>{i + 1}</span>{m.title}</li>)}</ol>
          </section>
          <section className="ph-box ph-intro"><h3>총평</h3><p>{result.intro}</p></section>
          {result.overview && <section className="ph-box"><h3>{result.overview.title}</h3><p>{result.overview.body}</p></section>}
          {result.sections.map((s, i) => (
            <section className="ph-sec" key={s.title}>
              <h3><span className="no" style={{ background: meta[i]?.color }}>{i + 1}</span>{s.title}<span aria-hidden>{meta[i]?.emoji}</span></h3>
              {meta[i] && <p className="about">{ABOUT[kind][meta[i].key]}</p>}
              {s.feature && <p className="feat"><b>보이는 모습</b>{s.feature}</p>}
              <p className="body">{s.body}</p>
              {s.advice && <p className="adv"><b>이렇게 해 보세요</b>{s.advice}</p>}
            </section>
          ))}
          {!!result.timeline?.length && (
            <section className="ph-box">
              <h3>시기별 흐름</h3>
              <ol className="ph-tl">{result.timeline.map((t) => <li key={t.label}><b>{t.label}</b><p>{t.body}</p></li>)}</ol>
            </section>
          )}
          {!!result.tips?.length && (
            <section className="ph-box">
              <h3>복을 키우는 습관</h3>
              <ul className="ph-tips2">{result.tips.map((t) => <li key={t}><Icon name="check" size={18} />{t}</li>)}</ul>
            </section>
          )}
          <section className="ph-box ph-close"><p>{result.closing}</p></section>
          {(MOCK_MODE || result.generatedBy === 'sample') && <p className="note pad">시범 단계라 예시 풀이예요. 정식 오픈 때 올려 주신 사진으로 새로 풀어 드려요.</p>}
        </>
      )}
    </div>
  );
}

function BabyReading({ orderId }: { orderId: string }) {
  const toast = useToast();
  const { unlocked, unlock } = useApp();
  const doneKey = `photo:${orderId}`;
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Baby | null>(unlocked[doneKey] && MOCK_MODE ? { boy: '/img/v4/baby_boy.webp', girl: '/img/v4/baby_girl.webp', generatedBy: 'sample' } : null);
  useEffect(() => { if (unlocked[doneKey] && !res) void loadSaved<Baby>(orderId, 'baby').then((r) => r && setRes(r)); }, []);
  const go = async () => {
    setBusy(true); setErr('');
    try {
      const r = MOCK_MODE
        ? await new Promise<Baby>((ok) => setTimeout(() => ok({ boy: '/img/v4/baby_boy.webp', girl: '/img/v4/baby_girl.webp', generatedBy: 'sample' }), 2600))
        : await apiAuth<Baby>('/photo/baby', { method: 'POST', body: JSON.stringify({ a, b, orderId }) });
      setRes(r); setA(null); setB(null); unlock(doneKey);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const save = (src: string, name: string) => {
    const el = document.createElement('a');
    el.href = src; el.download = `naman-unse_baby_${name}.png`; el.click();
    toast('사진을 저장했어요');
  };
  if (res)
    return (
      <section className="baby-res">
        <p className="photo-deleted">✓ 올려 주신 두 분의 사진은 바로 삭제되었어요</p>
        <h2>두 분을 닮은 우리 아이</h2>
        <div className="baby2">
          {([['boy', '아들', res.boy], ['girl', '딸', res.girl]] as const).map(([k, l, src]) => (
            <figure key={k}><img src={src} alt={`AI 가 그린 ${l}의 얼굴`} /><figcaption>{l}</figcaption><button onClick={() => save(src, k)}><Icon name="download" size={16} />저장</button></figure>
          ))}
        </div>
        <CharacterBubble who="wolha">두 분의 눈매와 웃는 입매가 아이에게 고스란히 담겼어요. 재미로 보는 AI 그림이니 즐겁게 간직해 주세요.</CharacterBubble>
        {(MOCK_MODE || res.generatedBy === 'sample') && <p className="note pad">시범 단계라 예시 그림이에요. 정식 오픈 때 두 분 사진으로 새로 그려 드려요.</p>}
      </section>
    );
  return (
    <section className="ph-dark">
      <small className="en">BABY FACE</small>
      <h2>두 분의 사진을 올려 주세요</h2>
      <p className="ph-sub">정면 얼굴 사진 두 장이면 AI 가 아들·딸 두 가지 모습을 그려 드려요.</p>
      <div className="baby-up">
        {([['나', a, setA], ['상대', b, setB]] as const).map(([l, v, set]) => (
          <div key={l} className="slot">
            <div className="ph-frame sm">{v ? <img src={v} alt={`${l} 사진 미리보기`} /> : <span className="who"><Icon name="user" size={34} />{l}</span>}</div>
            {agree && <PickButtons onPick={(d) => set(d)} facing="user" compact />}
          </div>
        ))}
      </div>
      <ul className="ph-tips">{sample.guide.face.map((t) => <li key={t}><Icon name="check" size={16} />{t}</li>)}</ul>
      <label className="ph-agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>두 사람 모두 사진 사용에 동의했고, 사진은 <b>그림을 만든 직후 바로 삭제</b>돼요.</span></label>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="tgold" disabled={!agree || !a || !b || busy} onClick={go}>{busy ? '아이 얼굴을 그리는 중… (약 30초)' : '✦ 우리 아이 얼굴 보기'}</button>
    </section>
  );
}

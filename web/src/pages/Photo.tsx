// 사진운세 v4 (대표님 2차 수정) — 결제 후 /reading/:orderId 에서
// 손금·관상: 어두운 촬영 화면(가이드 + 동의 + [사진 찍기] [앨범에서 찾기]) → 분석 중 → 결과(견본 손/얼굴 그림 + 번호 색선 7개 + 항목별 풀이)
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
type Section = { key?: string; title: string; emoji?: string; body: string };
type Result = { title: string; intro: string; sections: Section[]; closing: string; generatedBy?: string };
type Baby = { boy: string; girl: string; generatedBy?: string };

// 7개 항목 — 번호·색·이모지 (손금 = 선, 관상 = 부위)
export const PALM = [
  { key: 'life', title: '생명선', emoji: '🌱', color: '#E5484D' }, { key: 'head', title: '두뇌선', emoji: '🧠', color: '#3B82F6' },
  { key: 'heart', title: '감정선', emoji: '💗', color: '#EC4899' }, { key: 'fate', title: '운명선', emoji: '🧭', color: '#8B5CF6' },
  { key: 'sun', title: '태양선', emoji: '☀️', color: '#F59E0B' }, { key: 'marriage', title: '결혼선', emoji: '💍', color: '#14B8A6' },
  { key: 'wealth', title: '재물선', emoji: '💰', color: '#22A55E' },
];
export const FACE = [
  { key: 'forehead', title: '이마', emoji: '🌄', color: '#E5484D' }, { key: 'brow', title: '눈썹', emoji: '〰️', color: '#3B82F6' },
  { key: 'eye', title: '눈', emoji: '👁️', color: '#EC4899' }, { key: 'nose', title: '코', emoji: '💰', color: '#8B5CF6' },
  { key: 'mouth', title: '입', emoji: '💬', color: '#F59E0B' }, { key: 'ear', title: '귀', emoji: '👂', color: '#14B8A6' },
  { key: 'chin', title: '턱', emoji: '🏔️', color: '#22A55E' },
];
const META = { palm: PALM, face: FACE };
const sampleOf = (kind: Kind): Result => ({ ...(sample as any)[kind], sections: (sample as any)[kind].sections.map((s: Section, i: number) => ({ ...s, ...META[kind][i] })) });

// 견본 손바닥 그림 — 번호 붙은 색선 7개
export function PalmChart() {
  const L = PALM.map((p) => p.color);
  const lines = [
    'M74 128 C 52 150, 50 196, 78 236', // 생명선
    'M74 130 C 100 140, 135 150, 168 168', // 두뇌선
    'M178 120 C 155 108, 125 106, 98 118', // 감정선
    'M118 240 C 116 200, 114 160, 112 104', // 운명선
    'M146 206 C 144 170, 142 140, 140 108', // 태양선
    'M182 104 L 166 106', // 결혼선
    'M160 196 C 162 170, 164 140, 166 112', // 재물선
  ];
  const tags: [number, number][] = [[64, 238], [176, 172], [186, 124], [118, 252], [146, 218], [190, 98], [160, 208]];
  return (
    <svg viewBox="0 0 240 270" className="palmsvg" role="img" aria-label="손금 일곱 개 선 위치 그림">
      <path d="M60 250 C 40 210, 38 170, 50 140 L 30 96 C 24 82, 40 74, 48 86 L 70 120 L 72 40 C 72 26, 90 26, 90 40 L 94 100 L 100 24 C 100 10, 120 10, 120 24 L 120 98 L 130 34 C 132 20, 150 22, 148 36 L 144 104 L 160 56 C 164 44, 180 48, 176 62 L 172 130 C 186 160, 186 200, 174 232 C 166 252, 148 262, 120 262 L 84 262 C 72 262, 64 258, 60 250 Z"
        fill="#F6E3CC" stroke="#C9A27A" strokeWidth="2" />
      {lines.map((d, i) => <path key={i} d={d} fill="none" stroke={L[i]} strokeWidth={i === 5 ? 4 : 3.4} strokeLinecap="round" />)}
      {tags.map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="9" fill={L[i]} /><text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">{i + 1}</text></g>
      ))}
    </svg>
  );
}
// 견본 얼굴 그림 — 번호 붙은 부위 7곳
export function FaceChart() {
  const pts: [number, number][] = [[120, 62], [92, 100], [148, 116], [120, 146], [120, 178], [56, 132], [120, 214]];
  return (
    <svg viewBox="0 0 240 250" className="palmsvg" role="img" aria-label="관상 일곱 부위 위치 그림">
      <ellipse cx="120" cy="130" rx="66" ry="92" fill="#F6E3CC" stroke="#C9A27A" strokeWidth="2" />
      <ellipse cx="52" cy="132" rx="10" ry="22" fill="#F6E3CC" stroke="#C9A27A" strokeWidth="2" />
      <ellipse cx="188" cy="132" rx="10" ry="22" fill="#F6E3CC" stroke="#C9A27A" strokeWidth="2" />
      <path d="M78 104 Q 92 96 106 102 M134 102 Q 148 96 162 104" stroke="#6B4A2A" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M84 118 Q 94 112 104 118 Q 94 122 84 118 Z M136 118 Q 146 112 156 118 Q 146 122 136 118 Z" fill="#4A3020" />
      <path d="M120 124 L 114 150 Q 120 154 126 150" stroke="#B8875A" strokeWidth="2.4" fill="none" />
      <path d="M104 176 Q 120 186 136 176" stroke="#C0505A" strokeWidth="3" fill="none" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="9" fill={FACE[i].color} /><text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">{i + 1}</text></g>
      ))}
    </svg>
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
        <h2>천궁도사가 {kind === 'palm' ? '손금' : '관상'}을 살피고 있소…</h2>
        <p className="muted center">일곱 {kind === 'palm' ? '선' : '부위'}을 차례로 읽는 중이에요 (약 20초)</p>
      </section>
    );
  return (
    <>
      <p className="photo-deleted">✓ 올려 주신 사진은 풀이 직후 삭제되었어요</p>
      {result && (
        <>
          <section className="ph-map">
            {kind === 'palm' ? <PalmChart /> : <FaceChart />}
            <ol>{meta.map((m, i) => <li key={m.key}><span style={{ background: m.color }}>{i + 1}</span>{m.title}</li>)}</ol>
          </section>
          <div className="chap"><CharacterBubble who="cheongung">{result.intro}</CharacterBubble></div>
          {result.sections.map((s, i) => (
            <section className="ph-sec" key={s.title}>
              <h3><span className="no" style={{ background: meta[i]?.color }}>{i + 1}</span><span aria-hidden>{meta[i]?.emoji}</span>{s.title}</h3>
              <p>{s.body}</p>
            </section>
          ))}
          <section className="chap closing"><p className="rbody">{result.closing}</p></section>
          {(MOCK_MODE || result.generatedBy === 'sample') && <p className="note pad">시범 단계라 예시 풀이예요. 정식 오픈 때 올려 주신 사진으로 새로 풀어 드려요.</p>}
        </>
      )}
    </>
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

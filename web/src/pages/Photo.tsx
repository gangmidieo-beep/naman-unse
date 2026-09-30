// 손금·관상 (사진으로 보는) — 결제 후 /reading/:orderId 에서: 촬영 가이드 → 사진 이용 동의 → 업로드/촬영 → 분석 중 → 결과 → 사진 삭제 확인.
// 사진은 이 화면 메모리에만 두고, 서버도 메모리에서만 처리(저장·로그 없음). 지금은 예시 결과(photo-sample.json) — AI 비전 호출은 비용 보고 후 연결.
import { useEffect, useState } from 'react';
import sample from '@naman/content/data/photo-sample.json';
import { Button, CharacterBubble } from '../components/ui';
import { MOCK_MODE } from '../lib/api';
import { useApp } from '../store/app';
import type { PhotoProduct } from '../lib/catalog';

type Kind = 'palm' | 'face';
type Result = (typeof sample)['palm'];
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

async function analyze(kind: Kind, image: string): Promise<Result> {
  if (MOCK_MODE) { await new Promise((r) => setTimeout(r, 2400)); return sample[kind]; }
  const res = await fetch(`${__API_ORIGIN__}/photo/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, image }) });
  if (!res.ok) throw new Error('분석에 실패했어요. 잠시 후 다시 시도해 주세요.');
  return res.json();
}

export function PhotoReading({ p, orderId }: { p: PhotoProduct; orderId: string }) {
  const kind = p.id as Kind;
  const { unlocked, unlock } = useApp();
  const doneKey = `photo:${orderId}`;
  const [step, setStep] = useState<'guide' | 'consent' | 'upload' | 'analyzing' | 'result'>(unlocked[doneKey] ? 'result' : 'guide');
  const [agree, setAgree] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<Result | null>(unlocked[doneKey] ? sample[kind] : null);
  useEffect(() => {
    if (step !== 'analyzing' || !image) return;
    analyze(kind, image)
      .then((r) => { setResult(r); setImage(null); unlock(doneKey); setStep('result'); }) // 결과가 나오면 사진은 바로 버린다
      .catch((e) => { setErr((e as Error).message); setStep('upload'); });
  }, [step]);
  const label = kind === 'palm' ? '손바닥' : '얼굴 정면';

  if (step === 'guide')
    return (
      <section className="photo-step">
        <div className={`photo-ex ${kind}`} aria-hidden><span>{kind === 'palm' ? '掌' : '相'}</span></div>
        <h2>{label} 사진 이렇게 찍어 주세요</h2>
        <ul className="tips">{sample.guide[kind].map((t) => <li key={t}>{t}</li>)}</ul>
        <div className="pad mt14"><Button kind="gold" onClick={() => setStep('consent')}>다음</Button></div>
      </section>
    );
  if (step === 'consent')
    return (
      <section className="photo-step">
        <h2>사진 이용 동의</h2>
        <ul className="tips">{sample.consent.map((t) => <li key={t}>{t}</li>)}</ul>
        <label className="agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> 위 내용을 확인했고 동의합니다</label>
        <div className="pad mt14"><Button kind="gold" disabled={!agree} onClick={() => setStep('upload')}>동의하고 사진 올리기</Button></div>
      </section>
    );
  if (step === 'upload')
    return (
      <section className="photo-step">
        <h2>{label} 사진을 올려 주세요</h2>
        {image ? <img className="photo-prev" src={image} alt="올린 사진 미리보기" /> : <div className={`photo-ex ${kind}`} aria-hidden><span>+</span></div>}
        {err && <p className="err">{err}</p>}
        <div className="pad mt14 btn-col">
          <label className="btn line file">
            {image ? '다른 사진 고르기' : '사진 찍기 · 앨범에서 고르기'}
            <input type="file" accept="image/*" capture={kind === 'face' ? 'user' : 'environment'} onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setErr(''); setImage(await readFile(f)); } }} />
          </label>
          <Button kind="gold" disabled={!image} onClick={() => setStep('analyzing')}>풀이 시작하기</Button>
        </div>
      </section>
    );
  if (step === 'analyzing')
    return (
      <section className="photo-step analyzing" aria-live="polite">
        <div className="scan" aria-hidden><span>{kind === 'palm' ? '掌' : '相'}</span><i /></div>
        <h2>천궁도사가 {kind === 'palm' ? '손금' : '관상'}을 살피고 있소…</h2>
        <p className="muted center">잠시만 기다려 주세요</p>
      </section>
    );
  return (
    <>
      <p className="photo-deleted">✓ 올려 주신 사진은 풀이 직후 삭제되었어요</p>
      {result && (
        <>
          <div className="chap"><CharacterBubble who="cheongung">{result.intro}</CharacterBubble></div>
          {result.sections.map((s, i) => (
            <section className="chap" key={s.title}>
              <small>第 {i + 1} 章</small>
              <h2>{s.title}</h2>
              <p className="rbody">{s.body}</p>
            </section>
          ))}
          <section className="chap closing"><p className="rbody">{result.closing}</p></section>
          {MOCK_MODE && <p className="note pad">시안 단계라 예시 풀이예요. 정식 오픈 때 올려 주신 사진으로 새로 풀어 드려요.</p>}
        </>
      )}
    </>
  );
}

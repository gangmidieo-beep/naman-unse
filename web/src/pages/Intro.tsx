// 첫 실행 소개 3장 → 바로 홈(대표님 요청 2026-10-12: 사이트 들어갈 때 사주 입력 받지 않기).
// 1.2초마다 다음 장으로 자동으로 넘어가고, 마지막 장도 1.2초 뒤 홈으로 들어간다. 손으로 넘기거나 누르면 자동 넘김은 멈춤(그땐 "시작하기").
// 사주 정보는 홈에서 "오늘의 운세 자세히 보기"·유료 풀이를 처음 볼 때 한 번만 받는다.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Img } from '../components/Img';
import { Button } from '../components/ui';
import { useApp } from '../store/app';
import type { ImgKey } from '../assets/images';

const AUTO_MS = 1200; // 자동 넘김 간격(1~1.5초 사이 요청)
const SLIDES: { img: ImgKey | null; who: string; title: string; text: string }[] = [
  { img: 'cheongungBanner', who: '天宮道士 · 천궁도사', title: '오늘의 운세부터\n평생의 흐름까지 읽어드리지요', text: '정통사주·재물·직장·신년운세를 깊이 풀어 드리오.' },
  { img: 'wolhaBanner', who: '月下仙女 · 월하선녀', title: '사랑과 인연의 실을\n따라가 볼게요', text: '연애·결혼·궁합·인연의 흐름을 다정하게 살펴 드려요.' },
  { img: null, who: '나만의 운세', title: '지금 바로\n나만의 운세를 시작해요', text: '로그인·입력 없이 둘러보고, 매일 아침 운세를 받아 보세요.' },
];

export default function Intro() {
  const nav = useNavigate();
  const setIntroSeen = useApp((s) => s.setIntroSeen);
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const target = useRef<number | null>(null); // 버튼으로 넘기는 중엔 스크롤 중간값 무시
  const [auto, setAuto] = useState(true);
  const go = (n: number) => { target.current = n; setI(n); track.current?.scrollTo({ left: n * track.current.clientWidth, behavior: 'smooth' }); };
  const onScroll = (el: HTMLDivElement) => {
    const n = Math.round(el.scrollLeft / el.clientWidth);
    if (target.current != null) { if (n === target.current) target.current = null; return; }
    setI(n);
  };
  const start = () => { setIntroSeen(); nav('/', { replace: true }); };
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => (i >= SLIDES.length - 1 ? start() : go(i + 1)), AUTO_MS);
    return () => clearTimeout(t);
  }, [auto, i]);
  return (
    <main className="intro" onPointerDown={() => setAuto(false)} onKeyDown={() => setAuto(false)}>
      <div className="intro-track" ref={track} onScroll={(e) => onScroll(e.currentTarget)}>
        {SLIDES.map((s, n) => (
          <section className="intro-slide" key={n} aria-label={`${n + 1}번째 소개`}>
            <div className="intro-art"><div className="in">
              {s.img ? <Img k={s.img} eager={n === 0} alt={s.who} /> : <div className="intro-seal"><span className="seal">運</span><b>나만의 운세</b></div>}
            </div></div>
            <small>{s.who}</small>
            <h1>{s.title.split('\n').map((l, k) => <span key={k}>{l}<br /></span>)}</h1>
            <p>{s.text}</p>
          </section>
        ))}
      </div>
      <div className="intro-dots" role="tablist" aria-label="소개 넘기기">
        {SLIDES.map((_, n) => <button key={n} role="tab" aria-selected={i === n} aria-label={`${n + 1}번째`} className={i === n ? 'on' : ''} onClick={() => go(n)} />)}
      </div>
      <div className="intro-cta">
        {i < SLIDES.length - 1 ? (
          <>
            <Button kind="ink" onClick={() => go(i + 1)}>다음</Button>
            <button className="textlink" onClick={start}>건너뛰기</button>
          </>
        ) : (
          <Button kind="gold" onClick={start}>시작하기</Button>
        )}
      </div>
    </main>
  );
}

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Img } from '../components/Img';
import { Button } from '../components/ui';
import { useApp } from '../store/app';
import type { ImgKey } from '../assets/images';

const SLIDES: { img: ImgKey | null; who: string; title: string; text: string }[] = [
  { img: 'sunnyeoBanner', who: '월하선녀', title: '매일 아침\n오늘의 운세를 챙겨드려요', text: '총운부터 재물·애정·직장·건강까지, 매일 무료로 보세요.' },
  { img: 'dosaBanner', who: '천궁도령', title: '정통 사주로\n평생 흐름을 풀어드리지요', text: '타고난 그릇과 앞으로의 흐름을 깊이 읽어 드리오.' },
  { img: null, who: '나만의 운세', title: '로그인 없이\n바로 시작해요', text: '생년월일만 넣으면 나만의 운세로 바뀌어요.' },
];

export default function Intro() {
  const nav = useNavigate();
  const setIntroSeen = useApp((s) => s.setIntroSeen);
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const go = (n: number) => track.current?.scrollTo({ left: n * track.current.clientWidth, behavior: 'smooth' });
  const start = () => { setIntroSeen(); nav('/', { replace: true }); };
  return (
    <main className="intro">
      <div className="intro-track" ref={track} onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {SLIDES.map((s, n) => (
          <section className="intro-slide" key={n} aria-label={`${n + 1}번째 소개`}>
            <div className="intro-art">
              {s.img ? <Img k={s.img} eager={n === 0} alt={s.who} /> : (
                <div className="intro-seal"><span className="seal">運</span><b>나만의 운세</b></div>
              )}
            </div>
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
            <Button onClick={() => go(i + 1)}>다음</Button>
            <button className="textlink" onClick={start}>건너뛰기</button>
          </>
        ) : (
          <Button onClick={start}>시작하기</Button>
        )}
      </div>
    </main>
  );
}

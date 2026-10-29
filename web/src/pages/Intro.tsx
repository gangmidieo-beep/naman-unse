// 첫 방문 인트로 영상 (대표님 요청 2026-10-15) — 보름달 밤, 1인칭으로 신당에 들어가는 6초 영상 →
// 금빛이 번지며 한지색 화면에 '나만의 운세' 로고 → 홈. 처음 방문할 때 한 번만(introSeen), 무음, 건너뛰기 버튼.
// 영상이 늦게 뜨거나(LOAD_LIMIT_MS 안에 재생 시작 못 함) 자동 재생이 막히면 기다리지 않고 바로 홈으로.
// 데이터 절약 모드·'동작 줄이기' 설정이면 영상 없이 로고만 잠깐 보여 주고 홈으로.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/app';

const VIDEO = '/intro/intro3.mp4'; // H.264 — 휴대폰·사파리·크롬
const VIDEO_WEBM = '/intro/intro3.webm'; // VP9 — H.264 를 못 트는 브라우저용
const POSTER = '/intro/intro3_poster.webp';
const LOGO = '/intro/intro_logo.webp';
const LOAD_LIMIT_MS = 2500; // 이 안에 재생이 시작되지 않으면 홈으로
const LOGO_BEFORE_END = 0.9; // 영상 끝나기 몇 초 전부터 금빛·로고를 띄울지
const LOGO_HOLD_MS = 1300; // 로고를 보여 주는 시간

const lowData = () => {
  try {
    const c = (navigator as any).connection;
    return !!c?.saveData || /(^|-)2g$/.test(c?.effectiveType ?? '') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
};

export default function Intro() {
  const nav = useNavigate();
  const setIntroSeen = useApp((s) => s.setIntroSeen);
  const video = useRef<HTMLVideoElement>(null);
  const [noVideo] = useState(lowData);
  const [phase, setPhase] = useState<'video' | 'logo' | 'out'>(noVideo ? 'logo' : 'video');
  const [skip, setSkip] = useState(false);
  const done = useRef(false);

  const home = () => {
    if (done.current) return;
    done.current = true;
    setIntroSeen();
    setPhase('out');
    setTimeout(() => nav('/', { replace: true }), 350);
  };

  // 영상: 시간 안에 재생이 안 되면 홈으로, 끝나기 직전 로고로
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let started = false;
    const limit = setTimeout(() => { if (!started) home(); }, LOAD_LIMIT_MS);
    const onPlay = () => { started = true; };
    const toLogo = () => setPhase((p) => (p === 'video' ? 'logo' : p));
    const onTime = () => { if (v.duration && v.currentTime >= v.duration - LOGO_BEFORE_END) toLogo(); };
    v.addEventListener('playing', onPlay);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', toLogo);
    v.addEventListener('error', home);
    v.play()?.catch(home); // 자동 재생이 막힌 기기(절전 모드 등)
    const s = setTimeout(() => setSkip(true), 600);
    return () => { clearTimeout(limit); clearTimeout(s); v.removeEventListener('playing', onPlay); v.removeEventListener('timeupdate', onTime); v.removeEventListener('ended', toLogo); v.removeEventListener('error', home); };
  }, []);

  // 로고: 잠깐 보여 주고 홈으로
  useEffect(() => {
    if (phase !== 'logo') return;
    const t = setTimeout(home, LOGO_HOLD_MS);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <main className={`intro-v phase-${phase}`} aria-label="나만의 운세 인트로">
      <div className="iv-bg" style={{ backgroundImage: `url(${POSTER})` }} aria-hidden />
      {!noVideo && (
        <video ref={video} className="iv-video" poster={POSTER} muted playsInline autoPlay preload="auto" disablePictureInPicture aria-hidden>
          <source src={VIDEO} type='video/mp4; codecs="avc1.640028"' />
          <source src={VIDEO_WEBM} type='video/webm; codecs="vp9"' onError={home} />
        </video>
      )}
      <div className="iv-light" aria-hidden />
      <div className="iv-logo"><img src={LOGO} alt="나만의 운세" /></div>
      {skip && phase === 'video' && <button className="iv-skip" onClick={home}>건너뛰기 ›</button>}
    </main>
  );
}

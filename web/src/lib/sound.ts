// 타로 테이블 효과음 — 파일 없이 브라우저 소리 합성(WebAudio)으로 직접 만든 소리(저작권 걱정 없음).
// 섞기(카드 넘기는 소리), 카드 고르기(톡), 뒤집기(스윽 + 맑은 종소리), 마지막 종합(화음). 음소거는 이 기기에 기억.
const KEY = 'naman-sound-off';
let ctx: AudioContext | null = null;
export const soundOff = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export const setSoundOff = (off: boolean) => { try { localStorage.setItem(KEY, off ? '1' : '0'); } catch { /* 저장 불가 */ } };
function ac() {
  if (soundOff() || typeof window === 'undefined') return null;
  const C = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!C) return null;
  ctx ??= new C();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function noise(c: AudioContext, at: number, dur: number, freq: number, gain: number, q = 1.2) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}
function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at); o.stop(at + dur + 0.05);
}
export const sfx = {
  shuffle() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 18; i++) noise(c, t + i * 0.055 + Math.random() * 0.015, 0.05, 2600 + Math.random() * 1400, 0.22, 2.2);
    for (let i = 0; i < 2; i++) noise(c, t + 1.0 + i * 0.12, 0.09, 900, 0.25, 0.8);
  },
  pick() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.07, 1800, 0.18, 1.5);
    tone(c, t + 0.01, 523, 0.18, 0.05, 'triangle');
  },
  place() {
    const c = ac(); if (!c) return;
    noise(c, c.currentTime, 0.08, 600, 0.22, 0.7);
  },
  flip() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.22, 3200, 0.16, 0.9);
    tone(c, t + 0.18, 1318.5, 1.1, 0.06);
    tone(c, t + 0.18, 1975.5, 0.8, 0.025);
  },
  finale() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, t + i * 0.14, f, 1.8 - i * 0.2, 0.05));
  },
};

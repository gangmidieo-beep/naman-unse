// 타로 테이블 소리 — 파일 없이 브라우저 소리 합성(WebAudio)으로 직접 만든 소리(저작권 걱정 없음).
// 효과음: 섞기(리플 셔플 두 번 + 브리지), 펼치기(테이블 위로 카드가 차르륵 미끄러짐), 고르기(톡 + 작은 종), 내려놓기,
//         뒤집기(스윽 + 맑은 종 / 역방향은 낮은 종), 마지막 종합(화음).
// 배경음악: 타로집 분위기의 잔잔한 앰비언트 — 낮은 드론 화음이 천천히 숨 쉬고, 가끔 맑은 종이 울림. 사용자가 카드를 섞을 때 시작, 테이블을 떠나면 서서히 꺼짐.
// 효과음·배경음악은 따로 끄고 켤 수 있고, 이 기기에 기억한다.
const KEY = 'naman-sound-off';
const MKEY = 'naman-music-off';
let ctx: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;

const read = (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const write = (k: string, off: boolean) => { try { localStorage.setItem(k, off ? '1' : '0'); } catch { /* 저장 불가 */ } };
export const soundOff = () => read(KEY);
export const setSoundOff = (off: boolean) => write(KEY, off);
export const musicOff = () => read(MKEY);
export const setMusicOff = (off: boolean) => { write(MKEY, off); if (off) music.stop(0.6); else music.start(); };

function base() {
  if (typeof window === 'undefined') return null;
  const C = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!C) return null;
  if (!ctx) {
    ctx = new C();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    const master = ctx.createGain(); master.gain.value = 2.2; // 휴대폰 스피커에서도 들리게 전체 음량 보정
    comp.connect(master).connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 2.4; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(comp);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
function ac() { return soundOff() ? null : base(); }

function noise(c: AudioContext, at: number, dur: number, freq: number, gain: number, q = 1.2, out: AudioNode = sfxBus!) {
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
  src.connect(f).connect(g).connect(out);
  src.start(at);
}
function tone(c: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', out: AudioNode = sfxBus!) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at); o.stop(at + dur + 0.05);
}
// 맑은 종(싱잉볼 느낌) — 기본음 + 배음 두 개
function bell(c: AudioContext, at: number, freq: number, dur: number, gain: number, out: AudioNode = sfxBus!) {
  tone(c, at, freq, dur, gain, 'sine', out);
  tone(c, at, freq * 2.76, dur * 0.55, gain * 0.35, 'sine', out);
  tone(c, at, freq * 5.4, dur * 0.25, gain * 0.12, 'sine', out);
}

export const sfx = {
  // 리플 셔플: 카드 두 묶음이 차르르 섞이는 소리 두 번 + 가운데로 모으는 브리지 + 탁탁 정리
  shuffle() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    for (const start of [0, 0.62]) {
      for (let i = 0; i < 20; i++) noise(c, t + start + i * 0.021 + Math.random() * 0.008, 0.035, 2400 + Math.random() * 1800, 0.2, 2.4);
      noise(c, t + start + 0.45, 0.12, 1400, 0.16, 0.9); // 브리지(카드가 휘며 떨어짐)
    }
    noise(c, t + 1.2, 0.07, 700, 0.26, 0.8); // 탁
    noise(c, t + 1.33, 0.07, 650, 0.22, 0.8); // 탁
  },
  // 펼치기: 22장이 테이블 위로 차르륵 미끄러지는 소리(화면 애니메이션 28ms 간격에 맞춤) + 끝에 은은한 종
  spread(count = 22) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < count; i++) noise(c, t + i * 0.028, 0.06, 1700 + i * 30, 0.1, 1.6);
    noise(c, t, count * 0.028 + 0.2, 500, 0.05, 0.5); // 천 위로 쓸리는 낮은 소리
    bell(c, t + count * 0.028 + 0.1, 880, 1.4, 0.03);
  },
  pick() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.07, 1800, 0.18, 1.5);
    tone(c, t + 0.01, 523.25 * (1 + Math.floor(Math.random() * 3) * 0.125), 0.25, 0.05, 'triangle');
  },
  place() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.09, 600, 0.22, 0.7);
    noise(c, t + 0.12, 0.3, 2200, 0.06, 0.6); // 쓱 — 자리로 옮겨 놓음
  },
  flip(reversed = false) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.22, 3200, 0.16, 0.9);
    if (reversed) { bell(c, t + 0.18, 659.25, 1.3, 0.055); bell(c, t + 0.3, 783.99, 1.0, 0.03); } // 낮고 차분한 종
    else { bell(c, t + 0.18, 1318.5, 1.2, 0.055); tone(c, t + 0.18, 1975.5, 0.8, 0.022); }
  },
  finale() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(c, t + i * 0.14, f, 2.0 - i * 0.2, 0.045));
  },

  /* ---- 부적 의식 ---- */
  // 향 피우기: 성냥 긋는 소리(치익) + 불 붙는 소리 + 낮은 징
  incense() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.18, 3800, 0.2, 0.8);
    noise(c, t + 0.15, 0.5, 900, 0.08, 0.5);
    bell(c, t + 0.5, 196, 3.2, 0.06);
    bell(c, t + 0.5, 293.66, 2.6, 0.025);
  },
  // 붓질: 한지 위를 붓이 사각사각 지나가는 소리(dur 초 동안 획 여러 개)
  brush(dur = 3) {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    let at = 0;
    while (at < dur) {
      const len = 0.25 + Math.random() * 0.35;
      noise(c, t + at, len, 2600 + Math.random() * 1600, 0.09, 0.7);
      noise(c, t + at, len * 0.6, 1100, 0.04, 0.6);
      at += len + 0.06 + Math.random() * 0.1;
    }
  },
  // 이름·소원 새기기: 작은 종 세 번
  write() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [880, 1046.5, 1318.5].forEach((f, i) => bell(c, t + i * 0.32, f, 1.1, 0.03));
  },
  // 인장 찍기: 쿵(나무 인장) + 종이 눌리는 소리 + 낮은 북 울림
  stamp() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    noise(c, t, 0.12, 220, 0.5, 0.7);
    tone(c, t, 70, 0.6, 0.22, 'sine');
    noise(c, t + 0.02, 0.15, 1500, 0.12, 0.8);
    bell(c, t + 0.25, 146.83, 2.6, 0.05);
  },
  // 기운 봉인: 금빛 화음이 솟아오름
  bless() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [392, 493.88, 587.33, 783.99, 987.77, 1174.66].forEach((f, i) => bell(c, t + i * 0.12, f, 2.6 - i * 0.2, 0.04));
    noise(c, t, 1.6, 5200, 0.03, 0.4); // 반짝이는 공기
  },
};

// 배경음악 — 앰비언트 드론(라 단조 계열 화음 4개가 천천히 바뀜) + 가끔 맑은 종 + 아주 옅은 바람 소리
let users = 0;
let nodes: { stop: (at: number) => void }[] = [];
let timers: number[] = [];
const CHORDS = [[110, 164.81, 220, 261.63], [87.31, 130.81, 174.61, 220], [98, 146.83, 196, 246.94], [82.41, 123.47, 164.81, 207.65]];
const BELLS = [440, 523.25, 587.33, 659.25, 783.99, 880];

function pad(c: AudioContext, out: AudioNode) {
  const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700; filter.Q.value = 0.5;
  const lfo = c.createOscillator(); const lfoGain = c.createGain();
  lfo.frequency.value = 0.07; lfoGain.gain.value = 280; lfo.connect(lfoGain).connect(filter.frequency); lfo.start();
  const voice = c.createGain(); voice.gain.value = 0.5; filter.connect(voice).connect(out);
  const oscs = [0, 1, 2, 3].map((i) => {
    const o = c.createOscillator(); o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = CHORDS[0][i]; o.detune.value = (i - 1.5) * 4;
    const g = c.createGain(); g.gain.value = i % 2 ? 0.05 : 0.025; o.connect(g).connect(filter); o.start(); return o;
  });
  let k = 0;
  const step = () => {
    k = (k + 1) % CHORDS.length;
    const at = c.currentTime;
    oscs.forEach((o, i) => o.frequency.setTargetAtTime(CHORDS[k][i], at, 1.8));
  };
  timers.push(window.setInterval(step, 9000));
  // 아주 옅은 바람(촛불 켜진 방의 공기감)
  const len = c.sampleRate * 4; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const air = c.createBufferSource(); air.buffer = buf; air.loop = true;
  const af = c.createBiquadFilter(); af.type = 'bandpass'; af.frequency.value = 420; af.Q.value = 0.4;
  const ag = c.createGain(); ag.gain.value = 0.012; air.connect(af).connect(ag).connect(out); air.start();
  nodes.push({ stop: (at) => { oscs.forEach((o) => o.stop(at)); lfo.stop(at); air.stop(at); } });
}
function chimes(c: AudioContext, out: AudioNode) {
  const ring = () => {
    if (!musicBus || users === 0) return;
    const f = BELLS[Math.floor(Math.random() * BELLS.length)];
    bell(c, c.currentTime, f, 3.2, 0.022, out);
    if (Math.random() < 0.35) bell(c, c.currentTime + 0.5, f * 1.5, 2.6, 0.012, out);
    timers.push(window.setTimeout(ring, 3500 + Math.random() * 4500));
  };
  timers.push(window.setTimeout(ring, 1800));
}

export const music = {
  // 테이블이 화면에 있는 동안 켜 둔다(사용자 손짓 이후에만 소리가 나므로 카드 섞기 때 시작)
  acquire() { users++; },
  release() { users = Math.max(0, users - 1); if (users === 0) music.stop(2.5); },
  start() {
    if (musicOff() || users === 0) return;
    const c = base(); if (!c || !musicBus) return;
    if (nodes.length) return; // 이미 재생 중
    pad(c, musicBus); chimes(c, musicBus);
    const at = c.currentTime;
    musicBus.gain.cancelScheduledValues(at);
    musicBus.gain.setValueAtTime(musicBus.gain.value, at);
    musicBus.gain.linearRampToValueAtTime(1.1, at + 3);
  },
  stop(fade = 1.5) {
    if (!ctx || !musicBus || !nodes.length) return;
    const at = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(at);
    musicBus.gain.setValueAtTime(musicBus.gain.value, at);
    musicBus.gain.linearRampToValueAtTime(0, at + fade);
    const old = nodes; nodes = [];
    old.forEach((n) => n.stop(at + fade + 0.1));
    timers.forEach((id) => { clearInterval(id); clearTimeout(id); }); timers = [];
  },
  playing: () => nodes.length > 0,
};

// 화면을 내리거나 다른 앱으로 가면 배경음악을 멈춘다
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (users > 0 || nodes.length) void ctx.resume();
  });
}

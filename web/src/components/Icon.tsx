// 단색 선 아이콘(직접 그린 SVG) — 이미지가 들어오면(06 단계) incoming 아이콘이 우선, 없으면 이 아이콘.
import { INCOMING } from '../assets/incoming';

export type IconName = 'today' | 'zodiac' | 'week' | 'mbti' | 'wealth' | 'love' | 'work' | 'health' | 'home' | 'chat' | 'user';

const P: Record<IconName, JSX.Element> = {
  today: (
    <>
      <circle cx="24" cy="22" r="8" />
      <path d="M24 6v4M24 34v4M8 22h4M36 22h4M12.7 10.7l2.8 2.8M32.5 30.5l2.8 2.8M12.7 33.3l2.8-2.8M32.5 13.5l2.8-2.8" />
      <path d="M10 42h28" />
    </>
  ),
  zodiac: (
    <>
      <circle cx="24" cy="24" r="16" />
      <circle cx="24" cy="24" r="6" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return <circle key={i} cx={24 + 11 * Math.cos(a)} cy={24 + 11 * Math.sin(a)} r="1.6" fill="currentColor" stroke="none" />;
      })}
    </>
  ),
  week: (
    <>
      <rect x="8" y="11" width="32" height="29" rx="4" />
      <path d="M8 19h32M16 7v8M32 7v8" />
      {[14, 19, 24, 29, 34].map((x) => <circle key={x} cx={x} cy="27" r="1.6" fill="currentColor" stroke="none" />)}
      <circle cx="16.5" cy="33" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="21.5" cy="33" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  mbti: (
    <>
      <circle cx="24" cy="24" r="16" />
      <path d="M24 10l4 14-4 14-4-14z" />
      <path d="M10 24h28" strokeDasharray="2 3" />
    </>
  ),
  wealth: (
    <>
      <path d="M17 14c-1-3 2-6 7-6s8 3 7 6" />
      <path d="M17 14h14l5 10c3 7-2 16-12 16s-15-9-12-16z" />
      <path d="M20 27h8M24 23v10" />
    </>
  ),
  love: <path d="M24 39s-14-8.5-14-18a7.5 7.5 0 0 1 14-3.6A7.5 7.5 0 0 1 38 21c0 9.5-14 18-14 18z" />,
  work: (
    <>
      <path d="M34 8l6 6-18 18-7 1 1-7z" />
      <path d="M29 13l6 6" />
      <path d="M8 40h20" />
    </>
  ),
  health: (
    <>
      <path d="M10 22h24v4a12 12 0 0 1-24 0z" />
      <path d="M34 24h3a4 4 0 0 1 0 8h-5" />
      <path d="M17 16c0-3 3-3 3-6M24 16c0-3 3-3 3-6" />
      <path d="M12 42h20" />
    </>
  ),
  home: (
    <>
      <path d="M8 22L24 8l16 14" />
      <path d="M12 19v20h24V19" />
      <path d="M20 39V28h8v11" />
    </>
  ),
  chat: (
    <>
      <path d="M8 12h32v20H22l-8 7v-7H8z" />
      <path d="M16 22h.01M24 22h.01M32 22h.01" strokeWidth="4" />
    </>
  ),
  user: (
    <>
      <circle cx="24" cy="17" r="8" />
      <path d="M9 41c1-8 7-12 15-12s14 4 15 12" />
    </>
  ),
};

const COLOR: Partial<Record<IconName, string>> = {
  today: '#C98A1E', zodiac: '#2C3766', week: '#4B3A7C', mbti: '#3E7D5A',
  wealth: '#9E7420', love: '#C2577A', work: '#2C3766', health: '#3E7D5A',
};

export function Icon({ name, size = 44, mono }: { name: IconName; size?: number; mono?: boolean }) {
  const inc = INCOMING[`icon_${name}` as keyof typeof INCOMING];
  if (inc && !mono) return <img src={inc.src} width={size} height={size} alt="" loading="lazy" style={{ width: size, height: size }} />;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: mono ? 'currentColor' : COLOR[name] ?? 'currentColor' }} aria-hidden>
      {P[name]}
    </svg>
  );
}

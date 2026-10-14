// 무료 운세 그림 — 대표님 3차 시안(GPT 그림)에서 잘라 쓴 그림(web/public/img/fun, scripts/fun-art-from-mockup.py)
import type { CSSProperties } from 'react';

export const funImg = (name: string) => `/img/fun/${name}.webp`;

// 별자리 그림·별자리 선: 투명 마스크라 색을 CSS 로 입힌다(밝은 칸 = 금갈색, 먹색 칸 = 밝은 금색)
export function StarArt({ id, kind = 'star', size = 56, className = '' }: { id: string; kind?: 'star' | 'starc'; size?: number; className?: string }) {
  const url = `url(${funImg(`${kind}_${id}`)})`;
  const st: CSSProperties = { width: size, height: kind === 'star' ? size * (80 / 116) : size * (80 / 68), WebkitMaskImage: url, maskImage: url };
  return <i className={`starart ${kind} ${className}`} style={st} aria-hidden />;
}

// 혈액형 물방울(한자 血 대신)
export function BloodDrop({ type, size = 44, ring = false }: { type: string; size?: number; ring?: boolean }) {
  const fs = type.length > 1 ? 15 : 19;
  return (
    <svg className={`bdrop${ring ? ' ring' : ''}`} width={size} height={size * 1.18} viewBox="0 0 44 52" aria-hidden>
      <defs>
        <radialGradient id={`bd-${type}`} cx="38%" cy="58%" r="70%">
          <stop offset="0" stopColor="#D2483B" />
          <stop offset=".6" stopColor="#A8291E" />
          <stop offset="1" stopColor="#6E140E" />
        </radialGradient>
      </defs>
      <path d="M22 2C22 2 5 22 5 33a17 17 0 0 0 34 0C39 22 22 2 22 2Z" fill={`url(#bd-${type})`} stroke="#E6C877" strokeOpacity={ring ? 0.9 : 0} strokeWidth="1.4" />
      <ellipse cx="14.5" cy="30" rx="3" ry="6" fill="#fff" opacity=".22" transform="rotate(18 14.5 30)" />
      <text x="22" y="40" textAnchor="middle" fontFamily="'Noto Serif KR', serif" fontWeight="900" fontSize={fs} fill="#FBF3E2">{type}</text>
    </svg>
  );
}

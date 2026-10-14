// 띠별 운세 — 띠 지지와 오늘 일진 지지의 관계 + 출생 연도 천간(오행)으로 문장을 고른다. 30일 주기로 다른 문장이 돈다(날짜 시드).
import { dailyPillar, branchRelations, kstParts, STEM_ELEMENT } from '@naman/engine';
import db from '../data/zodiac.json';
import fun2 from '../data/fun2.json';
import { hash } from './today/engine';

export const ZODIAC_KEYS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'sheep', 'monkey', 'rooster', 'dog', 'pig'] as const;
export const ZODIAC_NAMES = ['쥐', '소', '범', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
export const ZODIAC_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const EL_KEY = ['wood', 'fire', 'earth', 'metal', 'water'] as const;
type Rel = keyof typeof db.relation;
const STARS: Record<Rel, number> = { combine: 5, same: 4, neutral: 3, friction: 3, clash: 2 };

export function relationCategory(a: number, b: number): Rel {
  if (a === b) return 'same';
  const r = branchRelations(a, b);
  if (r.includes('clash')) return 'clash';
  if (r.includes('combine') || r.includes('halfCombine')) return 'combine';
  if (r.includes('punish') || r.includes('break') || r.includes('harm')) return 'friction';
  return 'neutral';
}
// 40~60대가 많이 찾는 해 포함: 1946~2005 사이 그 띠의 해
export const yearsOf = (branch: number) => Array.from({ length: 60 }, (_, i) => 1946 + i).filter((y) => (((y - 4) % 12) + 12) % 12 === branch);

const Z2 = fun2.zodiac as unknown as {
  hero: Record<string, string[]>; heroSub: Record<string, string[]>; keywords: Record<string, string[][]>;
  flow: Record<string, string[]>; care: Record<string, string[]>; act: Record<string, string[]>; point: Record<string, { icon: string; kw: string }[]>;
};
const LUCKY = fun2.lucky as unknown as { color: Record<string, string[]>; number: Record<string, number[]>; direction: Record<string, string>; time: Record<string, string> };
// 오늘의 행운(색·숫자·방향·시간) — 날짜·키 시드로 오행 하나를 골라 그 오행의 색·숫자·방향
export function luckyOf(seed: string) {
  const el = EL_KEY[hash(`${seed}:lucky`) % 5];
  const nums = LUCKY.number[el];
  return { el, color: LUCKY.color[el][hash(`${seed}:lc`) % 3], number: nums[hash(`${seed}:ln`) % nums.length], direction: LUCKY.direction[el], time: LUCKY.time[el] };
}

export function zodiacToday(branch: number, date: Date) {
  const k = kstParts(date);
  const cycle = (k.year * 372 + k.month * 31 + k.day) % 30; // 30일 순환
  const day = dailyPillar(date);
  const rel = relationCategory(branch, day.branch);
  const pool = db.relation[rel];
  const line = pool[hash(`z${branch}:${cycle}`) % pool.length];
  const years = yearsOf(branch).map((y) => {
    const el = EL_KEY[STEM_ELEMENT[(((y - 4) % 10) + 10) % 10]];
    const tips = db.yearTip[el];
    const sd = `${y}:${cycle}:${rel}`;
    const P = (a: string[], t: string) => a[hash(`${sd}:${t}`) % a.length];
    // 3차 요청: 한 줄 → 2~3줄(① 오늘의 흐름 ② 주의할 점·기회 ③ 간단한 행동 조언)
    return {
      year: y, age: k.year - y, line: tips[hash(`${y}:${cycle}`) % tips.length],
      flow: P(Z2.flow[el], 'f'), care: P(Z2.care[el], 'c'), act: P(Z2.act[el], 'a'), point: Z2.point[el][hash(`${sd}:p`) % Z2.point[el].length],
    };
  });
  const zs = `z${branch}:${cycle}`;
  return {
    key: ZODIAC_KEYS[branch], name: ZODIAC_NAMES[branch], hanja: ZODIAC_HANJA[branch], dayPillar: day, rel, stars: STARS[rel], line, years,
    head: Z2.hero[rel][hash(`${zs}:h`) % Z2.hero[rel].length], sub: Z2.heroSub[rel][hash(`${zs}:s`) % Z2.heroSub[rel].length],
    keywords: Z2.keywords[rel][hash(`${zs}:k`) % Z2.keywords[rel].length], lucky: luckyOf(`${k.year}${k.month}${k.day}:${zs}`),
  };
}

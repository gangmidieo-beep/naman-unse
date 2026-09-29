// 띠별 운세 — 띠 지지와 오늘 일진 지지의 관계 + 출생 연도 천간(오행)으로 문장을 고른다. 30일 주기로 다른 문장이 돈다(날짜 시드).
import { dailyPillar, branchRelations, kstParts, STEM_ELEMENT } from '@naman/engine';
import db from '../data/zodiac.json';
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
    return { year: y, line: tips[hash(`${y}:${cycle}`) % tips.length] };
  });
  return { key: ZODIAC_KEYS[branch], name: ZODIAC_NAMES[branch], hanja: ZODIAC_HANJA[branch], dayPillar: day, rel, stars: STARS[rel], line, years };
}

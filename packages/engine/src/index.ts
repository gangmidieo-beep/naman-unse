// 나만의 운세 만세력 엔진 공개 API. 계산 로직은 src/core(원본 그대로)에 있고, 여기서는 입력 정리·음력 변환·추가 관계만 한다.
import { computePillars, dayPillarIndex } from './core/pillars.mjs';
import { sipsinChart, sipsinOfStem, sipsinOfBranch } from './core/sipsin.mjs';
import { elementRatio } from './core/elements.mjs';
import { computeDaeun } from './core/daeun.mjs';
import { todayPillar } from './core/today.mjs';
import { jeolgiOfYear } from './core/solar-terms.mjs';
import {
  STEMS, STEMS_HANJA, BRANCHES, BRANCHES_HANJA, ELEMENTS, STEM_ELEMENT, STEM_POLARITY, BRANCH_ELEMENT, MONTH_STEM_BASE,
  pillarText, pillarHanja,
} from './core/tables.mjs';
import { lunarToSolar, solarToLunar, leapMonthOf, LUNAR_YEAR_MIN, LUNAR_YEAR_MAX, type LunarDate } from './lunar.ts';
import { twelveStage, branchRelations, stemCombines, stemClashes, TWELVE_STAGES, type BranchRelation } from './relations.ts';

export { lunarToSolar, solarToLunar, leapMonthOf, LUNAR_YEAR_MIN, LUNAR_YEAR_MAX, twelveStage, branchRelations, TWELVE_STAGES };
export { STEMS, STEMS_HANJA, BRANCHES, BRANCHES_HANJA, ELEMENTS, STEM_ELEMENT, BRANCH_ELEMENT, sipsinOfStem, sipsinOfBranch };
export type { LunarDate, BranchRelation };
export const ENGINE_VERSION = '1.0.0';

export type Pillar = { text: string; hanja: string; stem: number; branch: number };
export type SajuInput = {
  year: number; month: number; day: number; hour?: number | null; minute?: number;
  calendar: 'solar' | 'lunar'; leapMonth?: boolean; gender: 'M' | 'F'; timeUnknown?: boolean;
};
export const ZODIAC_ANIMALS = ['쥐', '소', '범', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
const ELEMENT_KEYS = ['wood', 'fire', 'earth', 'metal', 'water'] as const;
export type ElementKey = (typeof ELEMENT_KEYS)[number];

const mkPillar = (stem: number, branch: number): Pillar => ({ text: pillarText(stem, branch), hanja: pillarHanja(stem, branch), stem, branch });

export function calcSaju(input: SajuInput, { now = new Date() } = {}) {
  const timeUnknown = !!input.timeUnknown || input.hour == null;
  const solar = input.calendar === 'lunar'
    ? lunarToSolar(input.year, input.month, input.day, !!input.leapMonth)
    : { year: input.year, month: input.month, day: input.day };
  const p = computePillars({ ...solar, hour: timeUnknown ? null : input.hour, minute: timeUnknown ? 0 : input.minute ?? 0 });
  const dayStem = p.day.stem;
  const er = elementRatio(p);
  const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 } as Record<ElementKey, number>;
  ELEMENTS.forEach((e: string, i: number) => (counts[ELEMENT_KEYS[i]] = er.weights[e]));
  const daeun = computeDaeun(p, input.gender === 'M' ? 'male' : 'female');
  const { currentAt, ...daeunPlain } = daeun as any;
  const stages = Object.fromEntries(
    (['year', 'month', 'day', 'hour'] as const).map((k) => [k, p[k] ? twelveStage(dayStem, p[k].branch) : null]),
  );
  return {
    engineVersion: ENGINE_VERSION,
    solarDate: solar,
    lunarDate: solarToLunar(solar.year, solar.month, solar.day),
    gender: input.gender,
    timeUnknown,
    pillars: { year: p.year as Pillar, month: p.month as Pillar, day: p.day as Pillar, hour: (p.hour as Pillar) ?? null },
    sajuYear: p.sajuYear as number,
    jeolgi: p.jeolgi,
    dayMaster: {
      stem: dayStem, char: STEMS[dayStem], hanja: STEMS_HANJA[dayStem], element: ELEMENTS[STEM_ELEMENT[dayStem]] as string,
      polarity: STEM_POLARITY[dayStem] === 1 ? '양' : '음',
    },
    elements: counts,
    elementRatio: er,
    tenGods: sipsinChart(p),
    twelveStages: stages,
    daewoon: { ...daeunPlain, current: daeun.available ? currentAt(now) : null },
    zodiacAnimal: ZODIAC_ANIMALS[p.year.branch],
  };
}
export type SajuResult = ReturnType<typeof calcSaju>;

// 날짜(KST 기준 연·월·일)의 일진
export function dailyPillar(date: Date | { year: number; month: number; day: number }): Pillar {
  if (date instanceof Date) {
    const t = todayPillar(date);
    return mkPillar(t.stem, t.branch);
  }
  const i = dayPillarIndex(date.year, date.month, date.day);
  return mkPillar(i % 10, i % 12);
}
export function weeklyPillars(start: Date): { date: string; pillar: Pillar }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * 86400000);
    return { date: kstDateString(d), pillar: dailyPillar(d) };
  });
}
// 월건 — 절입 기준 월주. 해당 날짜 정오(KST)로 판정.
export function monthlyPillar(date: Date): Pillar {
  const { year, month, day } = kstParts(date);
  const p = computePillars({ year, month, day, hour: 12, minute: 0 });
  return p.month as Pillar;
}
export function yearPillarOf(date: Date): Pillar {
  const { year, month, day } = kstParts(date);
  return computePillars({ year, month, day, hour: 12, minute: 0 }).year as Pillar;
}

export function relation(saju: SajuResult, target: Pillar) {
  const d = saju.dayMaster.stem;
  const natal = Object.entries(saju.pillars).filter(([, v]) => v) as [string, Pillar][];
  const clashes: string[] = [], combines: string[] = [], punishments: string[] = [], breaks: string[] = [], harms: string[] = [];
  for (const [k, v] of natal) {
    const rel = branchRelations(v.branch, target.branch);
    if (rel.includes('clash')) clashes.push(k);
    if (rel.includes('combine') || rel.includes('halfCombine')) combines.push(k);
    if (rel.includes('punish')) punishments.push(k);
    if (rel.includes('break')) breaks.push(k);
    if (rel.includes('harm')) harms.push(k);
  }
  return {
    tenGod: sipsinOfStem(d, target.stem) as string,
    branchTenGod: sipsinOfBranch(d, target.branch) as string,
    twelveStage: twelveStage(d, target.branch),
    stemCombine: stemCombines(d, target.stem),
    stemClash: stemClashes(d, target.stem),
    clashes, combines, punishments, breaks, harms,
    targetElement: ELEMENTS[STEM_ELEMENT[target.stem]] as string,
  };
}

// 띠: 양력 연도 기준 단순 띠(입춘 구분 없음 — 띠별 운세 목록용)
export const zodiacOf = (year: number) => ({ branch: (((year - 4) % 12) + 12) % 12, animal: ZODIAC_ANIMALS[(((year - 4) % 12) + 12) % 12] });
export const lunarOf = (date: Date) => { const k = kstParts(date); return solarToLunar(k.year, k.month, k.day); };

export function kstParts(date: Date) {
  const t = new Date(date.getTime() + 9 * 3600000);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}
export const kstDateString = (date: Date) => {
  const { year, month, day } = kstParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
export { jeolgiOfYear, MONTH_STEM_BASE };

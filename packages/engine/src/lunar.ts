// 양력 ↔ 음력 변환 — data/lunar.json(1900~2049) 만 쓴다. 날짜 계산은 UTC 0시 기준 일수.
import table from '../data/lunar.json';

export type LunarDate = { year: number; month: number; day: number; leap: boolean };
export type SolarDate = { year: number; month: number; day: number };
type Row = { y: number; ny: number[]; leap: number; months: string };

const rows = table.years as Row[];
const DAY = 86400000;
const toDays = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY;
const fromDays = (n: number): SolarDate => {
  const t = new Date(n * DAY);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
};
// 한 해의 달 목록 [{month, leap, days}] — 윤달은 해당 달 바로 뒤
const monthsOf = (r: Row) => {
  const out: { month: number; leap: boolean; days: number }[] = [];
  let i = 0;
  for (let m = 1; m <= 12; m++) {
    out.push({ month: m, leap: false, days: 29 + Number(r.months[i++]) });
    if (r.leap === m) out.push({ month: m, leap: true, days: 29 + Number(r.months[i++]) });
  }
  return out;
};

export const LUNAR_YEAR_MIN = rows[0].y;
export const LUNAR_YEAR_MAX = rows[rows.length - 1].y;
export const leapMonthOf = (year: number): number | null => rows.find((r) => r.y === year)?.leap || null;

export function lunarToSolar(year: number, month: number, day: number, leap = false): SolarDate {
  const r = rows.find((x) => x.y === year);
  if (!r) throw new RangeError(`음력 ${year}년은 지원 범위(${LUNAR_YEAR_MIN}~${LUNAR_YEAR_MAX}) 밖이에요`);
  let n = toDays(r.ny[0], r.ny[1], r.ny[2]);
  for (const m of monthsOf(r)) {
    if (m.month === month && m.leap === leap) {
      if (day < 1 || day > m.days) throw new RangeError(`음력 ${year}년 ${leap ? '윤' : ''}${month}월은 ${m.days}일까지 있어요`);
      return fromDays(n + day - 1);
    }
    n += m.days;
  }
  throw new RangeError(leap ? `${year}년에는 윤${month}월이 없어요` : `음력 ${month}월을 찾을 수 없어요`);
}

export function solarToLunar(year: number, month: number, day: number): LunarDate {
  const n = toDays(year, month, day);
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    let start = toDays(r.ny[0], r.ny[1], r.ny[2]);
    if (start > n) continue;
    for (const m of monthsOf(r)) {
      if (n < start + m.days) return { year: r.y, month: m.month, day: n - start + 1, leap: m.leap };
      start += m.days;
    }
    break;
  }
  throw new RangeError(`양력 ${year}-${month}-${day} 는 음력 변환 범위 밖이에요`);
}

// 음력 달의 날수(29|30). 없는 달이면 RangeError
export function lunarMonthDays(year: number, month: number, leap = false): number {
  const r = rows.find((x) => x.y === year);
  if (!r) throw new RangeError(`음력 ${year}년은 지원 범위 밖이에요`);
  const m = monthsOf(r).find((x) => x.month === month && x.leap === leap);
  if (!m) throw new RangeError(`${year}년에는 ${leap ? '윤' : ''}${month}월이 없어요`);
  return m.days;
}

import { describe, it, expect } from 'vitest';
import { tojeong, ganjiNum, lunarMonthDays, lunarToSolar, dailyPillar } from '../src/index.ts';

describe('토정비결 괘', () => {
  it('간지 수', () => {
    expect(ganjiNum(0, 0)).toBe(18); // 갑자 9+9
    expect(ganjiNum(3, 7)).toBe(14); // 정미 6+8 (2027)
  });
  it('144괘 범위와 수식', () => {
    const seen = new Set<number>();
    for (let y = 1940; y <= 2000; y += 3)
      for (let m = 1; m <= 12; m++)
        for (const d of [1, 15, 29, 30]) {
          const r = tojeong({ lunarYear: y, lunarMonth: m, lunarDay: d, targetYear: 2027 });
          expect(r.upper).toBeGreaterThanOrEqual(1); expect(r.upper).toBeLessThanOrEqual(8);
          expect(r.middle).toBeGreaterThanOrEqual(1); expect(r.middle).toBeLessThanOrEqual(6);
          expect(r.lower).toBeGreaterThanOrEqual(1); expect(r.lower).toBeLessThanOrEqual(3);
          seen.add(r.number);
        }
    expect(seen.size).toBeGreaterThan(100);
  });
  it('예시 인물(음력 1968-02-17) 2027년 — 손계산과 일치', () => {
    const r = tojeong({ lunarYear: 1968, lunarMonth: 2, lunarDay: 17, targetYear: 2027 });
    const days = lunarMonthDays(2027, 2, false);
    const s = lunarToSolar(2027, 2, 17);
    const p = dailyPillar(s);
    const upper = ((60 + 14) % 8) || 8; // 세는나이 60, 정미 14
    const middle = ((days + ganjiNum(9, 3)) % 6) || 6; // 정미년 2월 월건 = 계묘(癸卯): 계5 + 묘6 = 11
    expect(r.age).toBe(60);
    expect(r.taese).toBe(14);
    expect(r.upper).toBe(upper);
    expect(r.days).toBe(days);
    expect(r.lower).toBe(((17 + ganjiNum(p.stem, p.branch)) % 3) || 3);
    expect(r.wolgeon).toBe(11);
    expect(r.middle).toBe(middle);
  });
  it('30일생인데 그해 생월이 29일까지면 29일로', () => {
    let found = false;
    for (let m = 1; m <= 12 && !found; m++) if (lunarMonthDays(2027, m) === 29) {
      const r = tojeong({ lunarYear: 1970, lunarMonth: m, lunarDay: 30, targetYear: 2027 });
      expect(r.birthdayInTarget).toEqual(lunarToSolar(2027, m, 29));
      found = true;
    }
    expect(found).toBe(true);
  });
  it('윤달생은 그해 평달 기준, 연말(12월) 출생도 계산', () => {
    expect(() => tojeong({ lunarYear: 2020, lunarMonth: 4, lunarDay: 15, targetYear: 2027 })).not.toThrow();
    const r = tojeong({ lunarYear: 1972, lunarMonth: 12, lunarDay: 29, targetYear: 2027 });
    expect(r.birthdayInTarget.year).toBe(2028); // 음력 2027-12 는 양력 2028년 초
  });
});

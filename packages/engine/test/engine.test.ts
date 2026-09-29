import { describe, it, expect } from 'vitest';
import { solarToLunar as pkgSolarToLunar } from '@fullstackfamily/manseryeok';
import {
  calcSaju, lunarToSolar, solarToLunar, leapMonthOf, twelveStage, branchRelations, relation, dailyPillar, weeklyPillars,
  monthlyPillar, zodiacOf, lunarOf,
} from '../src/index.ts';

describe('음력 변환', () => {
  it('양력→음력: 1900~2049 전 구간 패키지와 일치(표본 매 7일)', () => {
    let n = 0;
    for (let t = Date.UTC(1900, 1, 1); t < Date.UTC(2049, 11, 1); t += 7 * 86400000) {
      const d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
      let p;
      try { p = pkgSolarToLunar(y, m, day).lunar; } catch { continue; } // 패키지 데이터 빈 날(1956-12-31) 건너뜀
      const o = solarToLunar(y, m, day);
      expect([o.year, o.month, o.day, o.leap], `${y}-${m}-${day}`).toEqual([p.year, p.month, p.day, p.isLeapMonth]);
      n++;
    }
    expect(n).toBeGreaterThan(7000);
  });
  it('음력→양력 왕복 + 11·12월·윤달', () => {
    expect(lunarToSolar(1972, 12, 29)).toEqual({ year: 1973, month: 2, day: 2 });
    expect(lunarToSolar(2020, 4, 15, true)).toEqual({ year: 2020, month: 6, day: 6 });
    expect(lunarToSolar(2024, 1, 1)).toEqual({ year: 2024, month: 2, day: 10 });
    const s = lunarToSolar(1968, 11, 20);
    expect(solarToLunar(s.year, s.month, s.day)).toEqual({ year: 1968, month: 11, day: 20, leap: false });
    expect(leapMonthOf(2023)).toBe(2);
    expect(leapMonthOf(2024)).toBe(null);
    expect(() => lunarToSolar(2024, 4, 1, true)).toThrow();
    expect(() => lunarToSolar(1970, 1, 31)).toThrow();
  });
});

describe('12운성·합충', () => {
  it('12운성 대표값', () => {
    expect(twelveStage(0, 11)).toBe('장생'); // 갑-해
    expect(twelveStage(0, 3)).toBe('제왕'); // 갑-묘
    expect(twelveStage(1, 6)).toBe('장생'); // 을-오
    expect(twelveStage(1, 3)).toBe('건록'); // 을-묘
    expect(twelveStage(6, 8)).toBe('건록'); // 경-신
    expect(twelveStage(9, 0)).toBe('건록'); // 계-자
  });
  it('지지 관계', () => {
    expect(branchRelations(0, 6)).toContain('clash'); // 자오충
    expect(branchRelations(0, 1)).toContain('combine'); // 자축합
    expect(branchRelations(8, 0)).toContain('halfCombine'); // 신자
    expect(branchRelations(2, 5)).toEqual(expect.arrayContaining(['punish', 'harm'])); // 인사 형·해
    expect(branchRelations(6, 6)).toContain('punish'); // 오오 자형
    expect(branchRelations(0, 3)).toContain('punish'); // 자묘 형
  });
});

describe('공개 API', () => {
  const me = calcSaju({ year: 1968, month: 3, day: 15, hour: 7, calendar: 'solar', gender: 'M' });
  it('calcSaju 형태', () => {
    expect(me.pillars.hour?.hanja).toBe('戊辰');
    expect(me.zodiacAnimal).toBe('원숭이');
    expect(Object.values(me.elements).reduce((a, b) => a + b, 0)).toBe(8);
    expect(me.twelveStages.day).toBeTruthy();
    expect(me.lunarDate.year).toBe(1968);
  });
  it('시간 모름', () => {
    const u = calcSaju({ year: 1968, month: 3, day: 15, calendar: 'solar', gender: 'M', timeUnknown: true, hour: 7 });
    expect(u.pillars.hour).toBe(null);
    expect(u.timeUnknown).toBe(true);
    expect(u.twelveStages.hour).toBe(null);
    expect(Object.values(u.elements).reduce((a, b) => a + b, 0)).toBe(6);
  });
  it('일진·주간·월건·띠·음력', () => {
    expect(dailyPillar({ year: 2026, month: 9, day: 27 }).text).toBe('갑진');
    expect(dailyPillar(new Date('2026-09-29T03:00:00Z')).text).toBe('병오');
    expect(weeklyPillars(new Date('2026-09-27T03:00:00Z')).map((x) => x.pillar.text).slice(0, 3)).toEqual(['갑진', '을사', '병오']);
    expect(monthlyPillar(new Date('2026-09-29T03:00:00Z')).text).toBe('정유');
    expect(zodiacOf(1968).animal).toBe('원숭이');
    expect(lunarOf(new Date('2026-09-29T03:00:00Z'))).toMatchObject({ year: 2026, month: 8 });
  });
  it('relation', () => {
    const r = relation(me, dailyPillar({ year: 2026, month: 9, day: 29 }));
    expect(r.tenGod).toBe('식신'); // 갑 일간 - 병
    expect(Array.isArray(r.clashes)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { calcSaju } from '@naman/engine';
import { todayFortune, weekFortune, monthFortune, FIELDS, CORE_FIELDS, bandOf, zodiacToday, yearsOf, relationCategory } from '../src/index';
import rules from '../data/today/rules.json';

const me = calcSaju({ year: 1968, month: 3, day: 15, hour: 7, calendar: 'solar', gender: 'M' });
const unknown = calcSaju({ year: 1968, month: 3, day: 15, calendar: 'solar', gender: 'M', timeUnknown: true });
const D = new Date('2026-09-29T03:00:00Z');

describe('오늘의 운세 계산', () => {
  it('같은 입력 → 같은 출력', () => {
    expect(todayFortune(me, D, 'p1')).toEqual(todayFortune(me, D, 'p1'));
  });
  it('사람이 다르면(시드) 문장이 달라질 수 있다', () => {
    const a = todayFortune(me, D, 'p1'), b = todayFortune(me, D, 'p2');
    expect(a.dayPillar).toEqual(b.dayPillar);
  });
  it('점수 범위 55~96, 별 1~5, 분야 4개 모두 문장', () => {
    const people = [me, unknown, calcSaju({ year: 1990, month: 5, day: 15, hour: 14, calendar: 'solar', gender: 'F' }), calcSaju({ year: 1955, month: 7, day: 7, calendar: 'lunar', gender: 'F' })];
    const totals = new Set<number>();
    for (const p of people)
      for (let i = 0; i < 120; i++) {
        const f = todayFortune(p, new Date(D.getTime() + i * 86400000), 'x');
        expect(f.total).toBeGreaterThanOrEqual(rules.totalRange.min);
        expect(f.total).toBeLessThanOrEqual(rules.totalRange.max);
        totals.add(f.total);
        for (const k of FIELDS) {
          expect(f.fields[k].stars).toBeGreaterThanOrEqual(1);
          expect(f.fields[k].stars).toBeLessThanOrEqual(5);
          expect(f.fields[k].summary.length).toBeGreaterThan(3);
          const n = CORE_FIELDS.includes(k as any) ? 3 : 2;
          expect(f.fields[k].detail).toHaveLength(n);
          expect(new Set(f.fields[k].detail).size).toBe(n);
        }
        expect(f.oneLine.length).toBeGreaterThan(5);
        expect(f.brief.length).toBeGreaterThan(10);
        expect(f.word.length).toBeGreaterThan(5);
        expect(f.headline.length).toBeGreaterThan(3);
      }
    expect(totals.size).toBeGreaterThan(15); // 날마다 골고루 달라진다
  });
  it('6항목(일·금전·연애·건강·학업·시험)', () => {
    expect(Object.keys(todayFortune(me, D, 'p1').fields)).toEqual(['work', 'wealth', 'love', 'health', 'study', 'exam']);
  });
  it('재물·직장은 도사 문단도 있다', () => {
    const f = todayFortune(me, D, 'p1');
    expect(f.fields.wealth.detailCheongung).toHaveLength(3);
    expect(f.fields.love.detailCheongung).toBeNull();
  });
  it('시간 모름도 계산된다', () => {
    const f = todayFortune(unknown, D, 'p1');
    expect(f.timeUnknown).toBe(true);
    expect(f.total).toBeGreaterThan(0);
  });
  it('행운 = 부족한 오행 (홍길동: 화·수 없음 → 화)', () => {
    const f = todayFortune(me, D, 'p1');
    expect(f.lucky.element).toBe('화');
    expect(f.lucky.direction).toBe('남쪽');
    expect([2, 7]).toContain(f.lucky.number);
  });
  it('점수대', () => {
    expect(bandOf(55)).toBe('1');
    expect(bandOf(80)).toBe('4');
    expect(bandOf(96)).toBe('5');
  });
  it('이번 주·이번 달', () => {
    const w = weekFortune(me, D, 'p1');
    expect(w.days).toHaveLength(7);
    expect(w.start).toBe('20260928'); // 월요일
    expect(w.line.length).toBeGreaterThan(5);
    const m = monthFortune(me, D, 'p1');
    expect(m.pillar.text).toBe('정유');
    expect(Object.keys(m.fields)).toHaveLength(6);
  });
});

describe('띠별 운세', () => {
  it('관계 분류', () => {
    expect(relationCategory(0, 6)).toBe('clash');
    expect(relationCategory(0, 1)).toBe('combine');
    expect(relationCategory(3, 3)).toBe('same');
  });
  it('말띠 오늘', () => {
    const z = zodiacToday(6, D);
    expect(z.name).toBe('말');
    expect(z.years.map((y) => y.year)).toEqual([1954, 1966, 1978, 1990, 2002]);
    expect(z.line.length).toBeGreaterThan(5);
  });
  it('모든 띠에 1956~1990 출생 연도 포함', () => {
    for (let b = 0; b < 12; b++) expect(yearsOf(b).some((y) => y >= 1956 && y <= 1990)).toBe(true);
  });
});

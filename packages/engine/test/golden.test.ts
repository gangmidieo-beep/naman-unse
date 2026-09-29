// 골든 테스트 — 기대값은 원본 엔진을 그대로 돌려 얻은 스냅샷(scripts/gen-golden.mjs). 1건이라도 다르면 이식 실수.
import { describe, it, expect } from 'vitest';
import golden from './golden.json';
import { calcSaju } from '../src/index.ts';

const NOW = new Date('2026-09-29T00:00:00Z');
describe('골든 사주 (원본 엔진 스냅샷)', () => {
  it('30건 이상', () => expect(golden.length).toBeGreaterThanOrEqual(30));
  for (const g of golden) {
    it(g.label, () => {
      const r = calcSaju(g.input as any, { now: NOW });
      const e = g.expect;
      expect(r.solarDate).toEqual(e.solar);
      expect([r.pillars.year.text, r.pillars.month.text, r.pillars.day.text, r.pillars.hour?.text ?? null]).toEqual(e.pillars);
      expect(r.dayMaster.char + r.dayMaster.element).toBe(e.dayMaster);
      expect(r.elementRatio.ratio).toEqual(e.ratio);
      expect(r.tenGods.rows.map((x: any) => `${x.pillar}:${x.stem.sipsin}/${x.branch.sipsin}`)).toEqual(e.sipsin);
      expect(r.daewoon.startAge).toBe(e.daeun.startAge);
      expect(r.daewoon.direction).toBe(e.daeun.direction);
      expect(r.daewoon.cycles.map((c: any) => c.text)).toEqual(e.daeun.cycles);
      expect(r.daewoon.current?.text ?? null).toBe(e.daeun.current);
      expect(r.timeUnknown).toBe(g.input.hour == null);
    });
  }
});

// 골든 기대값 생성 — reference 원본 엔진(읽기 전용)을 그대로 돌려 test/golden.json 에 고정한다.
// 음력은 패키지 solarToLunar 를 역으로 찾아 양력으로 바꾼 뒤 계산(패키지 lunarToSolar 는 음력 11·12월을 처리 못 함 — docs/reference분석.md).
// reference/ 가 없는 PC(양도 후)에서는 이 스크립트를 돌릴 필요 없다 — golden.json 이 이미 커밋돼 있다.
import { solarToLunar } from '@fullstackfamily/manseryeok';
const lunarToSolar = (y, m, d, leap) => {
  for (let t = Date.UTC(y, 0, 1); t < Date.UTC(y + 1, 3, 1); t += 86400000) {
    const x = new Date(t), s = { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() };
    let l; try { l = solarToLunar(s.year, s.month, s.day).lunar; } catch { continue; }
    if (l.year === y && l.month === m && l.day === d && l.isLeapMonth === leap) return { solar: s };
  }
  throw new Error('no lunar date ' + [y, m, d, leap]);
};
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// 사용법: node scripts/gen-golden.mjs <원본 엔진 폴더(index.mjs 가 있는 곳)>
const refDir = process.argv[2] ? resolve(process.argv[2]) : (() => { throw new Error('원본 엔진 폴더 경로를 인자로 주세요'); })();
const { computeChart } = await import(pathToFileURL(resolve(refDir, 'index.mjs')).href);
const NOW = new Date('2026-09-29T00:00:00Z');
// [설명, y, m, d, hour|null, minute, calendar('solar'|'lunar'|'leap'), gender]
const CASES = [
  ['입춘 전날 2024-02-03', 2024, 2, 3, 12, 0, 'solar', 'M'],
  ['입춘 당일 절입 전 2024-02-04 12시', 2024, 2, 4, 12, 0, 'solar', 'F'],
  ['입춘 당일 절입 후 2024-02-04 18시', 2024, 2, 4, 18, 0, 'solar', 'M'],
  ['입춘 다음날 2024-02-05', 2024, 2, 5, 12, 0, 'solar', 'F'],
  ['2025 입춘(23:10) 1시간 전', 2025, 2, 3, 22, 10, 'solar', 'M'],
  ['2025 입춘(23:10) 1시간 후', 2025, 2, 4, 0, 10, 'solar', 'F'],
  ['2023 입춘(11:43) 1시간 전', 2023, 2, 4, 10, 43, 'solar', 'M'],
  ['2023 입춘(11:43) 1시간 후', 2023, 2, 4, 12, 43, 'solar', 'F'],
  ['2020 소한 전날 밤 자시', 2020, 1, 5, 23, 30, 'solar', 'M'],
  ['2020 소한 당일 오전', 2020, 1, 6, 8, 0, 'solar', 'F'],
  ['음력 윤달 2020 윤4월 15일', 2020, 4, 15, 9, 0, 'leap', 'F'],
  ['음력 윤달 1987 윤6월 10일', 1987, 6, 10, 15, 0, 'leap', 'M'],
  ['음력 윤달 2023 윤2월 20일', 2023, 2, 20, 6, 0, 'leap', 'F'],
  ['자시 23:30 (같은 날 일주)', 1990, 5, 15, 23, 30, 'solar', 'M'],
  ['자시 00:30', 1990, 5, 16, 0, 30, 'solar', 'F'],
  ['자시 23:00 정각', 1975, 8, 20, 23, 0, 'solar', 'M'],
  ['2000-01-01 00:00', 2000, 1, 1, 0, 0, 'solar', 'F'],
  ['1901년', 1901, 3, 10, 8, 0, 'solar', 'M'],
  ['1910년', 1910, 11, 11, 14, 0, 'solar', 'F'],
  ['1920년 인시', 1920, 6, 1, 3, 30, 'solar', 'M'],
  ['2001년', 2001, 9, 11, 10, 0, 'solar', 'F'],
  ['2010년', 2010, 10, 10, 20, 0, 'solar', 'M'],
  ['2024 성탄', 2024, 12, 25, 16, 0, 'solar', 'F'],
  ['시간 모름 양력', 1968, 3, 15, null, 0, 'solar', 'M'],
  ['시간 모름 음력', 1955, 7, 7, null, 0, 'lunar', 'F'],
  ['서머타임 시행 1949', 1949, 7, 1, 10, 0, 'solar', 'M'],
  ['서머타임 시행 1957', 1957, 6, 15, 13, 0, 'solar', 'F'],
  ['서머타임 시행 1987', 1987, 8, 1, 9, 0, 'solar', 'M'],
  ['예시 인물 홍길동', 1968, 3, 15, 7, 0, 'solar', 'M'],
  ['1956 음력', 1956, 11, 3, 5, 0, 'lunar', 'F'],
  ['1964 양력', 1964, 7, 7, 11, 0, 'solar', 'M'],
  ['1976 음력', 1976, 1, 1, 13, 0, 'lunar', 'F'],
  ['1988 양력', 1988, 9, 17, 19, 0, 'solar', 'M'],
  ['1972 음력 12월 29일(그믐)', 1972, 12, 29, 21, 0, 'lunar', 'F'],
  ['1990 기준 사주', 1990, 5, 15, 14, 0, 'solar', 'M'],
  ['2026-09-29 오늘', 2026, 9, 29, 12, 0, 'solar', 'F'],
];
const out = CASES.map(([label, y, m, d, hour, minute, cal, gender]) => {
  let s = { year: y, month: m, day: d };
  if (cal !== 'solar') s = lunarToSolar(y, m, d, cal === 'leap').solar;
  const c = computeChart({ ...s, hour, minute }, gender === 'M' ? 'male' : 'female', { now: NOW });
  return {
    label,
    input: { year: y, month: m, day: d, hour, minute, calendar: cal === 'solar' ? 'solar' : 'lunar', leapMonth: cal === 'leap', gender, timeUnknown: hour == null },
    expect: {
      solar: s,
      pillars: [c.pillars.year.text, c.pillars.month.text, c.pillars.day.text, c.pillars.hour ? c.pillars.hour.text : null],
      dayMaster: c.dayMaster.name,
      ratio: c.elements.ratio,
      sipsin: c.sipsin.rows.map((r) => `${r.pillar}:${r.stem.sipsin}/${r.branch.sipsin}`),
      daeun: { startAge: c.daeun.startAge, direction: c.daeun.direction, cycles: c.daeun.cycles.map((x) => x.text), current: c.daeun.current?.text ?? null },
    },
  };
});
writeFileSync(new URL('../test/golden.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('golden cases', out.length);

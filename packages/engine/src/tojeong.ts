// 토정비결 괘(卦) 산출 — 144괘 중 하나를 계산만 한다(풀이 문장 없음, 원문 인용 없음).
// 규칙(통용 방식):
//   상괘 = (세는나이 + 그해 태세수) % 8   (0 이면 8)
//   중괘 = (그해 음력 생월의 날수 + 그해 생월의 월건수) % 6   (0 이면 6)
//   하괘 = (음력 생일 + 그해 생일의 일진수) % 3   (0 이면 3)
//   괘 번호 = 상·중·하를 이어 붙인 세 자리(111 ~ 863)
// 간지 수(선천수): 천간 甲己9 乙庚8 丙辛7 丁壬6 戊癸5 / 지지 子午9 丑未8 寅申7 卯酉6 辰戌5 巳亥4
// 생일은 음력 기준. 윤달생은 그해 평달로 본다. 그해 생월이 29일까지인데 30일생이면 29일로 본다.
import { lunarToSolar, lunarMonthDays } from './lunar.ts';
import { dayPillarIndex } from './core/pillars.mjs';
import { MONTH_STEM_BASE } from './core/tables.mjs';

const STEM_NUM = [9, 8, 7, 6, 5, 9, 8, 7, 6, 5];
const BRANCH_NUM = [9, 8, 7, 6, 5, 4, 9, 8, 7, 6, 5, 4];
export const ganjiNum = (stem: number, branch: number) => STEM_NUM[stem] + BRANCH_NUM[branch];
const mod = (n: number, m: number) => { const r = n % m; return r === 0 ? m : r; };

export type TojeongInput = { lunarYear: number; lunarMonth: number; lunarDay: number; targetYear: number };
export function tojeong({ lunarYear, lunarMonth, lunarDay, targetYear }: TojeongInput) {
  const age = targetYear - lunarYear + 1; // 세는나이
  const yi = (((targetYear - 1984) % 60) + 60) % 60; // 1984 갑자
  const yStem = yi % 10, yBranch = yi % 12;
  const taese = ganjiNum(yStem, yBranch);
  const days = lunarMonthDays(targetYear, lunarMonth, false);
  const mStem = ((MONTH_STEM_BASE as number[])[yStem] + (lunarMonth - 1)) % 10;
  const mBranch = (lunarMonth + 1) % 12; // 음력 1월 = 寅
  const wolgeon = ganjiNum(mStem, mBranch);
  const d = Math.min(lunarDay, days);
  const solar = lunarToSolar(targetYear, lunarMonth, d, false);
  const di = (dayPillarIndex as (y: number, m: number, d: number) => number)(solar.year, solar.month, solar.day);
  const iljin = ganjiNum(di % 10, di % 12);
  const upper = mod(age + taese, 8);
  const middle = mod(days + wolgeon, 6);
  const lower = mod(d + iljin, 3);
  return { upper, middle, lower, number: upper * 100 + middle * 10 + lower, age, taese, days, wolgeon, iljin, birthdayInTarget: solar };
}

import { lunarOf, yearPillarOf, kstParts } from '@naman/engine';

export const lunarPill = (d = new Date()) => { const l = lunarOf(d); return `${l.leap ? '윤' : ''}${l.month}.${l.day}`; };
// 신년운세 대상 해: 10월 이후면 다음 해
export function newYearTarget(d = new Date()) {
  const { year, month } = kstParts(d);
  const y = month >= 10 ? year + 1 : year;
  return { year: y, pillar: yearPillarOf(new Date(Date.UTC(y, 5, 1))) };
}
export const koDate = (d = new Date()) => { const k = kstParts(d); return `${k.year}년 ${k.month}월 ${k.day}일`; };

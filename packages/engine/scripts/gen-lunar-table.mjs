// 음력 표 추출 — MIT 라이선스 @fullstackfamily/manseryeok 1.0.8 의 solarToLunar 로 1900~2050 양력 날짜를 하루씩 돌며
// 각 음력 달의 시작일(양력)을 모은다. 달 길이 = 다음 달 시작일 − 이번 달 시작일. 결과는 data/lunar.json 으로 고정(런타임 의존 0).
// 주의: 패키지 lunarToSolar 는 음력 11·12월(양력 이듬해로 넘어가는 달)을 모두 오류로 처리한다 → 쓰지 않는다.
// 주의: 패키지 데이터에 1956-12-31 하루가 빠져 있다 → 시작일 방식이라 영향 없음(음력 1956-11-30 으로 복원됨).
import { solarToLunar } from '@fullstackfamily/manseryeok';
import { writeFileSync } from 'node:fs';

const DAY = 86400000;
const starts = []; // {y, m, leap, t}
for (let t = Date.UTC(1900, 0, 31); t <= Date.UTC(2050, 11, 31); t += DAY) {
  const d = new Date(t);
  let l;
  try { l = solarToLunar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()).lunar; } catch { continue; }
  const s = t - (l.day - 1) * DAY, last = starts.at(-1);
  if (!last || last.t !== s) starts.push({ y: l.year, m: l.month, leap: l.isLeapMonth, t: s });
}
const years = new Map();
for (let i = 0; i < starts.length - 1; i++) {
  const x = starts[i], n = Math.round((starts[i + 1].t - x.t) / DAY);
  if (n !== 29 && n !== 30) throw new Error(`이상한 달 길이 ${x.y}-${x.m} ${n}`);
  if (!years.has(x.y)) { const d = new Date(x.t); years.set(x.y, { y: x.y, ny: [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()], leap: 0, list: [] }); }
  const r = years.get(x.y);
  if (x.leap) r.leap = x.m;
  r.list.push(n - 29);
}
const out = [...years.values()].filter((r) => r.list.length === (r.leap ? 13 : 12)).map((r) => ({ y: r.y, ny: r.ny, leap: r.leap, months: r.list.join('') }));
writeFileSync(new URL('../data/lunar.json', import.meta.url), JSON.stringify({ source: '@fullstackfamily/manseryeok 1.0.8 (MIT) solarToLunar', note: 'months: 0=29일 1=30일, 윤달은 해당 달 바로 뒤', years: out }));
console.log('years', out[0].y, '~', out.at(-1).y, out.length);

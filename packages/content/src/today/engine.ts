// 오늘의 운세 계산 — AI 호출 없음. 엔진 계산값 + rules.json 점수 규칙 + 문구 DB 조합.
// 같은 사람·같은 날짜는 항상 같은 결과(시드 = yyyymmdd + profileId).
import {
  calcSaju, dailyPillar, monthlyPillar, relation, branchRelations, kstParts, lunarOf, ELEMENTS, STEM_ELEMENT,
  type SajuResult, type Pillar,
} from '@naman/engine';
import rules from '../../data/today/rules.json';
import oneline from '../../data/today/oneline.json';
import fieldsDb from '../../data/today/fields.json';
import adviceDb from '../../data/today/advice.json';
import weekDb from '../../data/today/week.json';
import monthDb from '../../data/today/month.json';
import extraDb from '../../data/today/extra.json';

// 화면 순서: 일 · 금전 · 연애 · 건강 · 학업 · 시험 (대표님 HWP)
export const FIELDS = ['work', 'wealth', 'love', 'health', 'study', 'exam'] as const;
export type Field = (typeof FIELDS)[number];
export const FIELD_LABEL: Record<Field, string> = { work: '일', wealth: '금전', love: '연애', health: '건강', study: '학업', exam: '시험' };
// 심화 문단·조언이 있는 4분야(분야 상세 화면)
export const CORE_FIELDS = ['wealth', 'love', 'work', 'health'] as const;
export type CoreField = (typeof CORE_FIELDS)[number];
const isCore = (f: Field): f is CoreField => (CORE_FIELDS as readonly string[]).includes(f);
type Stars = 1 | 2 | 3 | 4 | 5;
type Band = '1' | '2' | '3' | '4' | '5';

/* ---------- 시드 ---------- */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const rand = (seed: string) => hash(seed) / 4294967296; // 0 이상 1 미만
const pick = <T>(arr: readonly T[], seed: string): T => arr[hash(seed) % arr.length];
// 겹치지 않게 n 개 고르기(시드 고정)
function pickN<T>(arr: readonly T[], n: number, seed: string): T[] {
  const idx = arr.map((_, i) => i).sort((a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`));
  return idx.slice(0, n).map((i) => arr[i]);
}
const ymd = (d: Date) => { const k = kstParts(d); return `${k.year}${String(k.month).padStart(2, '0')}${String(k.day).padStart(2, '0')}`; };

/* ---------- 점수 ---------- */
type Raw = Record<Field, number>;
function rawScores(saju: SajuResult, target: Pillar, seed: string): { raw: Raw; rel: ReturnType<typeof relation> } {
  const rel = relation(saju, target);
  const raw = Object.fromEntries(FIELDS.map((f) => [f, rules.base])) as Raw;
  const add = (w: Partial<Record<Field, number>>, k = 1) => FIELDS.forEach((f) => (raw[f] += (w[f] ?? 0) * k));
  const tg = rules.tenGod as Record<string, Record<Field, number>>;
  add(tg[rel.tenGod]);
  add(tg[rel.branchTenGod], rules.branchTenGodFactor);
  // 일지·연지와 오늘 지지의 합·충·형·파·해
  for (const [pillar, weight] of Object.entries(rules.branch.pillarWeight)) {
    const p = saju.pillars[pillar as 'day' | 'year'];
    if (!p) continue;
    for (const r of branchRelations(p.branch, target.branch)) add((rules.branch as any)[r], weight);
  }
  const st = (rules.twelveStage as Record<string, number>)[rel.twelveStage] ?? 0;
  add(Object.fromEntries(FIELDS.map((f) => [f, st * rules.twelveStageFieldFactor[f]])));
  // 오행 과부족 간이 판단(원본 엔진에 용신 판단 없음): 부족한 기운이 들어오면 +, 넘치는 기운이면 −
  const er = saju.elementRatio;
  const te = rel.targetElement;
  const e = er.missing.includes(te) ? rules.element.missing : te === er.weakest ? rules.element.weakest : te === er.strongest ? rules.element.strongest : 0;
  add(Object.fromEntries(FIELDS.map((f) => [f, e])));
  FIELDS.forEach((f) => (raw[f] += (rand(`${seed}:${f}`) * 2 - 1) * rules.jitter));
  return { raw, rel };
}
const toStars = (x: number) => Math.max(1, Math.min(5, Math.round(x))) as Stars;
function toTotal(raw: Raw, seed: string) {
  const w = rules.totalWeights as Record<Field, number>;
  const avg = FIELDS.reduce((s, f) => s + raw[f] * w[f], 0);
  const { min, max, rawMin, rawMax } = rules.totalRange;
  const k = Math.max(0, Math.min(1, (avg - rawMin) / (rawMax - rawMin)));
  const t = Math.round(min + k * (max - min) + (rand(`${seed}:t`) * 4 - 2));
  return Math.max(min, Math.min(max, t));
}
export const bandOf = (total: number): Band => String(1 + rules.bands.filter((b) => total > b).length) as Band;
export const starsOfTotal = (total: number) => toStars(1 + ((total - 55) / 41) * 4);

/* ---------- 행운 ---------- */
function lucky(saju: SajuResult, seed: string) {
  const er = saju.elementRatio;
  const el = (er.missing[0] ?? er.weakest) as keyof typeof rules.lucky;
  const L = rules.lucky[el];
  return { element: el, color: L.color, hex: L.hex, number: pick(L.numbers, `${seed}:n`), direction: L.direction };
}

/* ---------- 오늘 ---------- */
export type ProfileInput = {
  id: string; year: number; month: number; day: number; hour: number | null; calendar: 'solar' | 'lunar'; leap: boolean; gender: 'M' | 'F';
};
export const sajuOf = (p: ProfileInput) =>
  calcSaju({ year: p.year, month: p.month, day: p.day, hour: p.hour, calendar: p.calendar, leapMonth: p.leap, gender: p.gender, timeUnknown: p.hour == null });

export function todayFortune(saju: SajuResult, date: Date, profileId: string) {
  const seed = `${ymd(date)}:${profileId}`;
  const dayPillar = dailyPillar(date);
  const { raw, rel } = rawScores(saju, dayPillar, seed);
  const total = toTotal(raw, seed);
  const band = bandOf(total);
  const fields = Object.fromEntries(
    FIELDS.map((f) => {
      const stars = toStars(raw[f]);
      const s = String(stars) as Band;
      if (!isCore(f)) {
        const ex = extraDb as any;
        return [f, { stars, summary: pick(ex.summary[f][s] as string[], `${seed}:${f}:s`), detail: pickN(ex.detail[f][s] as string[], 2, `${seed}:${f}:d`), detailCheongung: null, advice: null }];
      }
      const detail = pickN((fieldsDb.detail as any)[f][s] as string[], 3, `${seed}:${f}:d`);
      const cheongungPool = (fieldsDb.detailCheongung as any)[f]?.[s] as string[] | undefined;
      const adv = (adviceDb as any)[f];
      return [f, {
        stars,
        summary: pick((fieldsDb.summary as any)[f][s] as string[], `${seed}:${f}:s`),
        detail,
        detailCheongung: cheongungPool ? pickN(cheongungPool, 3, `${seed}:${f}:dd`) : null,
        advice: { do: pick(adv.do as string[], `${seed}:${f}:do`), avoid: pick(adv.avoid as string[], `${seed}:${f}:av`), word: pick(adviceDb.word, `${seed}:${f}:w`) },
      }];
    }),
  ) as Record<Field, { stars: Stars; summary: string; detail: string[]; detailCheongung: string[] | null; advice: { do: string; avoid: string; word: string } | null }>;
  return {
    date: ymd(date),
    total,
    stars: starsOfTotal(total),
    band,
    oneLine: pick((oneline as Record<Band, string[]>)[band], `${seed}:one`),
    headline: pick((extraDb.headline as Record<Band, string[]>)[band], `${seed}:hl`),
    brief: pick((extraDb.brief as Record<Band, string[]>)[band], `${seed}:br`),
    word: pick((extraDb.word as Record<Band, string[]>)[band], `${seed}:wd`),
    fields,
    lucky: lucky(saju, seed),
    dayPillar,
    tenGod: rel.tenGod,
    lunarDate: lunarOf(date),
    timeUnknown: saju.timeUnknown,
  };
}
export type TodayFortune = ReturnType<typeof todayFortune>;

/* ---------- 이번 주 (월~일 일진 평균) ---------- */
export function weekFortune(saju: SajuResult, date: Date, profileId: string) {
  const k = kstParts(date);
  const dow = new Date(Date.UTC(k.year, k.month - 1, k.day)).getUTCDay(); // 0=일
  const monday = new Date(date.getTime() - ((dow + 6) % 7) * 86400000);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 86400000);
    const f = todayFortune(saju, d, profileId);
    return { date: f.date, pillar: f.dayPillar, total: f.total, stars: f.stars };
  });
  const avg = Math.round(days.reduce((s, d) => s + d.total, 0) / 7);
  const best = days.reduce((a, b) => (b.total > a.total ? b : a));
  const band = bandOf(avg);
  return { start: days[0].date, days, total: avg, stars: starsOfTotal(avg), band, line: pick((weekDb as Record<Band, string[]>)[band], `${days[0].date}:${profileId}:w`), best };
}

/* ---------- 이번 달 (월건 기준) ---------- */
export function monthFortune(saju: SajuResult, date: Date, profileId: string) {
  const mp = monthlyPillar(date);
  const k = kstParts(date);
  const seed = `${k.year}${k.month}:${profileId}:m`;
  const { raw } = rawScores(saju, mp, seed);
  const total = toTotal(raw, seed);
  const band = bandOf(total);
  return {
    pillar: mp, total, stars: starsOfTotal(total), band,
    line: pick((monthDb as Record<Band, string[]>)[band], seed),
    fields: Object.fromEntries(FIELDS.map((f) => [f, toStars(raw[f])])) as Record<Field, Stars>,
  };
}

export const elementOfStem = (stem: number) => ELEMENTS[STEM_ELEMENT[stem]] as string;

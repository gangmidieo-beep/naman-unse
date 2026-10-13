// 정통 감정서용 분석 데이터 — 원국 상세(십성·지장간·12운성·신살), 합충, 신강·신약, 억부 용신, 대운·세운·월운 표.
// 계산만 한다(해석 문장은 AI·화면 몫). 신강·신약과 용신은 억부법 기준의 참고값이다.
import { STEMS, STEMS_HANJA, BRANCHES, BRANCHES_HANJA, ELEMENTS, STEM_ELEMENT, BRANCH_ELEMENT } from './core/tables.mjs';
import { sipsinOfStem, sipsinOfBranch } from './core/sipsin.mjs';
import { twelveStage, branchRelations, stemCombines, stemClashes, type BranchRelation } from './relations.ts';
import type { Pillar, SajuResult } from './index.ts';

const REL_KO: Record<BranchRelation, string> = { combine: '육합', halfCombine: '삼합(반합)', clash: '충', punish: '형', break: '파', harm: '해' };
const POS = [['hour', '시주'], ['day', '일주'], ['month', '월주'], ['year', '연주']] as const;
type PosKey = (typeof POS)[number][0];

// 신살 표 (지지 index: 자0 축1 인2 묘3 진4 사5 오6 미7 신8 유9 술10 해11)
const CHEONEUL: number[][] = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [2, 6], [5, 3], [5, 3]]; // 천을귀인(일간)
const MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3]; // 문창귀인(일간)
const YANGIN: Record<number, number> = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 }; // 양인(양간)
const GROUP = (b: number) => [[8, 0, 4], [2, 6, 10], [5, 9, 1], [11, 3, 7]].findIndex((g) => g.includes(b)); // 신자진·인오술·사유축·해묘미
const DOHWA = [9, 3, 6, 0], YEOKMA = [2, 8, 11, 5], HWAGAE = [4, 10, 1, 7];
const GOEGANG = ['경진', '경술', '임진', '임술', '무술'];
const BAEKHO = ['갑진', '을미', '병술', '정축', '무진', '임술', '계축'];

export const ELEMENT_LUCK = [
  { el: '목', color: '초록·청록', dir: '동쪽', num: '3, 8', season: '봄', food: '신맛·푸른 채소', organ: '간·담' },
  { el: '화', color: '빨강·주황', dir: '남쪽', num: '2, 7', season: '여름', food: '쓴맛·붉은 음식', organ: '심장·소장' },
  { el: '토', color: '노랑·황토', dir: '중앙', num: '5, 10', season: '환절기', food: '단맛·곡물', organ: '비장·위' },
  { el: '금', color: '흰색·은색', dir: '서쪽', num: '4, 9', season: '가을', food: '매운맛·흰 음식', organ: '폐·대장' },
  { el: '수', color: '검정·남색', dir: '북쪽', num: '1, 6', season: '겨울', food: '짠맛·검은 음식', organ: '신장·방광' },
];

const relText = (a: number, b: number) => branchRelations(a, b).map((r) => REL_KO[r]);

export function analyzeSaju(s: SajuResult, now = new Date()) {
  const ds = s.dayMaster.stem;
  const dEl = STEM_ELEMENT[ds];
  const P = s.pillars as Record<PosKey, Pillar | null>;
  const yb = P.year!.branch, db = P.day!.branch;

  // 신살: 원국 각 지지에 해당하는 것
  const shinsalOf = (b: number) => {
    const out: string[] = [];
    if (CHEONEUL[ds].includes(b)) out.push('천을귀인');
    if (MUNCHANG[ds] === b) out.push('문창귀인');
    if (YANGIN[ds] === b) out.push('양인');
    for (const base of [yb, db]) {
      const g = GROUP(base);
      if (DOHWA[g] === b && !out.includes('도화살')) out.push('도화살');
      if (YEOKMA[g] === b && !out.includes('역마살')) out.push('역마살');
      if (HWAGAE[g] === b && !out.includes('화개살')) out.push('화개살');
    }
    return out;
  };

  const rows = POS.map(([k, label]) => {
    const p = P[k];
    if (!p) return { key: k, label, empty: true as const };
    const tg = s.tenGods.rows.find((r: any) => r.pillar === label) as any;
    return {
      key: k, label, empty: false as const, text: p.text, hanja: p.hanja,
      stem: { char: STEMS[p.stem], hanja: STEMS_HANJA[p.stem], element: ELEMENTS[STEM_ELEMENT[p.stem]], sipsin: k === 'day' ? '일간(나)' : sipsinOfStem(ds, p.stem) },
      branch: { char: BRANCHES[p.branch], hanja: BRANCHES_HANJA[p.branch], element: ELEMENTS[BRANCH_ELEMENT[p.branch]], sipsin: sipsinOfBranch(ds, p.branch) },
      hidden: (tg?.branch?.hidden ?? []).map((h: any) => `${h.stem}(${h.sipsin})`),
      stage: twelveStage(ds, p.branch),
      shinsal: shinsalOf(p.branch),
    };
  });

  // 원국 안의 합·충·형·파·해
  const present = POS.filter(([k]) => P[k]).map(([k, label]) => ({ k, label, p: P[k]! }));
  const relations: string[] = [];
  for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
    const a = present[i], b = present[j];
    if (stemCombines(a.p.stem, b.p.stem)) relations.push(`${a.label}·${b.label} 천간합(${STEMS[a.p.stem]}${STEMS[b.p.stem]})`);
    if (stemClashes(a.p.stem, b.p.stem)) relations.push(`${a.label}·${b.label} 천간충(${STEMS[a.p.stem]}${STEMS[b.p.stem]})`);
    for (const r of relText(a.p.branch, b.p.branch)) relations.push(`${a.label}·${b.label} 지지 ${r}(${BRANCHES[a.p.branch]}${BRANCHES[b.p.branch]})`);
  }
  const special: string[] = [];
  if (GOEGANG.includes(P.day!.text)) special.push(`괴강(일주 ${P.day!.text})`);
  for (const [, label] of POS) { const p = P[POS.find((x) => x[1] === label)![0]]; if (p && BAEKHO.includes(p.text)) special.push(`백호(${label} ${p.text})`); }

  // 신강·신약(억부): 비겁·인성을 돕는 힘으로, 월지는 3배·일지 1.5배 가중
  const W: Record<string, number> = { 'hour.s': 1, 'month.s': 1, 'year.s': 1, 'hour.b': 1, 'day.b': 1.5, 'month.b': 3, 'year.b': 1 };
  let support = 0, total = 0;
  for (const [key, w] of Object.entries(W)) {
    const [k, part] = key.split('.') as [PosKey, 's' | 'b'];
    const p = P[k];
    if (!p) continue;
    const el = part === 's' ? STEM_ELEMENT[p.stem] : BRANCH_ELEMENT[p.branch];
    total += w;
    if (el === dEl || el === (dEl + 4) % 5) support += w;
  }
  const ratio = total ? support / total : 0.5;
  const strength = ratio >= 0.55 ? '신강' : ratio <= 0.4 ? '신약' : '중화';
  const elName = (i: number) => ELEMENTS[((i % 5) + 5) % 5];
  const weakest = s.elementRatio.weakest as string;
  const yong = strength === '신약'
    ? { yong: elName(dEl + 4), hee: elName(dEl), gi: elName(dEl + 2), reason: '일간의 힘이 약해 나를 낳아 주는 인성 기운이 가장 필요하고, 같은 기운(비겁)이 그다음으로 돕는다' }
    : strength === '신강'
      ? { yong: elName(dEl + 1), hee: elName(dEl + 2), gi: elName(dEl + 4), reason: '일간의 힘이 넘쳐 기운을 밖으로 풀어 주는 식상이 가장 필요하고, 결실을 맺는 재성이 그다음으로 돕는다' }
      : { yong: weakest, hee: elName(ELEMENTS.indexOf(weakest) + 4), gi: s.elementRatio.strongest as string, reason: '일간의 힘이 고른 편이라 원국에서 가장 모자란 기운을 채우는 것이 균형에 좋다' };
  const luck = ELEMENT_LUCK[ELEMENTS.indexOf(yong.yong)];

  // 대운 표
  const cycles = ((s.daewoon as any).cycles ?? []) as { order: number; text: string; hanja: string; stem: number; branch: number; fromAge: number; toAge: number }[];
  const cur = (s.daewoon as any).current?.order;
  const daewoon = cycles.map((c) => ({
    order: c.order, text: c.text, hanja: c.hanja, fromAge: c.fromAge, toAge: c.toAge, current: c.order === cur,
    stemSipsin: sipsinOfStem(ds, c.stem), branchSipsin: sipsinOfBranch(ds, c.branch), stage: twelveStage(ds, c.branch),
    element: `${ELEMENTS[STEM_ELEMENT[c.stem]]}·${ELEMENTS[BRANCH_ELEMENT[c.branch]]}`,
    withDay: relText(c.branch, db), withMonth: relText(c.branch, P.month!.branch),
  }));

  // 세운(올해부터 10년) · 월운(대상 해 12달)
  const birthYear = s.solarDate.year;
  const thisYear = new Date(now.getTime() + 9 * 3600_000).getUTCFullYear();
  const ganji = (stem: number, branch: number) => ({ text: STEMS[stem] + BRANCHES[branch], hanja: STEMS_HANJA[stem] + BRANCHES_HANJA[branch], stem, branch });
  const yearPillar = (y: number) => ganji(((y - 4) % 10 + 10) % 10, ((y - 4) % 12 + 12) % 12);
  const seun = Array.from({ length: 10 }, (_, i) => {
    const y = thisYear + i, p = yearPillar(y), age = y - birthYear + 1;
    return {
      year: y, age, text: p.text, hanja: p.hanja, stemSipsin: sipsinOfStem(ds, p.stem), branchSipsin: sipsinOfBranch(ds, p.branch),
      stage: twelveStage(ds, p.branch), withDay: relText(p.branch, db), withYear: relText(p.branch, yb),
      daewoon: daewoon.find((d) => age >= d.fromAge && age <= d.toAge)?.text ?? null, // 대운 나이는 세는 나이 기준(엔진과 같음)
    };
  });
  // 월운: 연간에 따라 인월(양력 2월)부터 천간이 정해진다 — 갑기년 병인월, 을경년 무인월, 병신년 경인월, 정임년 임인월, 무계년 갑인월
  const monthsOf = (y: number) => {
    const ys = yearPillar(y).stem;
    const startStem = [2, 4, 6, 8, 0][ys % 5];
    return Array.from({ length: 12 }, (_, i) => {
      const stem = (startStem + i) % 10, branch = (2 + i) % 12, p = ganji(stem, branch);
      return { solarMonth: ((i + 1) % 12) + 1, label: `양력 ${((i + 1) % 12) + 1}월경`, text: p.text, hanja: p.hanja, stemSipsin: sipsinOfStem(ds, stem), branchSipsin: sipsinOfBranch(ds, branch), stage: twelveStage(ds, branch), withDay: relText(branch, db) };
    });
  };
  const targetYear = thisYear + (new Date(now.getTime() + 9 * 3600_000).getUTCMonth() >= 10 ? 1 : 0);

  return {
    rows, relations, special,
    elements: { counts: s.elementRatio.weights, ratio: s.elementRatio.ratio, strongest: s.elementRatio.strongest, weakest, missing: s.elementRatio.missing },
    tenGodCounts: s.tenGods.counts, monthSipsin: s.tenGods.monthBranchSipsin,
    strength: { label: strength, score: Math.round(ratio * 100) },
    yongsin: { ...yong, basis: '억부법(참고)', luck },
    daewoon, daewoonStart: (s.daewoon as any).startAge ?? null, daewoonDirection: (s.daewoon as any).direction ?? null,
    seun, targetYear, months: monthsOf(targetYear),
  };
}
export type SajuReport = ReturnType<typeof analyzeSaju>;

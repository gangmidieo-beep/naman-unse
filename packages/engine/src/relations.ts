// 12운성·합·충·형·파·해 — 원본 엔진에 없어 표준 표로 추가한 부분. 계산만, 해석 없음.
export const TWELVE_STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'] as const;
// 일간별 장생 지지와 진행 방향(양간 순행, 음간 역행). 갑 해, 을 오, 병·무 인, 정·기 유, 경 사, 신 자, 임 신, 계 묘
const BIRTH_BRANCH = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];
export function twelveStage(dayStem: number, branch: number): string {
  const forward = dayStem % 2 === 0;
  const i = forward ? branch - BIRTH_BRANCH[dayStem] : BIRTH_BRANCH[dayStem] - branch;
  return TWELVE_STAGES[((i % 12) + 12) % 12];
}

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const pairs = (list: [number, number][]) => new Set(list.map(([a, b]) => pairKey(a, b)));
// 지지 index: 자0 축1 인2 묘3 진4 사5 오6 미7 신8 유9 술10 해11
const SIX_COMBINE = pairs([[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]]);
const THREE_COMBINE = [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]]; // 신자진 수, 해묘미 목, 인오술 화, 사유축 금
const BREAK = pairs([[0, 9], [1, 4], [2, 11], [3, 6], [5, 8], [7, 10]]);
const HARM = pairs([[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]]);
const PUNISH = pairs([[2, 5], [5, 8], [2, 8], [1, 10], [10, 7], [1, 7], [0, 3]]);
const SELF_PUNISH = new Set([4, 6, 9, 11]); // 진진·오오·유유·해해
const STEM_COMBINE = pairs([[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]]);
const STEM_CLASH = pairs([[0, 6], [1, 7], [2, 8], [3, 9]]);

export type BranchRelation = 'combine' | 'halfCombine' | 'clash' | 'punish' | 'break' | 'harm';
export function branchRelations(a: number, b: number): BranchRelation[] {
  const k = pairKey(a, b), out: BranchRelation[] = [];
  if (SIX_COMBINE.has(k)) out.push('combine');
  if (a !== b && THREE_COMBINE.some((g) => g.includes(a) && g.includes(b))) out.push('halfCombine');
  if ((a - b + 12) % 12 === 6) out.push('clash');
  if (PUNISH.has(k) || (a === b && SELF_PUNISH.has(a))) out.push('punish');
  if (BREAK.has(k)) out.push('break');
  if (HARM.has(k)) out.push('harm');
  return out;
}
export const stemCombines = (a: number, b: number) => STEM_COMBINE.has(pairKey(a, b));
export const stemClashes = (a: number, b: number) => STEM_CLASH.has(pairKey(a, b));

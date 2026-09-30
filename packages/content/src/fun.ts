// 재미로 보는 운세 — AI 호출 없음. 엔진 계산 + 규칙 + 문구 DB. 같은 사람·같은 날·같은 콘텐츠는 항상 같은 결과(시드 = 날짜 + 프로필ID + 콘텐츠ID).
import { dailyPillar, kstParts, sipsinOfStem, STEM_ELEMENT, ELEMENTS, type SajuResult } from '@naman/engine';
import { hash } from './today/engine';
import starDb from '../data/star/lines.json';
import bloodDb from '../data/blood/lines.json';
import factDb from '../data/factbomb/lines.json';
import mbtiDb from '../data/mbti.json';
import deck from '../data/tarot/deck.json';
import dream1 from '../data/dream/part1.json';
import dream2 from '../data/dream/part2.json';
import smallDb from '../data/smallsaju.json';
import onelineDb from '../data/onelinesaju.json';

type Band = '1' | '2' | '3' | '4' | '5';
const ymd = (d: Date) => { const k = kstParts(d); return `${k.year}${String(k.month).padStart(2, '0')}${String(k.day).padStart(2, '0')}`; };
const pick = <T>(arr: readonly T[], seed: string): T => arr[hash(seed) % arr.length];
const pickN = <T>(arr: readonly T[], n: number, seed: string): T[] =>
  arr.map((_, i) => i).sort((a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`)).slice(0, n).map((i) => arr[i]);
const clampBand = (x: number): Band => String(Math.max(1, Math.min(5, Math.round(x)))) as Band;
const bandTotal = (b: number, seed: string) => Math.max(55, Math.min(96, Math.round(55 + ((b - 1) / 4) * 38 + (hash(seed) % 7) - 3)));
// 오행 index: 목0 화1 토2 금3 수4. a 가 b 를 생하는가 / 극하는가
const gen = (a: number, b: number) => (a + 1) % 5 === b;
const ctl = (a: number, b: number) => (a + 2) % 5 === b;

/* ---------------- A. 별자리 ---------------- */
export const STAR_SIGNS = [
  { id: 'capricorn', name: '염소자리', en: 'Capricorn', from: [12, 25], el: 'earth' },
  { id: 'aquarius', name: '물병자리', en: 'Aquarius', from: [1, 20], el: 'air' },
  { id: 'pisces', name: '물고기자리', en: 'Pisces', from: [2, 19], el: 'water' },
  { id: 'aries', name: '양자리', en: 'Aries', from: [3, 21], el: 'fire' },
  { id: 'taurus', name: '황소자리', en: 'Taurus', from: [4, 20], el: 'earth' },
  { id: 'gemini', name: '쌍둥이자리', en: 'Gemini', from: [5, 21], el: 'air' },
  { id: 'cancer', name: '게자리', en: 'Cancer', from: [6, 22], el: 'water' },
  { id: 'leo', name: '사자자리', en: 'Leo', from: [7, 23], el: 'fire' },
  { id: 'virgo', name: '처녀자리', en: 'Virgo', from: [8, 23], el: 'earth' },
  { id: 'libra', name: '천칭자리', en: 'Libra', from: [9, 24], el: 'air' },
  { id: 'scorpio', name: '전갈자리', en: 'Scorpio', from: [10, 23], el: 'water' },
  { id: 'sagittarius', name: '사수자리', en: 'Sagittarius', from: [11, 23], el: 'fire' },
] as const;
export type StarId = (typeof STAR_SIGNS)[number]['id'];
const STAR_EL_KO = { fire: '불', earth: '흙', air: '공기', water: '물' } as const;
// 별자리 원소 → 오행(바람=巽=木): 불=화, 흙=토, 공기=목, 물=수
const STAR_TO_OH = { fire: 1, earth: 2, air: 0, water: 4 } as const;
// 요일 오행(일=해=화, 월=달=수, 화=화, 수=수, 목=목, 금=금, 토=토)
const WEEKDAY_OH = [1, 4, 1, 4, 0, 3, 2];
const LUCKY_TIME: Record<number, string> = { 0: '오전 5시~7시', 1: '오전 11시~오후 1시', 2: '오후 1시~3시', 3: '오후 5시~7시', 4: '밤 9시~11시' };

// 양력 생일 → 별자리 (경계일 표: 한국에서 흔히 쓰는 날짜)
export function starSignOf(month: number, day: number): StarId {
  const v = month * 100 + day;
  if (v >= 1225 || v < 120) return 'capricorn'; // 해를 넘는 별자리
  let cur: StarId = 'capricorn';
  for (const s of STAR_SIGNS) if (s.id !== 'capricorn' && v >= s.from[0] * 100 + s.from[1]) cur = s.id;
  return cur;
}
export function starToday(sign: StarId, date: Date, profileId: string) {
  const s = STAR_SIGNS.find((x) => x.id === sign)!;
  const seed = `${ymd(date)}:${profileId}:star:${sign}`;
  const today = STEM_ELEMENT[dailyPillar(date).stem];
  const me = STAR_TO_OH[s.el];
  let score = 3;
  if (gen(today, me)) score += 1.5; // 오늘 기운이 나를 도움
  else if (today === me) score += 0.8;
  else if (ctl(me, today)) score += 0.4;
  else if (gen(me, today)) score -= 0.2;
  else if (ctl(today, me)) score -= 1;
  const k = kstParts(date);
  if (WEEKDAY_OH[new Date(Date.UTC(k.year, k.month - 1, k.day)).getUTCDay()] === me) score += 0.5;
  score += ((hash(seed) % 100) / 100 - 0.5) * 0.8;
  const band = clampBand(score);
  const fb = (f: string) => clampBand(score + ((hash(`${seed}:${f}`) % 3) - 1));
  const F = starDb.field as Record<string, Record<Band, string[]>>;
  return {
    sign: s, elementKo: STAR_EL_KO[s.el], intro: (starDb.intro as Record<string, string[]>)[sign],
    band, stars: +band, total: bandTotal(+band, seed),
    oneLine: pick((starDb.oneLine as Record<Band, string[]>)[band], `${seed}:1`),
    love: pick(F.love[fb('love')], `${seed}:l`), money: pick(F.money[fb('money')], `${seed}:m`), work: pick(F.work[fb('work')], `${seed}:w`),
    item: pick(starDb.items, `${seed}:i`), time: LUCKY_TIME[me],
  };
}

/* ---------------- B. 혈액형 ---------------- */
export const BLOOD_TYPES = ['A', 'B', 'O', 'AB'] as const;
export type Blood = (typeof BLOOD_TYPES)[number];
// 혈액형별 기본 기질 가중(오늘 일진 천간이 내 일간에 대해 갖는 십신에 곱함)
const BLOOD_W: Record<Blood, Record<string, number>> = {
  A: { 정관: 1.2, 정인: 1, 편인: 0.6, 정재: 0.6, 비견: 0, 겁재: -0.6, 식신: 0.4, 상관: -0.8, 편재: 0.2, 편관: -0.4 },
  B: { 식신: 1.2, 상관: 1, 편재: 1, 정재: 0.4, 비견: 0.4, 겁재: 0, 편관: -0.6, 정관: -0.4, 편인: -0.2, 정인: 0.2 },
  O: { 비견: 1, 겁재: 0.6, 편관: 0.8, 정관: 0.4, 편재: 0.6, 정재: 0.2, 식신: 0.4, 상관: 0, 편인: -0.6, 정인: 0 },
  AB: { 편인: 1.2, 정재: 0.8, 상관: 0.6, 정인: 0.6, 식신: 0.2, 편재: 0, 비견: -0.4, 겁재: -0.6, 정관: 0.4, 편관: -0.2 },
};
function bloodScore(t: Blood, saju: SajuResult, date: Date, seed: string) {
  const tg = sipsinOfStem(saju.dayMaster.stem, dailyPillar(date).stem) as string;
  return 3 + (BLOOD_W[t][tg] ?? 0) + ((hash(`${seed}:${t}`) % 100) / 100 - 0.5) * 0.9;
}
export function bloodToday(t: Blood, saju: SajuResult, date: Date, profileId: string) {
  const seed = `${ymd(date)}:${profileId}:blood`;
  const band = clampBand(bloodScore(t, saju, date, seed));
  const others = BLOOD_TYPES.map((x) => ({ x, s: bloodScore(x, saju, date, seed) })).sort((a, b) => b.s - a.s);
  const best = (others.find((o) => o.x !== t) ?? others[0]).x;
  const m = (bloodDb.match as { pair: string[]; line: string }[]).find((p) => p.pair.includes(t) && p.pair.includes(best) && (t !== best || p.pair[0] === p.pair[1]))!;
  return {
    type: t, trait: (bloodDb.trait as Record<Blood, string[]>)[t], band, stars: +band, total: bandTotal(+band, `${seed}:${t}`),
    oneLine: pick((bloodDb.oneLine as Record<Blood, Record<Band, string[]>>)[t][band], `${seed}:${t}:1`),
    tip: pick((bloodDb.relationTip as Record<Band, string[]>)[band], `${seed}:${t}:tip`),
    caution: pick(bloodDb.caution, `${seed}:${t}:c`),
    best, match: m?.line ?? '',
  };
}

/* ---------------- C. 오늘의 타로 ---------------- */
export type TarotCard = (typeof deck)[number];
export const TAROT_DECK = deck as TarotCard[];
// 오늘 뒤집힌 채 보여줄 3장(날짜·프로필 고정) — 같은 날 다시 와도 같은 3장
export function tarotDraw(date: Date, profileId: string) {
  return tarotSpread(`${ymd(date)}:${profileId}:tarot`, 3);
}
// 유료 타로(주제별·스프레드): 주문 번호를 시드로 n장 — 같은 주문은 다시 열어도 같은 카드
export function tarotSpread(seed: string, n: number) {
  return pickN(TAROT_DECK.map((_, i) => i), n, seed).map((i, k) => ({ card: TAROT_DECK[i], reversed: hash(`${seed}:r${k}`) % 100 < 30 }));
}
export const tarotSide = (c: { card: TarotCard; reversed: boolean }) => (c.reversed ? c.card.reversed : c.card.upright);

/* ---------------- D. 꿈 해몽 ---------------- */
export type DreamEntry = (typeof dream1)[number];
export const DREAMS = [...dream1, ...dream2] as DreamEntry[];
export const DREAM_CATS = [
  { id: 'animal', label: '동물', hanja: '獸' }, { id: 'person', label: '사람', hanja: '人' }, { id: 'money', label: '돈·재물', hanja: '財' }, { id: 'nature', label: '자연', hanja: '水' },
  { id: 'body', label: '몸·건강', hanja: '身' }, { id: 'place', label: '집·장소', hanja: '家' }, { id: 'event', label: '사건', hanja: '事' }, { id: 'object', label: '물건', hanja: '物' },
] as const;
export const DREAM_POPULAR = ['돼지꿈', '뱀꿈', '이빨 빠지는 꿈', '돌아가신 부모님 꿈', '물에 빠지는 꿈', '똥 꿈', '불나는 꿈', '시험 보는 꿈'];
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const choseong = (s: string) => [...s].map((c) => { const n = c.charCodeAt(0) - 0xac00; return n >= 0 && n < 11172 ? CHO[Math.floor(n / 588)] : c; }).join('');
// 검색용 정규화: 띄어쓰기·문장부호 제거, "꿈/꾸는/꿨어요" 꼬리 제거, 이빨→이 같은 흔한 표기 통일
export const normDream = (s: string) =>
  s.replace(/[^가-힣a-z0-9ㄱ-ㅎ]/gi, '').replace(/(꿈을?꿨어요|꿈꿨어요|꾸었어요|꿨어요|하는꿈|꾸는꿈|꿈)$/, '').replace(/이빨/g, '이').replace(/치아/g, '이');
const isCho = (s: string) => /^[ㄱ-ㅎ]+$/.test(s);
const bigrams = (s: string) => new Set([...s].slice(0, -1).map((c, i) => c + s[i + 1]));
export function searchDream(q: string) {
  const nq = normDream(q.trim());
  if (!nq) return { hits: [] as DreamEntry[], near: [] as DreamEntry[] };
  const scored = DREAMS.map((d) => {
    const keys = [d.word, ...d.synonyms].map(normDream);
    let s = 0;
    for (const k of keys) {
      if (k === nq) s = Math.max(s, 100);
      else if (k.includes(nq) || nq.includes(k)) s = Math.max(s, 60 - Math.abs(k.length - nq.length));
      else if (isCho(nq) && choseong(k).includes(nq)) s = Math.max(s, 40);
    }
    return { d, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (scored.length) return { hits: scored.slice(0, 20).map((x) => x.d), near: [] };
  // 결과가 없으면 글자 조각이 가장 많이 겹치는 표제어 5개 추천
  const bq = bigrams(nq);
  const near = DREAMS.map((d) => { const b = bigrams(normDream(d.word)); let n = 0; bq.forEach((x) => b.has(x) && n++); return { d, n }; })
    .sort((a, b) => b.n - a.n).slice(0, 5).map((x) => x.d);
  return { hits: [], near };
}

/* ---------------- E. MZ 팩폭 사주 ---------------- */
const SEASON = (branch: number) => (['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'] as const)[branch];
const EL_KEY = ['wood', 'fire', 'earth', 'metal', 'water'] as const;
const STEM_KO = ['갑목(甲木)', '을목(乙木)', '병화(丙火)', '정화(丁火)', '무토(戊土)', '기토(己土)', '경금(庚金)', '신금(辛金)', '임수(壬水)', '계수(癸水)'];
export function factbomb(saju: SajuResult, profileId: string) {
  const stem = saju.dayMaster.stem;
  const season = SEASON(saju.pillars.month.branch);
  const strongest = EL_KEY[ELEMENTS.indexOf(saju.elementRatio.strongest)];
  const seed = `${profileId}:factbomb`; // 성격 카드라 날짜와 무관하게 사람마다 고정
  return {
    title: (factDb.title as Record<string, Record<string, string>>)[stem][season],
    bombs: pickN((factDb.bomb as Record<string, string[]>)[strongest], 3, seed),
    merit: pick((factDb.merit as Record<string, string[]>)[stem], `${seed}:m`),
    hashtags: pickN((factDb.hashtags as Record<string, string[]>)[strongest], 3, `${seed}:h`),
    stemName: STEM_KO[stem], season, strongest,
    buddy: STEM_KO[(stem + 5) % 10], // 천간합: 갑기·을경·병신·정임·무계
  };
}

/* ---------------- MBTI 사주 ---------------- */
export const MBTI_TYPES = Object.keys(mbtiDb) as string[];
export function mbtiResult(type: string, saju: SajuResult) {
  const m = (mbtiDb as Record<string, { nick: string; traits: string[]; strength: string; caution: string; withSaju: Record<string, string> }>)[type];
  if (!m) return null;
  const el = EL_KEY[STEM_ELEMENT[saju.dayMaster.stem]];
  return { type, ...m, element: el, elementKo: ELEMENTS[STEM_ELEMENT[saju.dayMaster.stem]] as string, saju: m.withSaju[el] };
}

/* ---------------- 스몰사주 · 한줄사주 (v3) ---------------- */
type SmallDb = { dayMaster: Record<string, { name: string; image: string; lines: string[] }>; strong: Record<string, string[]>; weak: Record<string, string[]>; luckyTip: string[] };
const SMALL = smallDb as SmallDb;
// 스몰사주: 사람마다 고정(일간·가장 강한/약한 오행) + 오늘의 작은 팁만 날마다 바뀜
export function smallSaju(saju: SajuResult, profileId: string, date: Date) {
  const dm = SMALL.dayMaster[String(saju.dayMaster.stem)];
  const strong = EL_KEY[ELEMENTS.indexOf(saju.elementRatio.strongest)];
  const weak = EL_KEY[ELEMENTS.indexOf(saju.elementRatio.weakest)];
  return {
    ...dm, strong, weak,
    strongLine: pick(SMALL.strong[strong], `${profileId}:small:s`),
    weakLine: pick(SMALL.weak[weak], `${profileId}:small:w`),
    tip: pick(SMALL.luckyTip, `${ymd(date)}:${profileId}:small`),
  };
}
// 한줄사주: 오늘 일진 천간이 내 일간에게 무엇(십신)인지로 한 줄 — 공유용
export function oneLineSaju(saju: SajuResult, profileId: string, date: Date) {
  const tg = sipsinOfStem(saju.dayMaster.stem, dailyPillar(date).stem) as string;
  return { tenGod: tg, line: pick((onelineDb.byTenGod as Record<string, string[]>)[tg], `${ymd(date)}:${profileId}:oneline`) };
}

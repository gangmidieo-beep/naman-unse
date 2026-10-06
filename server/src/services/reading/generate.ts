// 유료 풀이 생성 — 결제 완료 → readings(queued) → 워커가 생성 → done.
// 실제 AI 호출은 READING_AI=live + ANTHROPIC_API_KEY + ANTHROPIC_MODEL 이 모두 있을 때만(비용 보고·승인 후 켬). 아니면 예시 풀이로 흐름만 완성.
import { and, eq, inArray, lt } from 'drizzle-orm';
import { calcSaju, solarToLunar, tojeong, type SajuResult } from '@naman/engine';
import outline from '../../../../packages/content/data/reading-outline.json' with { type: 'json' };
import sajuSample from '../../../../packages/content/data/sample-readings/saju.json' with { type: 'json' };
import pairSample from '../../../../packages/content/data/sample-readings/gunghap.json' with { type: 'json' };
import yearSample from '../../../../packages/content/data/sample-readings/newyear.json' with { type: 'json' };
import { schema as S, type Db } from '../../db/index.ts';

export type Chapter = { id: string; title: string; say: string; body: string; highlight: string };
export type Closing = { title: string; body: string; tips: string[] };
export type ReadingContent = { productId: string; title: string; character: 'cheongung' | 'wolha'; intro: string; chapters: Chapter[]; closing: Closing; generatedBy: 'ai' | 'sample' };
type Person = { name: string; gender: 'M' | 'F'; year: number; month: number; day: number; calendar: 'solar' | 'lunar'; leap?: boolean; hour?: number | null };

const O = outline as { groups: Record<string, string[]>; products: Record<string, string> };
export const groupOf = (productId: string) => O.products[productId] ?? 'life';
export const chaptersFor = (productId: string, title: string) => O.groups[groupOf(productId)].map((t) => t.replace('{theme}', title.replace(/운세$|운$/, '') + '운'));
export const characterOf = (productId: string): 'cheongung' | 'wolha' => (['pair', 'love'].includes(groupOf(productId)) ? 'wolha' : 'cheongung');

/* ---------- 금지어·품질 검사 ---------- */
const BANNED = [/사망|죽(는|을|음)/, /이혼(하게|할 수밖에|이 확정)/, /파산/, /(암|중병)에 걸/, /(주식|코인|부동산)(을|를)? ?(사|매수)/, /반드시|무조건/];
export function checkQuality(c: ReadingContent, names: string[], expected: string[]): string[] {
  const issues: string[] = [];
  if (c.chapters.length !== expected.length) issues.push(`장 수 ${c.chapters.length}/${expected.length}`);
  const all = [c.intro, c.closing.body, ...c.closing.tips, ...c.chapters.map((x) => `${x.say} ${x.body} ${x.highlight}`)].join('\n');
  for (const n of names) if (!all.includes(n)) issues.push(`이름 누락: ${n}`);
  for (const re of BANNED) if (re.test(all)) issues.push(`금지 표현: ${re.source}`);
  c.chapters.forEach((ch, i) => { if ((ch.body ?? '').length < 200) issues.push(`${i + 1}장 분량 부족`); });
  const wolha = c.character === 'wolha';
  const ending = c.chapters.map((x) => x.body).join(' ');
  if (wolha && /하오\.|구려\.|하시게\./.test(ending)) issues.push('월하선녀 말투(해요체) 아님');
  if (!wolha && /(해요|예요)\.\s*$/.test(ending.trim()) && !/오\.|구려|시게/.test(ending)) issues.push('천궁도사 말투(하오체) 아님');
  return issues;
}

/* ---------- 프롬프트 ---------- */
const sajuLine = (n: string, s: SajuResult) => {
  const pil = [s.pillars.year, s.pillars.month, s.pillars.day, s.pillars.hour].map((p) => (p ? `${p.text}(${p.hanja})` : '시주 모름')).join(' ');
  const el = Object.entries(s.elements).map(([k, v]) => `${({ wood: '목', fire: '화', earth: '토', metal: '금', water: '수' } as any)[k]} ${v}`).join(', ');
  return `- ${n}: 원국 ${pil} / 일간 ${s.dayMaster.char}(${s.dayMaster.hanja}) ${s.dayMaster.element} ${s.dayMaster.polarity} / 오행 ${el} / 띠 ${s.zodiacAnimal}${s.daewoon?.current ? ` / 현재 대운 ${(s.daewoon.current as any).text ?? ''}` : ''}`;
};
export function buildPrompt(product: { id: string; title: string }, people: Person[], sajus: SajuResult[], titles: string[], focus?: string, now = new Date()) {
  const who = characterOf(product.id);
  const voice = who === 'wolha'
    ? '당신은 "월하선녀"다. 다정한 해요체(~해요, ~예요)로 쓴다.'
    : '당신은 "천궁도사"다. 점잖은 하오체(~하오, ~구려, ~하시게)로 쓴다.';
  const extra = groupOf(product.id) === 'tojeong' ? (() => {
    const p0 = people[0];
    const lun = p0.calendar === 'lunar' ? { year: p0.year, month: p0.month, day: p0.day } : (solarToLunar(p0.year, p0.month, p0.day) as any);
    const t = tojeong({ lunarYear: lun.year, lunarMonth: lun.month, lunarDay: lun.day, targetYear: now.getFullYear() + (now.getMonth() >= 10 ? 1 : 0) });
    return `\n토정비결 괘: ${t.number}번 (상괘 ${t.upper} · 중괘 ${t.middle} · 하괘 ${t.lower}). 원문·번역문 인용 금지, 새 문장으로.`;
  })() : '';
  const system = `${voice}
독자는 40~60대. 쉬운 말, 한 문단 3~5문장, 장마다 근거(어느 글자·어느 기운 때문인지)를 한 줄씩 넣어 "내 얘기 같다"는 느낌을 준다.
단정·공포 금지(죽음·이혼 확정·파산·큰 병 단정 금지), 의료·투자 권유 금지, "반드시·무조건" 금지. 희망적으로 마무리하고 요일·색·방향·사람 유형 같은 구체적 실천 조언을 준다.
다른 운세 사이트·책의 문장을 흉내 내지 말고 모두 새로 쓴다. 이름은 "OOO 님"으로 부른다.
출력은 JSON 하나만: {"intro": string, "chapters": [{"title": string, "say": string(한 줄 요약), "body": string(400~700자, 문단은 \\n\\n), "highlight": string(공유용 한 문장)}], "closing": {"title": "마무리 조언", "body": string, "tips": [실천 조언 3개]}}`;
  const user = `상품: ${product.title}
사람:
${people.map((p, i) => sajuLine(`${p.name}(${p.gender === 'M' ? '남' : '여'}, ${p.calendar === 'lunar' ? '음력' : '양력'} ${p.year}.${p.month}.${p.day}${p.hour == null ? ', 시간 모름' : ` ${p.hour}시`})`, sajus[i])).join('\n')}${extra}
오늘: ${now.toISOString().slice(0, 10)}${focus ? `\n고민: ${focus} — 관련 장은 두 배 분량으로` : ''}
장 목록(이 순서·제목 그대로): ${titles.map((t, i) => `${i + 1}. ${t}`).join(' / ')}`;
  return { system, user };
}

/* ---------- 생성 ---------- */
export const liveAI = () => process.env.READING_AI === 'live' && !!process.env.ANTHROPIC_API_KEY && !!process.env.ANTHROPIC_MODEL;
const KRW_PER_USD = 1400;
async function callClaude(system: string, user: string, http: typeof fetch) {
  const r = await http('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL, max_tokens: 8000, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!r.ok) throw new Error(`AI 호출 실패 ${r.status}`);
  const j = (await r.json()) as any;
  const text = (j.content ?? []).map((c: any) => c.text ?? '').join('');
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  return { json, tokensIn: j.usage?.input_tokens ?? 0, tokensOut: j.usage?.output_tokens ?? 0 };
}
// 입력 USD/1M, 출력 USD/1M — 모델 단가는 환경변수로(관리자 원가 표시용). 기본값은 추정치.
const rate = () => ({ inp: +(process.env.AI_PRICE_IN_PER_M ?? 3), out: +(process.env.AI_PRICE_OUT_PER_M ?? 15) });

function samplePerson(): Person { return { name: '홍길동', gender: 'M', year: 1975, month: 3, day: 15, calendar: 'solar', hour: null }; }
export function sampleContent(product: { id: string; title: string }, people: Person[]): ReadingContent {
  const g = groupOf(product.id);
  const src = (g === 'pair' || g === 'love' ? pairSample : g === 'year' || g === 'tojeong' ? yearSample : sajuSample) as any;
  const titles = chaptersFor(product.id, product.title);
  const name = people[0]?.name ?? '홍길동';
  const swap = (t: unknown) => String(t ?? '').replaceAll('홍길동', name).replaceAll('김영희', people[1]?.name ?? '김영희');
  return {
    productId: product.id, title: product.title, character: characterOf(product.id), generatedBy: 'sample',
    intro: swap(src.intro),
    chapters: titles.map((title, i) => { const c = src.chapters[i % src.chapters.length]; return { id: `c${i + 1}`, title, say: swap(c.say), body: swap(c.body), highlight: swap(c.highlight) }; }),
    closing: { title: swap(src.closing.title), body: swap(src.closing.body), tips: (src.closing.tips ?? []).map(swap) },
  };
}

export async function generateReading(product: { id: string; title: string }, people: Person[], opts: { focus?: string; http?: typeof fetch; now?: Date } = {}) {
  const ps = people.length ? people : [samplePerson()];
  const titles = chaptersFor(product.id, product.title);
  if (!liveAI()) return { content: sampleContent(product, ps), tokensIn: 0, tokensOut: 0, costKrw: 0, issues: [] as string[] };
  const sajus = ps.map((p) => calcSaju({ ...p, leapMonth: p.leap, timeUnknown: p.hour == null }));
  const half = Math.ceil(titles.length / 2);
  const parts = [titles.slice(0, half), titles.slice(half)];
  let tokensIn = 0, tokensOut = 0;
  const chapters: Chapter[] = [];
  let intro = '';
  let closing: Closing = { title: '마무리 조언', body: '', tips: [] };
  for (const [k, part] of parts.entries()) {
    const { system, user } = buildPrompt(product, ps, sajus, part, opts.focus, opts.now);
    const note = k === 0 ? '\n이번에는 intro 와 위 장들만 쓰고 closing 은 {"title":"","body":"","tips":[]}.' : '\n이번에는 위 장들과 closing 만 쓰고 intro 는 빈 문자열.';
    let res;
    for (let attempt = 0; ; attempt++) { // 묶음별 최대 2회 재시도
      try { res = await callClaude(system, user + note, opts.http ?? fetch); break; } catch (e) { if (attempt >= 2) throw e; }
    }
    tokensIn += res.tokensIn; tokensOut += res.tokensOut;
    if (k === 0) intro = res.json.intro ?? ''; else if (res.json.closing?.body) closing = { title: res.json.closing.title ?? '마무리 조언', body: res.json.closing.body, tips: res.json.closing.tips ?? [] };
    for (const c of res.json.chapters ?? []) chapters.push({ id: `c${chapters.length + 1}`, title: c.title, say: c.say, body: c.body, highlight: c.highlight });
  }
  const content: ReadingContent = { productId: product.id, title: product.title, character: characterOf(product.id), intro, chapters, closing, generatedBy: 'ai' };
  const r = rate();
  const costKrw = Math.round(((tokensIn * r.inp + tokensOut * r.out) / 1e6) * KRW_PER_USD);
  return { content, tokensIn, tokensOut, costKrw, issues: checkQuality(content, ps.map((p) => p.name), titles) };
}

/* ---------- 워커: 3초마다 대기 풀이를 최대 3개씩 ---------- */
export function startReadingWorker(db: Db, log: { warn: (m: string) => void }, http?: typeof fetch) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      // 10분 넘게 generating 이면 멈춘 것으로 보고 다시 대기열로
      await db.update(S.readings).set({ status: 'queued' }).where(and(eq(S.readings.status, 'generating'), lt(S.readings.createdAt, new Date(Date.now() - 600_000))));
      const list = await db.select().from(S.readings).where(eq(S.readings.status, 'queued')).limit(3);
      if (list.length) await db.update(S.readings).set({ status: 'generating' }).where(inArray(S.readings.id, list.map((x) => x.id)));
      await Promise.all(list.map((r) => runOne(db, r, http).catch((e) => log.warn(`[reading] ${r.id} 실패: ${e.message}`))));
    } finally { busy = false; }
  };
  const t = setInterval(tick, 3000);
  t.unref?.();
  return { tick, stop: () => clearInterval(t) };
}

export async function runOne(db: Db, r: typeof S.readings.$inferSelect, http?: typeof fetch) {
  const [p] = await db.select().from(S.products).where(eq(S.products.id, r.productId));
  const ids = (r.profileId ?? '').split('+').filter(Boolean);
  const profs = ids.length ? await db.select().from(S.profiles).where(inArray(S.profiles.id, ids)) : [];
  const people: Person[] = ids.map((id) => profs.find((x) => x.id === id)).filter(Boolean).map((x: any) => ({
    name: x.name, gender: x.gender, year: x.birthYear, month: x.birthMonth, day: x.birthDay, calendar: x.calendar, leap: x.leap, hour: x.birthHour,
  }));
  try {
    const g = await generateReading({ id: r.productId, title: p?.title ?? r.productId }, people, { http });
    await db.update(S.readings).set({
      status: 'done', content: { ...g.content, issues: g.issues } as any, model: g.content.generatedBy === 'ai' ? process.env.ANTHROPIC_MODEL ?? null : 'sample',
      tokensIn: g.tokensIn, tokensOut: g.tokensOut, costKrw: g.costKrw, doneAt: new Date(),
    }).where(eq(S.readings.id, r.id));
  } catch (e) {
    await db.update(S.readings).set({ status: 'failed' }).where(eq(S.readings.id, r.id));
    throw e;
  }
}

// 유료 풀이 생성 — 결제 완료 → readings(queued) → 워커가 생성 → done.
// 실제 AI 호출은 ANTHROPIC_API_KEY + ANTHROPIC_MODEL 이 있을 때(READING_AI=off 면 판매 중지 — services/env.ts aiSwitchOn). 아니면 예시 풀이로 흐름만 완성.
import { aiCostKrw, aiDiag, aiSwitchOn, recordAiFailure, recordAiOk } from '../env.ts';
import { and, asc, eq, inArray, isNull, lt, notInArray, or } from 'drizzle-orm';
import { mockMode } from '../mock.ts';
import { calcSaju, solarToLunar, tojeong, type SajuResult } from '@naman/engine';
import outline from '../../../../packages/content/data/reading-outline.json' with { type: 'json' };
import sajuSample from '../../../../packages/content/data/sample-readings/saju.json' with { type: 'json' };
import pairSample from '../../../../packages/content/data/sample-readings/gunghap.json' with { type: 'json' };
import yearSample from '../../../../packages/content/data/sample-readings/newyear.json' with { type: 'json' };
import { schema as S, type Db } from '../../db/index.ts';
import { generateLong, reportsFor, type LongContent } from './long.ts';

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
export const liveAI = () => aiSwitchOn() && !!process.env.ANTHROPIC_API_KEY && !!process.env.ANTHROPIC_MODEL;
async function callClaude(system: string, user: string, http: typeof fetch) {
  const r = await http('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL, max_tokens: 8000, system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!r.ok) { await recordAiFailure(r as any); throw new Error(`AI 호출 실패 ${r.status}`); }
  recordAiOk();
  const j = (await r.json()) as any;
  const text = (j.content ?? []).map((c: any) => c.text ?? '').join('');
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  return { json, tokensIn: j.usage?.input_tokens ?? 0, tokensOut: j.usage?.output_tokens ?? 0 };
}

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

export async function generateReading(product: { id: string; title: string }, people: Person[], opts: { focus?: string; http?: typeof fetch; now?: Date; prev?: Partial<LongContent> | null; onProgress?: (c: LongContent, u: { tokensIn: number; tokensOut: number; costKrw: number }) => Promise<void>; isAborted?: () => boolean } = {}) {
  const ps = people.length ? people : [samplePerson()];
  const titles = chaptersFor(product.id, product.title);
  if (!liveAI()) return { content: { ...sampleContent(product, ps), ...reportsFor(ps, opts.now) } as ReadingContent, tokensIn: 0, tokensOut: 0, costKrw: 0, issues: [] as string[] };
  if (process.env.READING_LONG !== 'off') { // A4 40~50장 정통 감정서(기본). READING_LONG=off 면 예전 9장짜리
    const g = await generateLong(product, groupOf(product.id), characterOf(product.id), ps, { http: opts.http, now: opts.now, prev: opts.prev, onProgress: opts.onProgress, isAborted: opts.isAborted });
    return { content: g.content as any, tokensIn: g.tokensIn, tokensOut: g.tokensOut, costKrw: g.costKrw, issues: g.content.issues ?? [] };
  }
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
  const costKrw = aiCostKrw(tokensIn, tokensOut);
  return { content, tokensIn, tokensOut, costKrw, issues: checkQuality(content, ps.map((p) => p.name), titles) };
}

/* ---------- 공유 문구: AI 감정 결과에서 핵심 해석 1문장 — 처음 다 쓸 때 저장해 두고 공유할 때 다시 씀(2026-10-30 대표님 요청)
   이름·생년월일 같은 개인 정보는 빼고, 너무 짧거나 긴 문장은 건너뜀 ---------- */
export function pickShareLine(content: any): string {
  if (!content) return '';
  if (typeof content.shareLine === 'string' && content.shareLine) return content.shareLine;
  const names: string[] = (content.people ?? []).map((p: any) => String(p?.name ?? '')).filter(Boolean);
  const clean = (t: unknown) => {
    let s = String(t ?? '').replace(/\s+/g, ' ').trim();
    for (const n of names) s = s.replaceAll(`${n} 님의 `, '').replaceAll(`${n}님의 `, '').replaceAll(`${n} 님은 `, '').replaceAll(`${n} 님`, '').replaceAll(`${n}님`, '').replaceAll(n, '');
    s = s.replace(/\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일/g, '').replace(/^[\s,·:—-]+/, '').replace(/\s{2,}/g, ' ').trim();
    const first = s.split(/(?<=[.!?。])\s/)[0] ?? s; // 한 문장만
    return first.trim();
  };
  const cands = [...(content.chapters ?? []).flatMap((c: any) => [c?.highlight, c?.say]), content.closing?.tips?.[0]].map(clean);
  return cands.find((x) => x.length >= 12 && x.length <= 90) ?? cands.find((x) => x.length >= 8)?.slice(0, 90) ?? '';
}

/* ---------- 워커: 3초마다 대기 풀이를 최대 2개씩(장편은 한 건에 AI 호출 십수 번 — 호출 수는 READING_CONCURRENCY 로 제한)
   2026-10-29 실서버: 같은 감정서를 여러 번 다시 쓰며 1건에 약 10달러가 나갔다 → 아래 안전장치
   ① 한 건씩 원자적으로 가져감(두 서버·두 틱이 같은 건을 동시에 쓰지 않게) ② 쓰는 동안 진행·원가를 저장하며 startedAt 을 갱신(살아 있음 표시)
   ③ 12분 넘게 진행이 없으면 멈춘 것으로 보고 다시 대기열로 ④ 건당 원가 상한(READING_COST_CAP_KRW, 기본 7,000원)을 넘으면 자동 재시도 중단
   ⑤ 환불·취소된 주문은 쓰지 않음 ⑥ 사주 정보가 없으면 예시 인물로 쓰지 않고 바로 실패 ---------- */
const MAX_ATTEMPTS = 3;
const SLOTS = 2;
export const costCap = () => +(process.env.READING_COST_CAP_KRW ?? 7000);
const staleMs = () => +(process.env.READING_STALE_MIN ?? 12) * 60_000;
class StopError extends Error {} // 다시 시도해도 소용없는 실패(사주 정보 없음·비용 상한) — 자동 재시도 안 함
export function startReadingWorker(db: Db, log: { warn: (m: string) => void }, http?: typeof fetch) {
  let busy = false;
  const running = new Set<string>();
  const tick = async () => {
    if (busy) return;
    busy = true;
    const started: Promise<unknown>[] = [];
    try {
      // 운영 중 AI 가 꺼져 있으면(키 없음·READING_AI!=live) 결제된 풀이를 예시 내용으로 끝내지 않고 대기열에 둔다 — 키를 넣으면 이어서 생성
      if (!liveAI() && !mockMode()) return;
      // 진행이 12분 넘게 멈춘 generating → 다시 대기열(서버 재시작·배포로 끊긴 것). 끝난 장은 content 에 남아 있어 이어서 쓴다. 이 서버가 쓰는 중인 건은 제외
      const stale = new Date(Date.now() - staleMs());
      await db.update(S.readings).set({ status: 'queued' }).where(and(
        eq(S.readings.status, 'generating'),
        or(lt(S.readings.startedAt, stale), and(isNull(S.readings.startedAt), lt(S.readings.createdAt, stale))),
        running.size ? notInArray(S.readings.id, [...running]) : undefined,
      ));
      // 실패한 풀이는 3분 뒤 자동으로 다시(최대 3번, 원가 상한 미만일 때만)
      await db.update(S.readings).set({ status: 'queued' }).where(and(
        eq(S.readings.status, 'failed'), lt(S.readings.attempts, MAX_ATTEMPTS), lt(S.readings.startedAt, new Date(Date.now() - 180_000)),
        or(isNull(S.readings.costKrw), lt(S.readings.costKrw, costCap())),
      ));
      const free = SLOTS - running.size;
      if (free <= 0) return;
      const list = await db.select({ id: S.readings.id }).from(S.readings).where(eq(S.readings.status, 'queued')).orderBy(asc(S.readings.createdAt)).limit(free);
      for (const x of list) {
        const [r] = await db.update(S.readings).set({ status: 'generating', startedAt: new Date() }).where(and(eq(S.readings.id, x.id), eq(S.readings.status, 'queued'))).returning();
        if (!r) continue; // 다른 서버·틱이 먼저 가져감
        running.add(r.id);
        started.push(runOne(db, r, http).catch((e) => log.warn(`[reading] ${r.id} 실패: ${e.message}`)).finally(() => running.delete(r.id)));
      }
    } catch (e) { log.warn(`[reading worker] ${(e as Error).message}`); } finally { busy = false; }
    await Promise.all(started); // 다음 틱은 기다리지 않고 남은 자리에 새 건을 가져간다(한 건이 오래 걸려도 다른 고객이 막히지 않게)
  };
  const t = setInterval(tick, 3000);
  t.unref?.();
  return { tick, stop: () => clearInterval(t) };
}

export async function runOne(db: Db, r: typeof S.readings.$inferSelect, http?: typeof fetch) {
  const mine = and(eq(S.readings.id, r.id), eq(S.readings.status, 'generating')); // 다른 서버가 가져갔거나 환불로 바뀌었으면 쓰지 않음
  const [o] = await db.select().from(S.orders).where(eq(S.orders.id, r.orderId));
  if (o && o.status !== 'paid') { await db.update(S.readings).set({ status: 'cancelled' }).where(mine); return; } // 환불·취소된 주문은 AI 비용을 쓰지 않는다
  const [p] = await db.select().from(S.products).where(eq(S.products.id, r.productId));
  const ids = (r.profileId ?? '').split('+').filter(Boolean);
  const profs = ids.length ? await db.select().from(S.profiles).where(inArray(S.profiles.id, ids)) : [];
  const people: Person[] = ids.map((id) => profs.find((x) => x.id === id)).filter(Boolean).map((x: any) => ({
    name: x.name, gender: x.gender, year: x.birthYear, month: x.birthMonth, day: x.birthDay, calendar: x.calendar, leap: x.leap, hour: x.birthHour,
  }));
  const base = { tokensIn: r.tokensIn ?? 0, tokensOut: r.tokensOut ?? 0, costKrw: r.costKrw ?? 0 };
  const prev = (r.content as any)?.version === 2 ? (r.content as Partial<LongContent>) : null;
  // 진행 저장 = 끝난 장 + 지금까지 원가. 원가 상한을 넘으면 멈춤 표시(나머지 묶음도 새 AI 호출을 하지 않음)
  let aborted = false;
  const save = async (c: LongContent, u?: { tokensIn: number; tokensOut: number; costKrw: number }) => {
    await db.update(S.readings).set({ content: c as any, startedAt: new Date(), ...(u ? { tokensIn: base.tokensIn + u.tokensIn, tokensOut: base.tokensOut + u.tokensOut, costKrw: base.costKrw + u.costKrw } : {}) }).where(mine);
    if (u && base.costKrw + u.costKrw >= costCap() * 1.5) { aborted = true; throw new StopError(`원가 상한 초과(${base.costKrw + u.costKrw}원) — 관리자 확인 필요`); }
  };
  // 살아 있음 표시 — AI 한 번이 몇 분씩 걸려도 1분마다 startedAt 을 갱신(다른 서버가 '멈춘 건'으로 보고 같은 건을 또 쓰지 않게)
  const beat = setInterval(() => { void db.update(S.readings).set({ startedAt: new Date() }).where(mine).catch(() => {}); }, 60_000);
  beat.unref?.();
  try {
    // 사주 정보가 하나라도 없으면 예시 인물(홍길동)로 쓰지 않는다 — AI 비용만 나가고 엉뚱한 풀이가 됨
    if (liveAI() && (!ids.length || people.length < ids.length)) throw new StopError('사주 정보 없음(삭제됐거나 저장 실패) — 다시 결제·문의 필요');
    if (base.costKrw >= costCap() * 1.5) throw new StopError(`원가 상한 초과(${base.costKrw}원) — 관리자 확인 필요`);
    // 결제한 날 기준으로 쓴다(11월 1일에 해가 바뀐 뒤 이어 쓰면 올해·내년 내용이 섞이던 문제)
    const g = await generateReading({ id: r.productId, title: p?.title ?? r.productId }, people, { http, prev, now: r.createdAt ?? undefined, onProgress: save, isAborted: () => aborted });
    await db.update(S.readings).set({
      status: 'done', content: { ...g.content, issues: g.issues, shareLine: pickShareLine(g.content) } as any, model: g.content.generatedBy === 'ai' ? process.env.ANTHROPIC_MODEL ?? null : 'sample',
      tokensIn: base.tokensIn + g.tokensIn, tokensOut: base.tokensOut + g.tokensOut, costKrw: base.costKrw + g.costKrw, doneAt: new Date(),
    }).where(mine);
  } catch (e: any) {
    // AI 호출 오류가 아닌 실패(형식 오류·사주 정보 없음 등)도 /health 진단에 남긴다
    if (!String(e?.message ?? '').startsWith('AI 호출 실패')) aiDiag.lastError = { at: new Date().toISOString(), status: 0, type: 'generate', message: String(e?.message ?? e).slice(0, 200) };
    const stop = e instanceof StopError || /원가 상한 초과|사주 정보 없음/.test(String(e?.message)); // 묶음 안에서 멈춘 경우 메시지만 남아 있음
    // 끝난 장은 저장해 두고(다음 시도에서 이어서), 쓴 토큰·원가도 누적. startedAt = 실패 시각(3분 뒤 재시도 기준)
    await db.update(S.readings).set({
      status: 'failed', attempts: stop ? MAX_ATTEMPTS : (r.attempts ?? 0) + 1, startedAt: new Date(), ...(e.partial ? { content: e.partial } : {}),
      ...(e.tokensIn !== undefined ? { tokensIn: base.tokensIn + (e.tokensIn ?? 0), tokensOut: base.tokensOut + (e.tokensOut ?? 0), costKrw: base.costKrw + (e.costKrw ?? 0) } : {}),
    }).where(mine);
    throw e;
  } finally { clearInterval(beat); }
}

// A4 40~50장 정통 감정서 생성(2026-10-13 대표님 요청).
// 1) 엔진 analyzeSaju 로 원국·신강약·용신·신살·합충·대운·세운·월운을 계산(표는 화면·PDF 에 그대로)
// 2) reading-outline-long.json 목차를 사람·대운·세운·월운에 맞게 펼침(약 35~45장)
// 3) 장들을 4천 자 안팎 묶음으로 나눠 AI 를 동시에 여러 번 호출, 장마다 "이 장에서만 다룰 내용"과 전체 목차를 같이 줘 중복을 막음
// 4) 묶음이 끝날 때마다 진행분을 저장(화면에 "N/M장 작성 중"), 실패하면 끝난 장은 두고 남은 장만 다시 씀
import { analyzeSaju, calcSaju, solarToLunar, tojeong, STEMS, BRANCHES, type SajuReport, type SajuResult } from '@naman/engine';
import longOutline from '../../../../packages/content/data/reading-outline-long.json' with { type: 'json' };

export type Person = { name: string; gender: 'M' | 'F'; year: number; month: number; day: number; calendar: 'solar' | 'lunar'; leap?: boolean; hour?: number | null };
export type LongChapter = { id: string; title: string; say: string; body: string; highlight: string; part: number };
export type LongContent = {
  version: 2; productId: string; title: string; character: 'cheongung' | 'wolha'; generatedBy: 'ai' | 'sample';
  intro: string; parts: { title: string }[]; chapters: LongChapter[]; closing: { title: string; body: string; tips: string[] };
  people: { name: string; gender: 'M' | 'F'; birth: string }[]; reports: SajuReport[]; pillars: SajuResult['pillars'][];
  tojeong?: { number: number; upper: number; middle: number; lower: number; year: number };
  progress?: { done: number; total: number }; issues?: string[];
};
type Section = { id: string; title: string; brief: string; len: number; facts: string[]; part: number; ctx?: Record<string, any> };
type OutlineSection = { id: string; title: string; brief: string; len: number; lenPast?: number; lenFirst?: number; firstCount?: number; facts: string[]; each?: 'daewoon' | 'seun' | 'month' };
type OutlinePart = { title: string; base?: boolean; baseScale?: number; pairBase?: number; sections?: OutlineSection[] };
const L = longOutline as unknown as { base: OutlineSection[]; pairBase: OutlineSection[]; groups: Record<string, OutlinePart[]> };

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? `{${k}}`) as string);
const birthText = (p: Person) => `${p.calendar === 'lunar' ? '음력' : '양력'} ${p.year}.${p.month}.${p.day}${p.hour == null ? ' (태어난 시 모름)' : ` ${p.hour}시`}`;

export function buildPlan(product: { id: string; title: string }, group: string, people: Person[], now = new Date()) {
  const sajus = people.map((p) => calcSaju({ ...p, leapMonth: p.leap, timeUnknown: p.hour == null }, { now }));
  const reports = sajus.map((s) => analyzeSaju(s, now));
  const r0 = reports[0];
  const theme = group === 'theme' ? product.title.replace(/운세$|운$/, '') + '운' : product.title;
  const vars: Record<string, string | number> = {
    theme, year: r0.targetYear, dm: `${sajus[0].dayMaster.char}(${sajus[0].dayMaster.hanja})`,
    name1: people[0]?.name ?? '', name2: people[1]?.name ?? '',
  };
  const curAge = r0.targetYear - people[0].year + 1;
  const parts: { title: string }[] = [];
  const sections: Section[] = [];
  const k = +(process.env.READING_LEN_SCALE ?? 1); // 전체 분량 조절(1.0 = 목차 그대로, A4 약 43~47장). 실제 글이 짧거나 길게 나오면 이 값으로 맞춤
  for (const part of L.groups[group] ?? L.groups.life) {
    const pi = parts.push({ title: fill(part.title, vars) }) - 1;
    const add = (o: OutlineSection, extra: Partial<Section> = {}, v: Record<string, string | number> = {}) =>
      sections.push({ id: o.id, title: fill(o.title, { ...vars, ...v }), brief: fill(o.brief, { ...vars, ...v }), facts: o.facts, part: pi, ...extra, len: Math.round(((extra.len ?? o.len) * k) / 50) * 50 });
    if (part.base) for (const o of L.base) add(o, { len: Math.round(o.len * (part.baseScale ?? 1)), ctx: { person: 0 } });
    if (part.pairBase != null) {
      const k = part.pairBase, nm = people[k]?.name ?? '';
      for (const o of L.pairBase) add(o, { id: `${o.id}_${k}`, ctx: { person: k } }, { name: nm });
    }
    for (const o of part.sections ?? []) {
      if (o.each === 'daewoon') {
        for (const d of r0.daewoon) {
          const past = d.toAge < curAge;
          add(o, { id: `${o.id}${d.order}`, len: past ? o.lenPast ?? o.len : o.len, ctx: { daewoon: d.order, past } }, { order: d.order, text: d.text, hanja: d.hanja, fromAge: d.fromAge, toAge: d.toAge });
        }
      } else if (o.each === 'seun') {
        r0.seun.forEach((y, i) => add(o, { id: `${o.id}${y.year}`, len: i < (o.firstCount ?? 0) ? o.lenFirst ?? o.len : o.len, ctx: { seun: y.year } }, { year: y.year, text: y.text, hanja: y.hanja, age: y.age }));
      } else if (o.each === 'month') {
        r0.months.forEach((m, i) => add(o, { id: `${o.id}${i + 1}`, ctx: { month: i } }, { label: m.label, text: m.text, hanja: m.hanja }));
      } else add(o);
    }
  }
  let tj: LongContent['tojeong'];
  if (group === 'tojeong') {
    const p0 = people[0];
    const lun = p0.calendar === 'lunar' ? { year: p0.year, month: p0.month, day: p0.day } : (solarToLunar(p0.year, p0.month, p0.day) as any);
    const t = tojeong({ lunarYear: lun.year, lunarMonth: lun.month, lunarDay: lun.day, targetYear: r0.targetYear });
    tj = { number: t.number, upper: t.upper, middle: t.middle, lower: t.lower, year: r0.targetYear };
  }
  return { sections, parts, sajus, reports, vars, tojeong: tj };
}

/* ---------- 프롬프트용 사실 정리(짧게) ---------- */
const j = (a: string[]) => (a.length ? a.join(', ') : '없음');
function factLines(keys: string[], s: Section, people: Person[], sajus: SajuResult[], reports: SajuReport[], tj?: LongContent['tojeong']) {
  const k = (s.ctx?.person as number) ?? 0;
  const r = reports[k], sj = sajus[k], who = people[k];
  const out: string[] = [];
  const rows = () => r.rows.map((x: any) => (x.empty ? `${x.label}: 모름` : `${x.label} ${x.text}(${x.hanja}) — 천간 ${x.stem.char}[${x.stem.element}·${x.stem.sipsin}] / 지지 ${x.branch.char}[${x.branch.element}·${x.branch.sipsin}] 지장간 ${x.hidden.join(' ')} · 12운성 ${x.stage}${x.shinsal.length ? ` · 신살 ${x.shinsal.join(' ')}` : ''}`)).join('\n');
  for (const key of keys) {
    if (key === 'rows' || key === 'summary') out.push(`[원국 ${who.name}]\n${rows()}`);
    if (key === 'daymaster' || key === 'summary') out.push(`[일간] ${sj.dayMaster.char}(${sj.dayMaster.hanja}) ${sj.dayMaster.element} ${sj.dayMaster.polarity} · 일주 ${sj.pillars.day.text}`);
    if (key === 'season') out.push(`[계절] 태어난 달 ${sj.pillars.month.text}월 · 절기 ${sj.jeolgi?.prev?.name ?? ''} 이후`);
    if (key === 'elements' || key === 'summary') out.push(`[오행] ${Object.entries(r.elements.counts).map(([e, n]) => `${e}${n}`).join(' ')} · 가장 강함 ${r.elements.strongest} · 가장 약함 ${r.elements.weakest} · 없음 ${j(r.elements.missing)}`);
    if (key === 'tenGods' || key === 'summary') out.push(`[십성 개수] ${Object.entries(r.tenGodCounts).map(([n, c]) => `${n}${c}`).join(' ')} · 월지 십성 ${r.monthSipsin}`);
    if (key === 'strength' || key === 'yongsin' || key === 'summary') out.push(`[신강약] ${r.strength.label}(돕는 힘 ${r.strength.score}%) · [용신(억부 참고)] 용신 ${r.yongsin.yong} · 희신 ${r.yongsin.hee} · 기신 ${r.yongsin.gi} — ${r.yongsin.reason}`);
    if (key === 'yongsin') out.push(`[용신 생활] 색 ${r.yongsin.luck.color} · 방향 ${r.yongsin.luck.dir} · 숫자 ${r.yongsin.luck.num} · 계절 ${r.yongsin.luck.season} · 음식 ${r.yongsin.luck.food} · 관련 장부 ${r.yongsin.luck.organ}`);
    if (key === 'relations' || key === 'special') out.push(`[원국 합충] ${j(r.relations)} · [특수] ${j(r.special)}`);
    if (key === 'gender') out.push(`[성별] ${who.gender === 'M' ? '남성' : '여성'}`);
    if (key === 'daewoon') out.push(`[대운 ${r.daewoonStart ?? ''}세 시작] ${r.daewoon.map((d) => `${d.fromAge}~${d.toAge}세 ${d.text}(${d.stemSipsin}/${d.branchSipsin}·${d.stage})${d.current ? '←지금' : ''}`).join(' | ')}`);
    if (key === 'daewoonOne') {
      const d = r.daewoon.find((x) => x.order === s.ctx?.daewoon)!;
      out.push(`[이 대운] ${d.fromAge}~${d.toAge}세 ${d.text}(${d.hanja}) 오행 ${d.element} · 천간 ${d.stemSipsin} · 지지 ${d.branchSipsin} · 12운성 ${d.stage} · 일지와 ${j(d.withDay)} · 월지와 ${j(d.withMonth)}${d.current ? ' · 지금 대운' : s.ctx?.past ? ' · 지나간 대운' : ' · 앞으로의 대운'}`);
    }
    if (key === 'seun') out.push(`[세운 10년] ${r.seun.map((y) => `${y.year} ${y.text}(${y.stemSipsin}/${y.branchSipsin}${y.withDay.length ? `·일지${y.withDay.join('')}` : ''})`).join(' | ')}`);
    if (key === 'seunOne' || key === 'seunFirst') {
      const y = key === 'seunFirst' ? r.seun.find((x) => x.year === r.targetYear) ?? r.seun[0] : r.seun.find((x) => x.year === s.ctx?.seun)!;
      out.push(`[${y.year}년 세운] ${y.text}(${y.hanja}) · 천간 ${y.stemSipsin} · 지지 ${y.branchSipsin} · 12운성 ${y.stage} · 일지와 ${j(y.withDay)} · 연지와 ${j(y.withYear)} · 속한 대운 ${y.daewoon ?? '-'} · ${y.age}세`);
    }
    if (key === 'months') out.push(`[${r.targetYear}년 월운] ${r.months.map((m) => `${m.label} ${m.text}(${m.stemSipsin}/${m.branchSipsin}${m.withDay.length ? `·일지${m.withDay.join('')}` : ''})`).join(' | ')}`);
    if (key === 'monthOne') {
      const m = r.months[s.ctx?.month ?? 0];
      out.push(`[이달 월운] ${m.label} ${m.text}(${m.hanja}) · 천간 ${m.stemSipsin} · 지지 ${m.branchSipsin} · 12운성 ${m.stage} · 일지와 ${j(m.withDay)}`);
    }
    if (key === 'tojeong' && tj) out.push(`[토정비결 ${tj.year}년] 괘 ${tj.number}번 (상괘 ${tj.upper} · 중괘 ${tj.middle} · 하괘 ${tj.lower})`);
    if (key === 'pair' && reports.length > 1) {
      for (const [i, rr] of reports.entries()) {
        const sjx = sajus[i];
        out.push(`[${people[i].name} ${people[i].gender === 'M' ? '남' : '여'}] 원국 ${rr.rows.filter((x: any) => !x.empty).map((x: any) => x.text).join(' ')} · 일간 ${sjx.dayMaster.char}(${sjx.dayMaster.element}) · 띠 ${sjx.zodiacAnimal} · 오행 ${Object.entries(rr.elements.counts).map(([e, n]) => `${e}${n}`).join('')} · ${rr.strength.label} · 용신 ${rr.yongsin.yong}/희신 ${rr.yongsin.hee}/기신 ${rr.yongsin.gi} · 지금 대운 ${rr.daewoon.find((d) => d.current)?.text ?? '-'} · 올해 세운과 일지 ${j(rr.seun[0].withDay)}`);
        out.push(`  대운: ${rr.daewoon.map((d) => `${d.fromAge}~${d.toAge} ${d.text}`).join(' | ')}`);
      }
      const [a, b] = sajus;
      const rel = (x: number, y: number) => {
        const rs: string[] = [];
        // 지지 관계는 엔진의 branchRelations 와 같은 규칙(간단히 충·합만 문자로)
        if ((x - y + 12) % 12 === 6) rs.push('충');
        if ([[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]].some(([p, q]) => (p === x && q === y) || (p === y && q === x))) rs.push('육합');
        return rs.length ? rs.join('·') : '특별한 합충 없음';
      };
      out.push(`[두 사람] 일지 ${BRANCHES[a.pillars.day.branch]}·${BRANCHES[b.pillars.day.branch]}: ${rel(a.pillars.day.branch, b.pillars.day.branch)} · 연지 ${BRANCHES[a.pillars.year.branch]}·${BRANCHES[b.pillars.year.branch]}: ${rel(a.pillars.year.branch, b.pillars.year.branch)} · 일간 ${STEMS[a.dayMaster.stem]}·${STEMS[b.dayMaster.stem]}`);
    }
  }
  return [...new Set(out)];
}

function systemPrompt(character: 'cheongung' | 'wolha') {
  const voice = character === 'wolha'
    ? '당신은 "월하선녀"다. 다정하지만 품위 있는 해요체(~해요, ~예요)로 쓴다.'
    : '당신은 "천궁도사"다. 점잖은 하오체(~하오, ~구려, ~하시게)로 쓴다.';
  return `${voice}
지금 쓰는 글은 A4 40~50장 분량의 "정통 사주 감정서"의 일부다. 명리학의 정통 용어(일간·월령·십성·지장간·12운성·합충형파해·신강신약·용신·희신·기신·대운·세운·월운·신살)를 정확히 쓰되, 용어가 처음 나오면 괄호나 한 문장으로 쉽게 풀어 준다. 독자는 30~60대.
- 모든 장에서 "어느 기둥의 어느 글자·어느 십성·어느 관계 때문에"라는 근거를 들고, 그 근거에서 생활 속 장면(일·돈·사람·건강)으로 이어지게 쓴다.
- 이 장의 brief 에 적힌 범위만 다룬다. 전체 목차에 다른 장으로 잡힌 주제는 쓰지 않는다. 원국 소개·일간 설명을 장마다 다시 하지 않는다.
- 같은 문장·같은 비유·같은 맺음말을 되풀이하지 않는다. 장마다 첫 문장을 다르게 시작한다. "결론적으로" "요약하자면" 같은 상투어 금지.
- 문단은 3~5문장, 문단 사이는 \\n\\n. 목표 분량(공백 포함 글자 수)을 지킨다(±15%).
- 단정·공포 금지(죽음·이혼 확정·파산·큰 병 단정 금지), 의료 진단·투자 권유 금지, "반드시·무조건" 금지. 어려운 시기도 대처법과 함께 희망적으로 쓴다.
- 다른 사이트·책의 문장을 흉내 내지 않고 모두 새로 쓴다. 이름은 "OOO 님".
- 출력은 JSON 하나만: {"sections":[{"id":string,"say":string(한 줄 요약, 30자 안팎),"body":string,"highlight":string(공유용 한 문장)}]${'' /* intro·tips 는 필요할 때 user 가 요청 */}}`;
}

function userPrompt(product: { title: string }, people: Person[], all: Section[], batch: Section[], facts: string[], parts: { title: string }[], extras: string) {
  const toc = all.map((s) => `${batch.includes(s) ? '▶' : ' '} ${parts[s.part].title.split(' ')[0]} · ${s.title}`).join('\n');
  return `상품: ${product.title}
사람: ${people.map((p) => `${p.name}(${p.gender === 'M' ? '남' : '여'}, ${birthText(p)})`).join(' / ')}

전체 목차(▶ 표시가 이번에 쓸 장, 나머지는 다른 장에서 다루므로 겹치지 말 것):
${toc}

분석 자료:
${facts.join('\n')}

이번에 쓸 장:
${batch.map((s) => `- id "${s.id}" · 제목 "${s.title}" · 목표 ${s.len}자\n  이 장에서만 다룰 내용: ${s.brief}`).join('\n')}${extras}`;
}

/* ---------- AI 호출: 동시 호출 제한 + 429·과부하 재시도 ---------- */
let running = 0;
const waiters: (() => void)[] = [];
const limit = () => Math.max(1, +(process.env.READING_CONCURRENCY ?? 6)); // 동시에 보내는 AI 호출 수(서버 전체)
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= limit()) await new Promise<void>((r) => waiters.push(r));
  running++;
  try { return await fn(); } finally { running--; waiters.shift()?.(); }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function callClaudeLong(system: string, user: string, maxTokens: number, http: typeof fetch, model = process.env.ANTHROPIC_MODEL) {
  for (let attempt = 0; ; attempt++) {
    const r = await slot(() => http('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout(300_000),
    }).catch((e) => ({ ok: false, status: 0, headers: new Headers(), json: async () => ({}), err: e }) as any));
    if (r.ok) {
      const j = (await r.json()) as any;
      const text = (j.content ?? []).map((c: any) => c.text ?? '').join('');
      try {
        return { json: JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)), tokensIn: j.usage?.input_tokens ?? 0, tokensOut: j.usage?.output_tokens ?? 0, stop: j.stop_reason };
      } catch { if (attempt >= 2) throw new Error('AI 응답 형식 오류'); continue; }
    }
    const retryable = [0, 408, 429, 500, 502, 503, 504, 529].includes(r.status);
    if (!retryable || attempt >= 6) throw new Error(`AI 호출 실패 ${r.status}`);
    const ra = +(r.headers?.get?.('retry-after') ?? 0);
    await sleep(Math.min(90_000, (ra > 0 ? ra * 1000 : 5000 * 2 ** attempt)) * (process.env.NODE_ENV === 'test' ? 0 : 1));
  }
}

/* ---------- 품질 검사: 분량·중복 문장 ---------- */
const sentences = (t: string) => t.split(/(?<=[.!?。])\s+|\n+/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 25);
export function longQuality(chapters: LongChapter[], plan: Section[], names: string[]) {
  const issues: string[] = [];
  const seen = new Map<string, string>();
  for (const c of chapters) {
    const want = plan.find((s) => s.id === c.id)?.len ?? 0;
    if (want && c.body.length < want * 0.6) issues.push(`분량 부족: ${c.title} (${c.body.length}/${want}자)`);
    for (const s of sentences(c.body)) {
      const key = s.replace(/[^가-힣a-z0-9]/gi, '');
      if (seen.has(key) && seen.get(key) !== c.id) issues.push(`중복 문장: ${c.title} ← ${seen.get(key)}`);
      else seen.set(key, c.id);
    }
  }
  const all = chapters.map((c) => c.body).join('\n');
  for (const n of names) if (n && !all.includes(n)) issues.push(`이름 누락: ${n}`);
  if (/사망|파산|(이혼(하게|할 수밖에|이 확정))|반드시|무조건/.test(all)) issues.push('금지 표현 포함');
  return [...new Set(issues)].slice(0, 30);
}

/* ---------- 생성 ---------- */
const BATCH_CHARS = () => +(process.env.READING_BATCH_CHARS ?? 4500);
export function batchesOf(sections: Section[]) {
  const out: Section[][] = [];
  let cur: Section[] = [], sum = 0;
  for (const s of sections) {
    if (cur.length && (sum + s.len > BATCH_CHARS() || cur.length >= 5 || cur[0].part !== s.part)) { out.push(cur); cur = []; sum = 0; }
    cur.push(s); sum += s.len;
  }
  if (cur.length) out.push(cur);
  return out;
}

export async function generateLong(
  product: { id: string; title: string }, group: string, character: 'cheongung' | 'wolha', people: Person[],
  opts: { http?: typeof fetch; now?: Date; prev?: Partial<LongContent> | null; onProgress?: (c: LongContent) => Promise<void> } = {},
) {
  const http = opts.http ?? fetch;
  const plan = buildPlan(product, group, people, opts.now);
  const finalId = plan.sections.at(-1)!.id;
  const done = new Map<string, LongChapter>();
  for (const c of opts.prev?.chapters ?? []) if (c?.body) done.set(c.id, c as LongChapter);
  if (opts.prev?.closing?.body) done.set(finalId, { id: finalId, title: opts.prev.closing.title, say: '', body: opts.prev.closing.body, highlight: '', part: plan.sections.at(-1)!.part });
  let intro = opts.prev?.intro ?? '';
  let tips: string[] = opts.prev?.closing?.tips ?? [];
  let tokensIn = 0, tokensOut = 0;
  const system = systemPrompt(character);

  const snapshot = (): LongContent => {
    const chapters = plan.sections.filter((s) => s.id !== finalId && done.has(s.id)).map((s) => ({ ...done.get(s.id)!, title: s.title, part: s.part }));
    const fin = done.get(finalId);
    return {
      version: 2, productId: product.id, title: product.title, character, generatedBy: 'ai', intro, parts: plan.parts, chapters,
      closing: { title: plan.sections.at(-1)!.title, body: fin?.body ?? '', tips },
      people: people.map((p) => ({ name: p.name, gender: p.gender, birth: birthText(p) })), reports: plan.reports, pillars: plan.sajus.map((s) => s.pillars),
      tojeong: plan.tojeong, progress: { done: done.size, total: plan.sections.length },
    };
  };

  const todo = batchesOf(plan.sections.filter((s) => !done.has(s.id)));
  const runBatch = async (batch: Section[]) => {
    const facts = [...new Set(batch.flatMap((s) => factLines(s.facts, s, people, plan.sajus, plan.reports, plan.tojeong)))];
    const wantIntro = batch[0].id === plan.sections[0].id && !intro;
    const wantTips = batch.some((s) => s.id === finalId);
    const extras = (wantIntro ? '\n\n추가로 JSON 에 "intro"(감정서 첫머리 인사, 250~350자, 이름을 부르며 이 감정서를 어떻게 읽으면 좋은지)도 넣는다.' : '')
      + (wantTips ? '\n\n추가로 JSON 에 "tips"(평생 기억할 실천 조언 3개, 각 40자 안팎) 배열도 넣는다.' : '');
    const sum = batch.reduce((a, s) => a + s.len, 0);
    const maxTokens = Math.min(32000, Math.ceil(sum * 2.2) + 2000);
    const res = await callClaudeLong(system, userPrompt(product, people, plan.sections, batch, facts, plan.parts, extras), maxTokens, http);
    tokensIn += res.tokensIn; tokensOut += res.tokensOut;
    if (wantIntro && res.json.intro) intro = String(res.json.intro);
    if (wantTips && Array.isArray(res.json.tips)) tips = res.json.tips.map(String).slice(0, 3);
    const got = new Map<string, any>((res.json.sections ?? []).map((x: any) => [String(x.id), x]));
    const short: Section[] = [];
    for (const s of batch) {
      const x = got.get(s.id);
      if (!x?.body || String(x.body).length < s.len * 0.5) { short.push(s); continue; }
      done.set(s.id, { id: s.id, title: s.title, say: String(x.say ?? ''), body: String(x.body), highlight: String(x.highlight ?? ''), part: s.part });
    }
    // 빠졌거나 많이 짧은 장은 한 장씩 한 번 더
    for (const s of short) {
      const one = await callClaudeLong(system, userPrompt(product, people, plan.sections, [s], factLines(s.facts, s, people, plan.sajus, plan.reports, plan.tojeong), plan.parts, ''), Math.min(16000, Math.ceil(s.len * 2.4) + 1500), http);
      tokensIn += one.tokensIn; tokensOut += one.tokensOut;
      const x = (one.json.sections ?? [])[0];
      if (x?.body) done.set(s.id, { id: s.id, title: s.title, say: String(x.say ?? ''), body: String(x.body), highlight: String(x.highlight ?? ''), part: s.part });
    }
    await opts.onProgress?.(snapshot());
  };
  // 묶음들을 동시에(호출 수는 READING_CONCURRENCY 로 제한). 하나가 실패해도 나머지는 끝까지 쓰고 마지막에 오류
  const results = await Promise.allSettled(todo.map(runBatch));
  const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
  const content = snapshot();
  const rate = { inp: +(process.env.AI_PRICE_IN_PER_M ?? 2), out: +(process.env.AI_PRICE_OUT_PER_M ?? 10) };
  const costKrw = Math.round(((tokensIn * rate.inp + tokensOut * rate.out) / 1e6) * 1400);
  if (failed || done.size < plan.sections.length) {
    throw Object.assign(new Error(failed ? (failed.reason as Error).message : `미완성 ${done.size}/${plan.sections.length}`), { partial: content, tokensIn, tokensOut, costKrw });
  }
  delete content.progress;
  content.issues = longQuality([...content.chapters, { id: finalId, title: content.closing.title, say: '', body: content.closing.body, highlight: '', part: 0 }], plan.sections, people.map((p) => p.name));
  return { content, tokensIn, tokensOut, costKrw, plan };
}

// AI 키가 없을 때(예시) — 표·목차 구조만 보여 주는 짧은 예시 풀이에 정통 분석 표를 붙인다
export function reportsFor(people: Person[], now = new Date()) {
  const sajus = people.map((p) => calcSaju({ ...p, leapMonth: p.leap, timeUnknown: p.hour == null }, { now }));
  return { reports: sajus.map((s) => analyzeSaju(s, now)), pillars: sajus.map((s) => s.pillars), people: people.map((p) => ({ name: p.name, gender: p.gender, birth: birthText(p) })) };
}

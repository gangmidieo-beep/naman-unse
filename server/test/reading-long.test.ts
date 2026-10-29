// A4 40~50장 정통 감정서 — 목차 펼치기(전 상품), 묶음 생성·진행 저장·재시도·이어쓰기, 중복 검사
import { describe, it, expect } from 'vitest';
import { analyzeSaju, calcSaju } from '@naman/engine';
import { batchesOf, buildPlan, generateLong, longQuality, parseLooseJson } from '../src/services/reading/long.ts';
import { groupOf, characterOf } from '../src/services/reading/generate.ts';
import brand from '../../brand.config.json' with { type: 'json' };

const PAID = [...(brand as any).fate, ...(brand as any).love].map((p: any) => ({ id: p.id, title: p.title }));
const ME = { name: '김현재', gender: 'M' as const, year: 1988, month: 5, day: 21, calendar: 'solar' as const, hour: 9 };
const YOU = { name: '이수진', gender: 'F' as const, year: 1989, month: 11, day: 2, calendar: 'lunar' as const, hour: null };
const NOW = new Date('2026-10-13T10:00:00+09:00');

// 가짜 AI: 프롬프트의 "id "..." · 목표 N자" 를 읽어 그 분량만큼 서로 다른 문장으로 채운다
const write = (id: string, len: number, name: string) => {
  let t = '', i = 0;
  while (t.length < len) t += `${name} 님의 ${id} 장 ${i++}번째 문장은 원국의 근거를 들어 새롭게 풀이한 내용입니다. `;
  return t;
};
function fakeAI(opts: { failIds?: string[]; rateLimitFirst?: boolean; log?: string[]; truncateBatches?: boolean; rawNewlines?: boolean; timeoutBatches?: boolean } = {}) {
  let calls = 0, limited = false;
  const fn = (async (_u: string, init: any) => {
    calls++;
    if (opts.rateLimitFirst && !limited) { limited = true; return new Response('{}', { status: 429, headers: { 'retry-after': '0' } }); }
    const body = JSON.parse(init.body);
    const u: string = body.messages[0].content;
    const items = [...u.matchAll(/- id "([^"]+)" · 제목 "[^"]*" · 목표 (\d+)자/g)].map((m) => ({ id: m[1], len: +m[2] }));
    opts.log?.push(items.map((x) => x.id).join(','));
    if (items.some((x) => opts.failIds?.includes(x.id))) return new Response('{}', { status: 500 });
    if (opts.timeoutBatches && items.length > 1) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    // 여러 장 묶음이 글자 수 한도에서 잘려 JSON 이 깨진 경우(2026-10-29 실서버)
    if (opts.truncateBatches && items.length > 1) return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"sections":[{"id":"' + items[0].id + '","body":"잘린 글' }], usage: { input_tokens: 3000, output_tokens: 9000 }, stop_reason: 'max_tokens' }));
    const name = u.match(/사람: ([^(]+)\(/)?.[1] ?? '';
    const json: any = { sections: items.map((x) => ({ id: x.id, summary: '핵심 요약', body: write(x.id, x.len, name), points: ['장점 하나', '장점 둘'], caution: '주의점입니다.', advice: '조언입니다.', line: '한 줄 정리' })) };
    if (u.includes('"intro"')) json.intro = `${name} 님, 반갑습니다.`;
    if (u.includes('"tips"')) json.tips = ['하나', '둘', '셋'];
    // 문자열 안에 실제 줄바꿈이 들어간(규칙 위반) JSON 도 읽어야 함
    const text = opts.rawNewlines ? JSON.stringify(json).replace(/입니다\. /g, '입니다.\n') : JSON.stringify(json);
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 3000, output_tokens: 5000 }, stop_reason: 'end_turn' }));
  }) as unknown as typeof fetch;
  return { fn, calls: () => calls };
}

describe('정통 분석 데이터', () => {
  it('원국 상세·신강약·용신·대운·세운 10년·월운 12달', () => {
    const r = analyzeSaju(calcSaju({ ...ME }), NOW);
    expect(r.rows.filter((x: any) => !x.empty)).toHaveLength(4);
    expect(['신강', '신약', '중화']).toContain(r.strength.label);
    expect(['목', '화', '토', '금', '수']).toContain(r.yongsin.yong);
    expect(r.daewoon.length).toBeGreaterThanOrEqual(8);
    expect(r.daewoon.filter((d) => d.current)).toHaveLength(1);
    expect(r.seun).toHaveLength(10);
    expect(r.seun[0].year).toBe(2026);
    expect(r.months).toHaveLength(12);
    expect(r.months[0].text).toBe('경인'); // 2026 병오년 인월 = 경인
    const t = analyzeSaju(calcSaju({ ...YOU, timeUnknown: true } as any), NOW);
    expect((t.rows[0] as any).empty).toBe(true);
  });
});

describe('목차: 유료 26종 모두 A4 40~50장 분량', () => {
  it('장 수·목표 글자 수·중복 없는 제목', () => {
    for (const p of PAID) {
      const g = groupOf(p.id);
      const plan = buildPlan(p, g, g === 'pair' ? [ME, YOU] : [ME], NOW);
      const sum = plan.sections.reduce((a, s) => a + s.len, 0);
      expect(plan.sections.length, p.id).toBeGreaterThanOrEqual(30);
      expect(sum, p.id).toBeGreaterThanOrEqual(29000);
      expect(sum, p.id).toBeLessThanOrEqual(42000);
      expect(new Set(plan.sections.map((s) => s.id)).size, p.id).toBe(plan.sections.length);
      expect(new Set(plan.sections.map((s) => s.title)).size, p.id).toBe(plan.sections.length);
      expect(JSON.stringify(plan.sections), p.id).not.toMatch(/\{(theme|year|dm|name|name1|name2|order|text)\}/);
    }
  });
  it('묶음은 4,500자 안팎·같은 부끼리', () => {
    const plan = buildPlan({ id: 'jeongtong', title: '정통운세' }, 'life', [ME], NOW);
    for (const b of batchesOf(plan.sections)) {
      expect(new Set(b.map((s) => s.part)).size).toBe(1);
      expect(b.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('장편 생성', () => {
  const env = () => Object.assign(process.env, { READING_AI: 'live', ANTHROPIC_API_KEY: 'test', ANTHROPIC_MODEL: 'test-model' });
  const clear = () => { for (const k of ['READING_AI', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']) delete process.env[k]; };

  it('정통운세: 모든 장 작성·서론·당부·진행 저장·중복 없음·원가', async () => {
    env();
    const ai = fakeAI({ rateLimitFirst: true });
    const progress: number[] = [];
    const g = await generateLong({ id: 'jeongtong', title: '정통운세' }, 'life', characterOf('jeongtong'), [ME], { http: ai.fn, now: NOW, onProgress: async (c) => { progress.push(c.progress!.done); } });
    clear();
    expect(g.content.chapters.length + 1).toBe(g.plan.sections.length);
    expect(g.content.intro).toContain('김현재');
    expect(g.content.closing.tips).toHaveLength(3);
    expect(g.content.closing.body.length).toBeGreaterThan(500);
    expect(g.content.parts.length).toBe(5);
    expect(g.content.reports[0].daewoon.length).toBeGreaterThanOrEqual(8);
    expect(progress.at(-1)).toBe(g.plan.sections.length);
    expect(g.content.issues).toEqual([]);
    expect(g.content.chapters[0]).toMatchObject({ say: '핵심 요약', highlight: '한 줄 정리', points: ['장점 하나', '장점 둘'], caution: '주의점입니다.', advice: '조언입니다.' }); // 장 구성: 요약 → 본문 → 포인트 → 주의·조언 → 한 줄
    expect(g.costKrw).toBeGreaterThan(0);
    const chars = g.content.chapters.reduce((a, c) => a + c.body.length, 0);
    expect(chars).toBeGreaterThan(30000);
  });

  it('궁합: 두 사람 명식·두 사람 이름', async () => {
    env();
    const g = await generateLong({ id: 'gunghap', title: '정통궁합' }, 'pair', 'wolha', [ME, YOU], { http: fakeAI().fn, now: NOW });
    clear();
    expect(g.content.parts[0].title).toContain('김현재');
    expect(g.content.parts[1].title).toContain('이수진');
    expect(g.content.reports).toHaveLength(2);
  });

  it('일부 묶음 실패 → 끝난 장은 남기고 오류, 다음 시도는 남은 장만', async () => {
    env();
    const fail = fakeAI({ failIds: ['l_wealth1'] });
    let err: any;
    try { await generateLong({ id: 'jeongtong', title: '정통운세' }, 'life', 'cheongung', [ME], { http: fail.fn, now: NOW }); } catch (e) { err = e; }
    expect(err?.partial?.chapters.length).toBeGreaterThan(20);
    const log: string[] = [];
    const ok = fakeAI({ log });
    const g = await generateLong({ id: 'jeongtong', title: '정통운세' }, 'life', 'cheongung', [ME], { http: ok.fn, now: NOW, prev: err.partial });
    clear();
    expect(log.join(',')).toContain('l_wealth1');
    expect(log.join(',')).not.toContain('b_overview');
    expect(g.content.chapters.length + 1).toBe(g.plan.sections.length);
  });

  it('묶음 응답이 잘려 JSON 이 깨져도 멈추지 않고 한 장씩 나눠 끝까지 쓴다(2026-10-29)', async () => {
    env();
    const log: string[] = [];
    const g = await generateLong({ id: 'jeongtong', title: '정통운세' }, 'life', 'cheongung', [ME], { http: fakeAI({ truncateBatches: true, log }).fn, now: NOW });
    clear();
    expect(g.content.chapters.length + 1).toBe(g.plan.sections.length);
    expect(g.content.intro).toContain('김현재');
    expect(g.content.closing.tips).toHaveLength(3);
    expect(log.some((x) => !x.includes(','))).toBe(true); // 한 장씩 다시 요청
    // 잘린 응답도 요금이 나가므로 원가에 포함(묶음 수 × 잘린 응답 9000 토큰 이상)
    const multi = log.filter((x) => x.includes(',')).length;
    expect(g.tokensOut).toBeGreaterThanOrEqual(multi * 9000 + (log.length - multi) * 5000);
  });
  it('묶음 응답이 시간 초과되면 같은 요청을 다시 보내지 않고 한 장씩 나눠 쓴다', async () => {
    env();
    const log: string[] = [];
    const g = await generateLong({ id: 'wealth', title: '재물운' }, 'theme', 'cheongung', [ME], { http: fakeAI({ timeoutBatches: true, log }).fn, now: NOW });
    clear();
    expect(g.content.chapters.length + 1).toBe(g.plan.sections.length);
    const multi = log.filter((x) => x.includes(','));
    expect(new Set(multi).size).toBe(multi.length); // 같은 묶음을 두 번 보내지 않음
  });
  it('문자열 안 줄바꿈이 섞인 JSON 도 읽는다', async () => {
    expect(parseLooseJson('앞말 {"a":"첫 줄\n둘째 줄","b":[1,2,]} 뒷말')).toEqual({ a: '첫 줄\n둘째 줄', b: [1, 2] });
    expect(parseLooseJson('{"a":"잘린')).toBeNull();
    env();
    const g = await generateLong({ id: 'gunghap', title: '정통궁합' }, 'pair', 'wolha', [ME, YOU], { http: fakeAI({ rawNewlines: true }).fn, now: NOW });
    clear();
    expect(g.content.chapters.length + 1).toBe(g.plan.sections.length);
  });
  it('중복 문장·분량 부족을 찾아낸다', () => {
    const plan = buildPlan({ id: 'wealth', title: '재물운' }, 'theme', [ME], NOW).sections;
    const same = '김현재 님의 재물은 월지 편재에서 시작되어 꾸준히 늘어나는 흐름이오.';
    const ch = [
      { id: plan[0].id, title: plan[0].title, say: '', body: same + ' ' + write('a', plan[0].len, '김현재'), highlight: '', part: 0 },
      { id: plan[1].id, title: plan[1].title, say: '', body: same + ' 짧소.', highlight: '', part: 0 },
    ];
    const issues = longQuality(ch, plan, ['김현재']).join('\n');
    expect(issues).toContain('중복 문장');
    expect(issues).toContain('분량 부족');
  });
});

describe('PDF 내려받기', () => {
  it('완성된 정통 감정서 → 10분 링크 → A4 PDF, 남의 주문·미완성은 안 됨', async () => {
    const { openDb } = await import('../src/db/index.ts');
    const { buildApp } = await import('../src/app.ts');
    const { schema: S } = await import('../src/db/index.ts');
    const { eq } = await import('drizzle-orm');
    process.env.CHROMIUM_PATH ||= '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
    const o = await openDb({ dir: 'memory' });
    const { app } = await buildApp({ db: o.db });
    try {
      const t = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'pdf-1' } })).json().token;
      const h = { authorization: `Bearer ${t}` };
      const prof = (await app.inject({ method: 'POST', url: '/profiles', headers: h, payload: { ...ME, isMain: true } })).json();
      const ord = (await app.inject({ method: 'POST', url: '/orders', headers: h, payload: { productId: 'jeongtong', profileId: prof.id } })).json();
      expect((await app.inject({ method: 'POST', url: `/readings/${ord.id}/pdf-link`, headers: h })).statusCode).toBe(409); // 아직 미완성
      Object.assign(process.env, { READING_AI: 'live', ANTHROPIC_API_KEY: 'test', ANTHROPIC_MODEL: 'test-model' });
      const g = await generateLong({ id: 'jeongtong', title: '정통운세' }, 'life', 'cheongung', [ME], { http: fakeAI().fn, now: NOW });
      for (const k of ['READING_AI', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']) delete process.env[k];
      await o.db.update(S.readings).set({ status: 'done', content: g.content as any, doneAt: new Date() }).where(eq(S.readings.orderId, ord.id));
      const other = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'pdf-2' } })).json().token;
      expect((await app.inject({ method: 'POST', url: `/readings/${ord.id}/pdf-link`, headers: { authorization: `Bearer ${other}` } })).statusCode).toBe(404);
      const link = (await app.inject({ method: 'POST', url: `/readings/${ord.id}/pdf-link`, headers: h })).json().url as string;
      expect(link).toMatch(/\/pdf\?t=[\w.-]+$/);
      const u = new URL(link, 'http://x');
      const res = await app.inject({ url: u.pathname + u.search });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(String(res.headers['content-disposition'])).toContain(encodeURIComponent('나만의운세_정통운세'));
      const pages = (res.rawPayload.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      expect(pages).toBeGreaterThanOrEqual(35); // 가짜 글은 문단 나눔이 없어 실제(약 43~49장)보다 빽빽함
      expect(pages).toBeLessThanOrEqual(55);
      expect((await app.inject({ url: `/pdf?t=${t}` })).statusCode).toBe(410); // 사용자 토큰으로는 못 받음
    } finally { await app.close(); await o.close(); }
  }, 120_000);
});

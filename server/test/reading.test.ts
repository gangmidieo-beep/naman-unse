// 11 유료 풀이 — 장 구성 26종, 프롬프트 내용, 예시 생성 흐름(결제 → 워커 → 결과 조회), 품질 검사, AI 응답 처리
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openDb } from '../src/db/index.ts';
import { buildApp } from '../src/app.ts';
import { calcSaju } from '@naman/engine';
import { buildPrompt, chaptersFor, characterOf, checkQuality, generateReading, sampleContent, startReadingWorker } from '../src/services/reading/generate.ts';
import brand from '../../brand.config.json' with { type: 'json' };

const PAID = [...(brand as any).fate, ...(brand as any).love].map((p: any) => ({ id: p.id, title: p.title }));
const ME = { name: '김현재', gender: 'M' as const, year: 1988, month: 5, day: 21, calendar: 'solar' as const, hour: 9 };
const YOU = { name: '이수진', gender: 'F' as const, year: 1989, month: 11, day: 2, calendar: 'lunar' as const, hour: null };

describe('장 구성·프롬프트', () => {
  it('유료 26종 모두 장 목록이 있고 캐릭터가 맞다', () => {
    expect(PAID).toHaveLength(26);
    for (const p of PAID) expect(chaptersFor(p.id, p.title).length).toBeGreaterThanOrEqual(6);
    expect(characterOf('jeongtong')).toBe('cheongung');
    expect(characterOf('gunghap')).toBe('wolha');
    expect(chaptersFor('wealth', '재물운')[0]).toBe('타고난 기운으로 본 재물운');
  });
  it('프롬프트: 원국·말투·금지 규칙·장 순서, 궁합은 두 사람, 토정비결은 괘 번호', () => {
    const s = [calcSaju({ ...ME }), calcSaju({ ...YOU, timeUnknown: true })];
    const a = buildPrompt({ id: 'gunghap', title: '정통궁합' }, [ME, YOU], s, chaptersFor('gunghap', '정통궁합'));
    expect(a.system).toContain('월하선녀');
    expect(a.system).toContain('반드시·무조건');
    expect(a.user).toContain('김현재');
    expect(a.user).toContain('이수진');
    expect(a.user).toContain(s[0].pillars.day.hanja);
    const t = buildPrompt({ id: 'tojeong', title: '토정비결' }, [ME], [s[0]], chaptersFor('tojeong', '토정비결'), undefined, new Date('2026-12-01'));
    expect(t.user).toMatch(/토정비결 괘: \d{3}번/);
    expect(t.system).toContain('천궁도사');
  });
  it('품질 검사: 이름 누락·금지 표현·말투', () => {
    const c = sampleContent({ id: 'jeongtong', title: '정통운세' }, [ME]);
    expect(checkQuality(c, ['김현재'], chaptersFor('jeongtong', '정통운세'))).toEqual([]);
    const bad = { ...c, chapters: c.chapters.map((x, i) => (i === 0 ? { ...x, body: x.body + ' 반드시 큰돈을 잃소.' } : x)) };
    expect(checkQuality(bad, ['김현재'], chaptersFor('jeongtong', '정통운세')).join()).toContain('금지 표현');
    expect(checkQuality(c, ['없는이름'], chaptersFor('jeongtong', '정통운세')).join()).toContain('이름 누락');
  });
  it('(READING_LONG=off) AI 응답(가짜) → 두 번에 나눠 호출, 장 합치기, 원가 계산', async () => {
    Object.assign(process.env, { READING_AI: 'live', ANTHROPIC_API_KEY: 'test', ANTHROPIC_MODEL: 'test-model', READING_LONG: 'off' }); // 예전 9장 방식
    let n = 0;
    const fake = (async (_u: string, init: any) => {
      n++;
      const body = JSON.parse(init.body);
      const titles = [...body.messages[0].content.matchAll(/\d+\. ([^/\n]+?)(?= \/|\n|$)/g)].map((m: any) => m[1].trim());
      const ch = titles.map((t: string) => ({ title: t, say: '한 줄', body: '김현재 님은 큰 나무 같은 기운을 지녔소. '.repeat(12), highlight: '뿌리가 깊은 나무요' }));
      const json = { intro: n === 1 ? '김현재 님, 반갑소.' : '', chapters: ch, closing: n === 2 ? { title: '마무리 조언', body: '김현재 님, 평안하시게.', tips: ['아침에 걸으시게.'] } : { title: '', body: '', tips: [] } };
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 2000, output_tokens: 3000 } }));
    }) as unknown as typeof fetch;
    const g = await generateReading({ id: 'jeongtong', title: '정통운세' }, [ME], { http: fake });
    for (const k of ['READING_AI', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'READING_LONG']) delete process.env[k];
    expect(n).toBe(2);
    expect(g.content.chapters).toHaveLength(9);
    expect(g.content.generatedBy).toBe('ai');
    expect(g.tokensIn).toBe(4000);
    expect(g.costKrw).toBeGreaterThan(0);
    expect(g.issues).toEqual([]);
  });
});

describe('결제 → 풀이 생성 → 결과 조회 (예시 모드)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let db: any, close: () => Promise<void>;
  beforeAll(async () => { const o = await openDb({ dir: 'memory' }); db = o.db; close = o.close; ({ app } = await buildApp({ db })); }, 120_000);
  afterAll(async () => { await app.close(); await close(); });
  it('주문(mock) → 워커 → done, 내 이름으로 풀이, 원가는 숨김, 남의 주문은 못 봄', async () => {
    const t = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'rd-1' } })).json().token;
    const h = { authorization: `Bearer ${t}` };
    const prof = (await app.inject({ method: 'POST', url: '/profiles', headers: h, payload: { ...ME, isMain: true } })).json();
    const o = (await app.inject({ method: 'POST', url: '/orders', headers: h, payload: { productId: 'wealth', profileId: prof.id } })).json();
    expect((await app.inject({ url: `/readings/${o.id}`, headers: h })).json().status).toBe('queued');
    const w = startReadingWorker(db, { warn: () => {} });
    await w.tick(); w.stop();
    const r = (await app.inject({ url: `/readings/${o.id}`, headers: h })).json();
    expect(r.status).toBe('done');
    expect(r.content.chapters[0].title).toBe('타고난 기운으로 본 재물운');
    expect(JSON.stringify(r.content)).toContain('김현재');
    expect(r.costKrw).toBeUndefined();
    const other = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'rd-2' } })).json().token;
    expect((await app.inject({ url: `/readings/${o.id}`, headers: { authorization: `Bearer ${other}` } })).statusCode).toBe(404);
  });

  // 2026-10-29 실서버 비용 사고(감정서 1건 약 10달러) 재발 방지
  const S = () => import('../src/db/schema.ts');
  const order = async (dev: string, withProfile = true) => {
    const t = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: dev } })).json().token;
    const h = { authorization: `Bearer ${t}` };
    const prof = withProfile ? (await app.inject({ method: 'POST', url: '/profiles', headers: h, payload: { ...ME, isMain: true } })).json() : null;
    const o = (await app.inject({ method: 'POST', url: '/orders', headers: h, payload: { productId: 'wealth', ...(prof ? { profileId: prof.id } : {}) } })).json();
    return { h, o, prof };
  };
  const live = (calls: { n: number }) => {
    Object.assign(process.env, { READING_AI: 'live', ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_MODEL: 'test-model', READING_LONG: 'off' });
    return (async (_u: string, init: any) => {
      calls.n++;
      const titles = [...JSON.parse(init.body).messages[0].content.matchAll(/\d+\. ([^/\n]+?)(?= \/|$)/gm)].map((m) => m[1]);
      const text = JSON.stringify({ intro: '김현재 님', chapters: titles.map((t) => ({ title: t, say: '요약', body: '김현재 님의 '.repeat(60), highlight: '한 줄' })), closing: { title: '마무리 조언', body: '김현재 님 '.repeat(30), tips: ['a', 'b', 'c'] } });
      await new Promise((r) => setTimeout(r, 30));
      return new Response(JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 1000, output_tokens: 2000 } }));
    }) as unknown as typeof fetch;
  };
  const off = () => { for (const k of ['READING_AI', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'READING_LONG']) delete process.env[k]; };

  it('두 워커가 동시에 돌아도 한 건은 한 번만 쓴다(AI 호출 2번)', async () => {
    const { h, o } = await order('rd-dup');
    const calls = { n: 0 };
    const http = live(calls);
    const [w1, w2] = [startReadingWorker(db, { warn: () => {} }, http), startReadingWorker(db, { warn: () => {} }, http)];
    await Promise.all([w1.tick(), w2.tick()]); w1.stop(); w2.stop(); off();
    expect(calls.n).toBe(2);
    const r = (await app.inject({ url: `/readings/${o.id}`, headers: h })).json();
    expect(r.status).toBe('done');
  });
  it('환불된 주문은 AI 를 부르지 않고 cancelled', async () => {
    const { o } = await order('rd-ref');
    const { orders, readings } = await S();
    const { eq } = await import('drizzle-orm');
    await db.update(orders).set({ status: 'refunded' }).where(eq(orders.id, o.id));
    const calls = { n: 0 };
    const w = startReadingWorker(db, { warn: () => {} }, live(calls));
    await w.tick(); w.stop(); off();
    expect(calls.n).toBe(0);
    const [r] = await db.select().from(readings).where(eq(readings.orderId, o.id));
    expect(r.status).toBe('cancelled');
  });
  it('사주 정보가 없으면 예시 인물로 쓰지 않고 실패, 자동 재시도도 안 함', async () => {
    const { o, prof } = await order('rd-noprof');
    const { profiles, readings } = await S();
    const { eq } = await import('drizzle-orm');
    await db.delete(profiles).where(eq(profiles.id, prof.id));
    const calls = { n: 0 };
    const w = startReadingWorker(db, { warn: () => {} }, live(calls));
    await w.tick(); w.stop(); off();
    expect(calls.n).toBe(0);
    const [r] = await db.select().from(readings).where(eq(readings.orderId, o.id));
    expect(r.status).toBe('failed');
    expect(r.attempts).toBe(3);
  });
  it('원가 상한을 넘은 실패 건은 [다시 시도] 해도 다시 쓰지 않는다', async () => {
    const { h, o } = await order('rd-cap');
    const { readings } = await S();
    const { eq } = await import('drizzle-orm');
    await db.update(readings).set({ status: 'failed', costKrw: 9000, attempts: 1 }).where(eq(readings.orderId, o.id));
    const res = await app.inject({ method: 'POST', url: `/readings/${o.id}/retry`, headers: h, payload: {} });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('cost_cap');
  });
});

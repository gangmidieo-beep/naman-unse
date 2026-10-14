// 유료 타로 AI 풀이 — 주문 확인 · AI 꺼짐이면 503(화면은 카드 기본 문장) · 켜지면 질문·선택지를 반영해 한 번 만들고 저장 · 남의 주문은 못 봄
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { openDb } from '../src/db/index.ts';
import { buildApp } from '../src/app.ts';
import { tarotCards } from '../src/services/tarot.ts';

let app: Awaited<ReturnType<typeof buildApp>>['app'];
let close: () => Promise<void>;
beforeAll(async () => {
  const o = await openDb({ dir: 'memory' });
  close = o.close;
  ({ app } = await buildApp({ db: o.db, mock: true }));
}, 120_000);
afterAll(async () => { await app.close(); await close(); vi.unstubAllGlobals(); });
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('유료 타로 AI 풀이', () => {
  it('새 주제 8종이 상품으로 열리고 자리 수가 맞다', async () => {
    const ps = (await app.inject({ url: '/products' })).json() as any[];
    const want: Record<string, number> = { tarot_mind: 3, tarot_contact: 3, tarot_reunion: 5, tarot_newlove: 3, tarot_match: 6, tarot_choice: 5, tarot_job: 3, tarot_3month: 3 };
    for (const [id, n] of Object.entries(want)) {
      const p = ps.find((x) => x.id === id);
      expect(p, id).toBeTruthy();
      expect(p.meta.positions, id).toHaveLength(n);
    }
    expect(ps.find((x) => x.id === 'tarot_match').price).toBe(4900);
  });

  it('AI 꺼짐 → 503, 켜짐 → 질문·선택지 반영해 저장 → 다시 부르면 저장본', async () => {
    const t = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'tarot-ai' } })).json().token;
    const o = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: 'tarot_choice' } })).json();
    expect(o.status).toBe('paid');
    const url = `/tarot/${o.id}/reading`;
    expect((await app.inject({ method: 'POST', url, headers: auth(t), payload: {} })).statusCode).toBe(503);

    Object.assign(process.env, { READING_AI: 'live', ANTHROPIC_API_KEY: 'x', ANTHROPIC_MODEL: 'm' });
    let sent = '';
    vi.stubGlobal('fetch', async (_u: string, init: any) => {
      sent = JSON.parse(init.body).messages[0].content;
      const json = { positions: Array.from({ length: 5 }, (_, i) => ({ title: `자리${i}`, text: `해석${i}` })), summary: { title: '종합', text: 'B 쪽이 나아요.' }, advice: ['하나', '둘', '셋'], keywords: ['이직', '용기', '때'], answer: 'B를 고르세요' };
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(json) }], usage: { input_tokens: 800, output_tokens: 900 } }));
    });
    const r = await app.inject({ method: 'POST', url, headers: auth(t), payload: { question: '이직 제안을 받았어요', a: '남기', b: '옮기기' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().ai).toMatchObject({ answer: 'B를 고르세요', summary: { text: 'B 쪽이 나아요.' } });
    expect(r.json().ai.positions).toHaveLength(5);
    // 서버가 화면과 같은 카드를 AI 에 보냈는지(주문 번호 시드)
    const first = tarotCards(o.id, 'tarot_choice', 5)[0];
    expect(sent).toContain(first.card.nameEn);
    expect(sent).toContain('선택지 A: "남기"');
    // 다시 부르면 AI 를 또 부르지 않고 저장본
    vi.stubGlobal('fetch', async () => { throw new Error('다시 부르면 안 됨'); });
    const again = await app.inject({ method: 'POST', url, headers: auth(t), payload: { question: '다른 질문' } });
    expect(again.json().input.question).toBe('이직 제안을 받았어요');
    // 남의 주문은 못 봄
    const t2 = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'tarot-ai-2' } })).json().token;
    expect((await app.inject({ method: 'POST', url, headers: auth(t2), payload: {} })).statusCode).toBe(404);
    for (const k of ['READING_AI', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']) delete process.env[k];
  });
});

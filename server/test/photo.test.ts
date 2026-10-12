// 사진운세 — 결제한 주문만 AI 분석, 결과는 그 주문에 보관(같은 주문은 다시 AI 를 부르지 않음), 사진은 저장하지 않음, 2세는 Gemini
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openDb } from '../src/db/index.ts';
import { buildApp } from '../src/app.ts';

let app: Awaited<ReturnType<typeof buildApp>>['app'];
let close: () => Promise<void>;
const calls: string[] = [];
const fake = (async (url: string, init?: RequestInit) => {
  calls.push(String(url));
  const body = JSON.parse(String(init?.body ?? '{}'));
  if (String(url).includes('anthropic')) {
    const unclear = JSON.stringify(body).includes('UNCLEAR');
    const keys = ['life', 'head', 'heart', 'fate', 'sun', 'marriage', 'wealth'];
    const text = unclear ? '{"error":"unclear"}' : JSON.stringify({ intro: '손금을 보겠소.', sections: keys.map((k) => ({ key: k, body: `${k} 풀이 문장이오.` })), closing: '좋은 하루 되시게.' });
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 1500, output_tokens: 900 } }), { status: 200 });
  }
  if (String(url).includes('generativelanguage')) {
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'QUJD' } }] } }] }), { status: 200 });
  }
  return new Response('{}', { status: 404 });
}) as typeof fetch;
const img = 'data:image/jpeg;base64,AAAA';

beforeAll(async () => {
  Object.assign(process.env, { READING_AI: 'live', ANTHROPIC_API_KEY: 'test', ANTHROPIC_MODEL: 'claude-test', GEMINI_API_KEY: 'g-test' });
  const o = await openDb({ dir: 'memory' });
  close = o.close;
  ({ app } = await buildApp({ db: o.db, mock: true, http: fake }));
}, 120_000);
afterAll(async () => { await app.close(); await close(); delete process.env.GEMINI_API_KEY; });

async function guestOrder(productId: string) {
  const g = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: `dev-${productId}-${Math.random()}` } })).json();
  const h = { authorization: `Bearer ${g.token}` };
  const o = (await app.inject({ method: 'POST', url: '/orders', headers: h, payload: { productId } })).json();
  expect(o.status).toBe('paid');
  return { h, orderId: o.id as string };
}

describe('사진운세', () => {
  it('손금: 7개 선 AI 풀이 → 보관 → 같은 주문은 다시 부르지 않음', async () => {
    const { h, orderId } = await guestOrder('palm');
    const n0 = calls.length;
    const r = await app.inject({ method: 'POST', url: '/photo/analyze', headers: h, payload: { kind: 'palm', image: img, orderId } });
    expect(r.statusCode).toBe(200);
    const j = r.json();
    expect(j.generatedBy).toBe('ai');
    expect(j.sections.map((s: any) => s.title)).toEqual(['생명선', '두뇌선', '감정선', '운명선', '태양선', '결혼선', '재물선']);
    expect(calls.length).toBe(n0 + 1);
    const again = await app.inject({ method: 'POST', url: '/photo/analyze', headers: h, payload: { kind: 'palm', image: img, orderId } });
    expect(again.json().sections[0].body).toBe(j.sections[0].body);
    expect(calls.length).toBe(n0 + 1);
    const saved = (await app.inject({ url: `/readings/${orderId}`, headers: h })).json();
    expect(saved.content.photo.sections).toHaveLength(7);
    expect(JSON.stringify(saved)).not.toContain('AAAA'); // 사진은 저장하지 않음
  });
  it('남의 주문·다른 상품 주문으로는 분석 불가', async () => {
    const a = await guestOrder('face');
    const b = await guestOrder('palm');
    expect((await app.inject({ method: 'POST', url: '/photo/analyze', headers: b.h, payload: { kind: 'face', image: img, orderId: a.orderId } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/photo/analyze', headers: b.h, payload: { kind: 'face', image: img, orderId: b.orderId } })).statusCode).toBe(404);
  });
  it('2세 얼굴: 아들·딸 2장', async () => {
    const { h, orderId } = await guestOrder('baby');
    const r = await app.inject({ method: 'POST', url: '/photo/baby', headers: h, payload: { a: img, b: img, orderId } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ boy: 'data:image/png;base64,QUJD', girl: 'data:image/png;base64,QUJD', generatedBy: 'ai' });
    expect((await app.inject({ method: 'POST', url: '/photo/baby', headers: h, payload: { a: 'x', b: img, orderId } })).statusCode).toBe(400);
  });
});

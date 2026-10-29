// 운세함 동기화(2026-10-29): 부적 계정 보관 · 운세함에서 지우기(숨김) · 환불/숨김 주문은 목록에서 빠짐 · 실패 풀이 다시 쓰기
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openDb } from '../src/db/index.ts';
import { buildApp } from '../src/app.ts';

let app: Awaited<ReturnType<typeof buildApp>>['app'];
let close: () => Promise<void>;
beforeAll(async () => {
  const o = await openDb({ dir: 'memory' });
  close = o.close;
  ({ app } = await buildApp({ db: o.db, mock: true }));
}, 120_000);
afterAll(async () => { await app.close(); await close(); });
const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('운세함 동기화', () => {
  it('부적 보관 → 다른 기기에서도 보임, 지우면 모든 목록에서 빠짐', async () => {
    const t = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'box-1' } })).json().token;
    const tal = ((await app.inject({ url: '/products' })).json() as any[]).find((p) => p.kind === 'talisman');
    const o = (await app.inject({ method: 'POST', url: '/orders', headers: auth(t), payload: { productId: tal.id } })).json();
    expect(o.status).toBe('paid');
    // 남의 주문·다른 부적 id 로는 저장 불가
    expect((await app.inject({ method: 'POST', url: '/me/talismans', headers: auth(t), payload: { orderId: o.id, talismanId: 'x' } })).statusCode).toBe(404);
    const save = { id: 'tl_test1', orderId: o.id, talismanId: tal.id, name: '홍길동', birth: '1975.03.15', wish: '건강하게' };
    expect((await app.inject({ method: 'POST', url: '/me/talismans', headers: auth(t), payload: save })).json().id).toBe('tl_test1');
    expect((await app.inject({ method: 'POST', url: '/me/talismans', headers: auth(t), payload: { ...save, id: 'tl_dup' } })).json().id).toBe('tl_test1'); // 한 주문 한 장
    let e = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(e.owned.map((x: any) => x.orderId)).toContain(o.id);
    expect(e.talismans).toEqual([expect.objectContaining({ orderId: o.id, talismanId: tal.id, wish: '건강하게' })]);
    // 지우기 — 결제 기록은 남고(관리자) 손님 목록에서만 빠짐
    expect((await app.inject({ method: 'POST', url: `/me/orders/${o.id}/hide`, headers: auth(t) })).statusCode).toBe(200);
    e = (await app.inject({ url: '/me/entitlements', headers: auth(t) })).json();
    expect(e.owned.map((x: any) => x.orderId)).not.toContain(o.id);
    expect(e.talismans).toHaveLength(0);
    // 남의 주문은 지울 수 없음
    const t2 = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'box-2' } })).json().token;
    expect((await app.inject({ method: 'POST', url: `/me/orders/${o.id}/hide`, headers: auth(t2) })).statusCode).toBe(404);
  });
  it('실패한 풀이 다시 쓰기 — 결제된 내 주문만', async () => {
    const t = (await app.inject({ method: 'POST', url: '/auth/guest', payload: { deviceId: 'box-3' } })).json().token;
    expect((await app.inject({ method: 'POST', url: '/readings/nope/retry', headers: auth(t) })).statusCode).toBe(404);
  });
  it('/health 에 AI 진단 칸(값 없이)', async () => {
    const h = (await app.inject({ url: '/health' })).json();
    expect(h.ai).toHaveProperty('lastError');
    expect(h.ai).toHaveProperty('hint');
  });
});

// 3차 가격표(2026-10-14) — 이미 운영 중인 DB 의 예전 기본 회원가(정가×0.9)는 새 회원가로, 손금·관상은 4,900원으로 바뀌고,
// 관리자가 직접 정한 회원가는 그대로 남는다.
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, schema as S } from '../src/db/index.ts';
import { seedBase } from '../src/services/seed.ts';

describe('회원가 3차 가격표 이전', () => {
  it('예전 기본값만 바꾸고 관리자 값은 유지', async () => {
    const o = await openDb({ dir: 'memory' });
    await seedBase(o.db);
    const get = async (id: string) => (await o.db.select().from(S.products).where(eq(S.products.id, id)))[0];
    expect((await get('jeongtong')).memberPrice).toBe(26000); // 새 DB 는 처음부터 새 가격표
    // 운영 DB 흉내: 예전 기본값으로 되돌리고, 하나는 관리자가 직접 정한 값으로
    await o.db.update(S.products).set({ memberPrice: 26100 }).where(eq(S.products.id, 'jeongtong'));
    await o.db.update(S.products).set({ memberPrice: 12000 }).where(eq(S.products.id, 't_wealth'));
    await o.db.update(S.products).set({ price: 9900, memberPrice: 8910 }).where(eq(S.products.id, 'palm'));
    await seedBase(o.db);
    expect((await get('jeongtong')).memberPrice).toBe(26000);
    expect((await get('t_wealth')).memberPrice).toBe(12000);
    expect(await get('palm')).toMatchObject({ price: 4900, memberPrice: 4400 });
    await o.close();
  }, 120_000);
});

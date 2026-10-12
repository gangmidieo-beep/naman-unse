// 카탈로그 v2(대표님 2차 수정) — 예전 DB(부적 14종·타로 9,900원)를 한 번만 새 설정으로 맞추는지
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, schema as S } from '../src/db/index.ts';
import { seedBase } from '../src/services/seed.ts';

describe('카탈로그 v2 맞추기', () => {
  it('타로 3,000원 · 옛 부적 숨김 · 분류 4개 · 배너 이미지', async () => {
    const { db, close } = await openDb({ dir: 'memory' });
    await seedBase(db);
    // 예전 상태 흉내: 새 부적 없음, 옛 부적 있음, 타로 9,900원, 관리자 값
    await db.delete(S.products).where(eq(S.products.id, 't_jaesu'));
    await db.insert(S.products).values({ id: 't_luck', kind: 'talisman', title: '행운 부적', price: 9900 });
    await db.update(S.products).set({ price: 9900 }).where(eq(S.products.id, 'tarot_love'));
    await seedBase(db);
    const get = async (id: string) => (await db.select().from(S.products).where(eq(S.products.id, id)))[0];
    expect((await get('tarot_love')).price).toBe(3000);
    expect((await get('t_luck')).visible).toBe(false);
    expect((await get('t_jaesu')).price).toBe(9900);
    expect((await get('premium_monthly')).price).toBe(6900);
    const cats = await db.select().from(S.categories).where(eq(S.categories.tab, 'unse'));
    expect(cats.map((c) => c.id).sort()).toEqual(['fate', 'love', 'photo']);
    const ban = await db.select().from(S.banners).where(eq(S.banners.slot, 'home'));
    expect(ban).toHaveLength(10);
    expect(ban.every((b) => b.imageUrl?.startsWith('/img/v4/'))).toBe(true);
    // 두 번째부터는 건드리지 않음(관리자 수정 보존)
    await db.update(S.products).set({ price: 3500 }).where(eq(S.products.id, 'tarot_love'));
    await seedBase(db);
    expect((await get('tarot_love')).price).toBe(3500);
    await close();
  }, 60_000);
});

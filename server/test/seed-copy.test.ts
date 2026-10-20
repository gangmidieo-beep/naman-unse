// 상품 상세 문구 동기화(2026-10-20) — 운영 DB 에 예전 기본 문구가 남아 있으면 새 문구로 바꾸고, 관리자가 고친 문구는 그대로 둔다.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import detail from '../../packages/content/data/product-detail.json' with { type: 'json' };
import history from '../../packages/content/data/product-detail-history.json' with { type: 'json' };
import { openDb, schema as S } from '../src/db/index.ts';
import { seedBase } from '../src/services/seed.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const canon = (v: unknown): string => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as any)[k])}`).join(',')}}` : JSON.stringify(v));
const sha = (v: unknown) => createHash('sha1').update(canon(v)).digest('hex').slice(0, 16);

describe('상품 상세 문구 동기화', () => {
  it('지문 목록이 지금 문구를 포함(문구를 고치면 npm run copy:history)', () => {
    for (const [id, v] of Object.entries(detail)) if (!id.startsWith('_')) expect((history as Record<string, string[]>)[id], id).toContain(sha(v));
  });
  it('예전 기본 문구는 새 문구로, 관리자 문구는 그대로', async () => {
    const first = execSync('git log --format=%H -- packages/content/data/product-detail.json', { cwd: ROOT }).toString().trim().split('\n').pop()!;
    const old = JSON.parse(execSync(`git show ${first}:packages/content/data/product-detail.json`, { cwd: ROOT, maxBuffer: 1 << 26 }).toString());
    const o = await openDb({ dir: 'memory' });
    await seedBase(o.db);
    const get = async (id: string) => (await o.db.select({ d: S.products.detailCopy }).from(S.products).where(eq(S.products.id, id)))[0].d as any;
    await o.db.update(S.products).set({ detailCopy: old.jeongtong }).where(eq(S.products.id, 'jeongtong'));
    const mine = { ...old.pyeongsaeng, about: '대표님이 관리자에서 직접 쓴 설명' };
    await o.db.update(S.products).set({ detailCopy: mine }).where(eq(S.products.id, 'pyeongsaeng'));
    await seedBase(o.db);
    expect((await get('jeongtong')).about).toBe((detail as any).jeongtong.about);
    expect((await get('pyeongsaeng')).about).toBe('대표님이 관리자에서 직접 쓴 설명');
    await o.close();
  }, 120_000);
});

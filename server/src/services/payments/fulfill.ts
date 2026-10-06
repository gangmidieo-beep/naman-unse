// 결제 확정·취소를 한 곳에서 — 모든 결제 수단(mock·PayApp·Google Play)이 이 함수만 부른다. 두 번 불려도 결과가 같다(멱등).
import { and, eq, gt } from 'drizzle-orm';
import { schema as S, type Db } from '../../db/index.ts';
import { newId } from '../auth.ts';

type Order = typeof S.orders.$inferSelect;
const DAY = 86_400_000;
export const passDays = (productId: string) => (productId.includes('yearly') ? 365 : 30);

export async function fulfillOrder(db: Db, order: Order, opts: { ref?: string; method?: string; expiresAt?: Date; subStatus?: string } = {}): Promise<Order> {
  if (order.status === 'paid') return order;
  const [o] = await db.update(S.orders)
    .set({ status: 'paid', paidAt: new Date(), providerRef: opts.ref ?? order.providerRef, method: opts.method || order.method })
    .where(and(eq(S.orders.id, order.id), eq(S.orders.status, 'pending')))
    .returning();
  if (!o) { // 동시에 들어온 통보가 먼저 처리함
    const [cur] = await db.select().from(S.orders).where(eq(S.orders.id, order.id));
    return cur;
  }
  if (o.kind === 'subscription') {
    const plan = o.productId.includes('yearly') ? 'yearly' : 'monthly';
    const [cur] = await db.select().from(S.subscriptions)
      .where(and(eq(S.subscriptions.userId, o.userId), eq(S.subscriptions.channel, o.channel), gt(S.subscriptions.expiresAt, new Date())));
    if (cur) {
      // 웹 이용권은 남은 기간 뒤에 이어 붙이고, Google Play 는 Google 이 알려준 만료일을 그대로 쓴다
      const expiresAt = opts.expiresAt ?? new Date(cur.expiresAt.getTime() + passDays(o.productId) * DAY);
      await db.update(S.subscriptions).set({ plan, status: opts.subStatus ?? 'active', amount: o.amount, renewedAt: new Date(), expiresAt, canceledAt: null }).where(eq(S.subscriptions.id, cur.id));
    } else {
      await db.insert(S.subscriptions).values({
        id: newId('s_'), userId: o.userId, plan, status: opts.subStatus ?? 'active', channel: o.channel, amount: o.amount,
        expiresAt: opts.expiresAt ?? new Date(Date.now() + passDays(o.productId) * DAY),
      });
    }
  }
  if (o.kind === 'reading') {
    const [r] = await db.select({ id: S.readings.id }).from(S.readings).where(eq(S.readings.orderId, o.id));
    if (!r) await db.insert(S.readings).values({ id: newId('r_'), orderId: o.id, profileId: o.profileId, productId: o.productId, status: 'queued' });
  }
  return o;
}

// 취소·환불 → 주문 상태 변경 + 구독이면 즉시 이용 종료
export async function revokeOrder(db: Db, order: Order, status: 'cancelled' | 'refunded') {
  if (order.status === status) return order;
  const [o] = await db.update(S.orders).set({ status, refundStatus: status === 'refunded' ? 'done' : order.refundStatus }).where(eq(S.orders.id, order.id)).returning();
  if (order.status === 'paid' && o.kind === 'subscription') {
    await db.update(S.subscriptions).set({ status: 'expired', expiresAt: new Date(), canceledAt: new Date() })
      .where(and(eq(S.subscriptions.userId, o.userId), eq(S.subscriptions.channel, o.channel), gt(S.subscriptions.expiresAt, new Date())));
  }
  return o;
}

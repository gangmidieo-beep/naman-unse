// 결제 확정·취소를 한 곳에서 — 모든 결제 수단(mock·PayApp·Google Play)이 이 함수만 부른다. 두 번 불려도 결과가 같다(멱등).
import { and, eq, gt } from 'drizzle-orm';
import { schema as S, type Db } from '../../db/index.ts';
import { newId } from '../auth.ts';

type Order = typeof S.orders.$inferSelect;
const DAY = 86_400_000;
export const passDays = (productId: string) => (productId.includes('yearly') ? 365 : 30);

export async function fulfillOrder(db: Db, order: Order, opts: { ref?: string; method?: string; expiresAt?: Date; subStatus?: string; autoRenew?: boolean; rebillNo?: string } = {}): Promise<Order> {
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
    // 자동결제: 앱(Google Play) 구독은 기본 켜짐, 웹은 월 정기결제(rebillNo)일 때만
    const auto = { autoRenew: opts.autoRenew ?? (o.channel === 'google' || !!opts.rebillNo), ...(opts.rebillNo ? { rebillNo: opts.rebillNo } : {}) };
    const [cur] = await db.select().from(S.subscriptions)
      .where(and(eq(S.subscriptions.userId, o.userId), eq(S.subscriptions.channel, o.channel), gt(S.subscriptions.expiresAt, new Date())));
    if (cur) {
      // 웹 이용권은 남은 기간 뒤에 이어 붙이고, Google Play 는 Google 이 알려준 만료일을 그대로 쓴다.
      // 웹 월 자동결제(만료일 지정)가 연간 이용권 위에 들어와도 남은 기간을 줄이지 않는다(더 늦은 날 기준)
      const given = opts.expiresAt && o.channel !== 'google' && opts.expiresAt < cur.expiresAt ? cur.expiresAt : opts.expiresAt;
      const expiresAt = given ?? new Date(cur.expiresAt.getTime() + passDays(o.productId) * DAY);
      await db.update(S.subscriptions).set({ plan, status: opts.subStatus ?? 'active', amount: o.amount, renewedAt: new Date(), expiresAt, canceledAt: null, remindDay: null, ...auto }).where(eq(S.subscriptions.id, cur.id));
    } else {
      await db.insert(S.subscriptions).values({
        id: newId('s_'), userId: o.userId, plan, status: opts.subStatus ?? 'active', channel: o.channel, amount: o.amount,
        expiresAt: opts.expiresAt ?? new Date(Date.now() + passDays(o.productId) * DAY), ...auto,
      });
    }
  }
  if (o.kind === 'reading') {
    const [r] = await db.select({ id: S.readings.id }).from(S.readings).where(eq(S.readings.orderId, o.id));
    // 사주 풀이만 AI 대기열로. 타로는 화면에서 카드로 풀고(done), 사진 상품은 사진을 올릴 때 만든다(waiting) — 엉뚱하게 사주 풀이 AI 비용이 나가지 않게
    const [p] = await db.select({ kind: S.products.kind }).from(S.products).where(eq(S.products.id, o.productId));
    const status = p?.kind === 'tarot' ? 'done' : p?.kind === 'photo' ? 'waiting' : 'queued';
    if (!r) await db.insert(S.readings).values({ id: newId('r_'), orderId: o.id, profileId: o.profileId, productId: o.productId, status, ...(status === 'done' ? { content: { local: 'tarot' } as any, doneAt: new Date() } : {}) });
  }
  return o;
}

// 취소·환불 → 주문 상태 변경 + 구독이면 그 주문이 더해 준 기간만큼 줄임(남은 기간이 없으면 종료)
// 이미 환불·취소된 주문에 늦게 온 통보는 상태를 바꾸지 않는다(관리자 환불 후 PayApp 취소 통보로 '환불'이 '취소'로 바뀌던 문제)
export async function revokeOrder(db: Db, order: Order, status: 'cancelled' | 'refunded') {
  if (order.status === status || order.status === 'refunded' || order.status === 'cancelled') return order;
  const [o] = await db.update(S.orders).set({ status, refundStatus: status === 'refunded' ? 'done' : order.refundStatus }).where(eq(S.orders.id, order.id)).returning();
  if (order.status === 'paid' && o.kind === 'subscription') {
    const subs = await db.select().from(S.subscriptions).where(and(eq(S.subscriptions.userId, o.userId), eq(S.subscriptions.channel, o.channel), gt(S.subscriptions.expiresAt, new Date())));
    for (const s of subs) {
      // Google 은 Google 이 알려주는 상태가 기준(RTDN) → 바로 종료. 웹은 이 주문 몫(30일·365일)만 뺀다
      const left = o.channel === 'google' ? 0 : s.expiresAt.getTime() - passDays(o.productId) * DAY;
      // 자동결제 기간은 '다음 결제일 + 2일'이라 며칠 남는 자투리는 종료로 본다
      if (left > Date.now() + 3 * DAY) await db.update(S.subscriptions).set({ expiresAt: new Date(left) }).where(eq(S.subscriptions.id, s.id));
      else await db.update(S.subscriptions).set({ status: 'expired', expiresAt: new Date(), canceledAt: new Date(), autoRenew: false }).where(eq(S.subscriptions.id, s.id));
    }
  }
  return o;
}

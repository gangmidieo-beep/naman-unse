// 관리자 통계 — 한국 시간(KST) 날짜 기준. PGlite·PostgreSQL 모두 같은 SQL.
import { sql } from 'drizzle-orm';
import type { Db } from '../db/index.ts';

const KST = sql`'Asia/Seoul'`;
const rows = async <T>(db: Db, q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];

// 기간: today | yesterday | 7d | month | custom(from~to, YYYY-MM-DD)
export function range(period: string, from?: string, to?: string) {
  const kstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const shift = (d: string, n: number) => new Date(Date.parse(d) + n * 86400000).toISOString().slice(0, 10);
  if (period === 'yesterday') return { from: shift(kstToday, -1), to: shift(kstToday, -1) };
  if (period === '7d') return { from: shift(kstToday, -6), to: kstToday };
  if (period === 'month') return { from: kstToday.slice(0, 8) + '01', to: kstToday };
  if (period === 'custom' && from && to) return { from, to };
  return { from: kstToday, to: kstToday };
}
const inRange = (col: ReturnType<typeof sql>, r: { from: string; to: string }) =>
  sql`(${col} at time zone ${KST})::date between ${r.from}::date and ${r.to}::date`;

// 주문 매출 구분: 운명서(천궁도사) / 인연서(월하선녀) / 부적 / 구독
const BUCKET = sql`case when o.kind = 'subscription' then 'subscription' when o.kind = 'talisman' then 'talisman' when p.character = 'wolha' then 'love' else 'fate' end`;

export async function dashboard(db: Db, r: { from: string; to: string }) {
  const [cards] = await rows<any>(db, sql`
    select
      (select count(distinct coalesce(user_id, session_id)) from events e where e.name = 'page_view' and ${inRange(sql`e.created_at`, r)})::int as visitors,
      (select count(*) from users u where ${inRange(sql`u.created_at`, r)})::int as signups,
      (select count(*) from subscriptions s where s.status in ('active','grace') and s.expires_at > now())::int as premium,
      (select count(*) from orders o where o.status = 'paid' and ${inRange(sql`o.created_at`, r)})::int as orders,
      (select coalesce(sum(case when o.refund_status = 'done' then 0 else o.amount end), 0) from orders o where o.status = 'paid' and ${inRange(sql`o.created_at`, r)})::int as revenue`);
  const byKind = await rows<{ bucket: string; n: number; revenue: number }>(db, sql`
    select ${BUCKET} as bucket, count(*)::int as n, coalesce(sum(o.amount), 0)::int as revenue
    from orders o left join products p on p.id = o.product_id
    where o.status = 'paid' and ${inRange(sql`o.created_at`, r)} group by 1`);
  const daily = await rows<any>(db, sql`
    with days as (select generate_series(${r.from}::date, ${r.to}::date, interval '1 day')::date as d)
    select to_char(d, 'YYYY-MM-DD') as date,
      (select count(distinct coalesce(user_id, session_id)) from events e where e.name = 'page_view' and (e.created_at at time zone ${KST})::date = d)::int as visitors,
      (select count(*) from users u where (u.created_at at time zone ${KST})::date = d)::int as signups,
      (select count(*) from orders o where o.status = 'paid' and (o.created_at at time zone ${KST})::date = d)::int as orders,
      (select coalesce(sum(o.amount), 0) from orders o where o.status = 'paid' and (o.created_at at time zone ${KST})::date = d)::int as revenue
    from days order by d`);
  return { range: r, cards, byKind: Object.fromEntries(byKind.map((k) => [k.bucket, { n: k.n, revenue: k.revenue }])), daily };
}

export async function members(db: Db, q: { search?: string; tier?: string; limit?: number; offset?: number }) {
  const s = q.search ? `%${q.search}%` : null;
  return rows<any>(db, sql`
    select u.id, u.name, u.provider, u.platform, u.created_at, u.last_seen_at,
      exists(select 1 from subscriptions s where s.user_id = u.id and s.status in ('active','grace') and s.expires_at > now()) as premium,
      (select coalesce(sum(amount), 0) from orders o where o.user_id = u.id and o.status = 'paid')::int as paid_total,
      (select count(*) from profiles p where p.user_id = u.id)::int as profiles
    from users u
    where u.deleted_at is null and u.merged_into is null
      ${s ? sql`and (u.name ilike ${s} or u.id ilike ${s} or u.email ilike ${s})` : sql``}
      ${q.tier === 'premium' ? sql`and exists(select 1 from subscriptions s where s.user_id = u.id and s.status in ('active','grace') and s.expires_at > now())` : q.tier === 'free' ? sql`and not exists(select 1 from subscriptions s where s.user_id = u.id and s.status in ('active','grace') and s.expires_at > now())` : sql``}
    order by u.created_at desc limit ${q.limit ?? 50} offset ${q.offset ?? 0}`);
}
export async function memberDetail(db: Db, id: string) {
  const [user] = await rows<any>(db, sql`select * from users where id = ${id}`);
  if (!user) return null;
  return {
    user,
    profiles: await rows(db, sql`select * from profiles where user_id = ${id} order by created_at`),
    orders: await rows(db, sql`select o.*, p.title from orders o left join products p on p.id = o.product_id where o.user_id = ${id} order by o.created_at desc`),
    subscriptions: await rows(db, sql`select * from subscriptions where user_id = ${id} order by started_at desc`),
  };
}

export async function payments(db: Db, q: { kind?: string; status?: string; from?: string; to?: string; limit?: number }) {
  const r = q.from && q.to ? { from: q.from, to: q.to } : null;
  const kindCond = q.kind === 'fate' ? sql`and o.kind = 'reading' and p.character = 'cheongung'`
    : q.kind === 'love' ? sql`and o.kind = 'reading' and p.character = 'wolha'`
    : q.kind === 'talisman' ? sql`and o.kind = 'talisman'` : q.kind === 'subscription' ? sql`and o.kind = 'subscription'` : sql``;
  return rows<any>(db, sql`
    select o.id, o.created_at, o.user_id, u.name as user_name, o.product_id, p.title, o.amount, o.discount, o.method, o.channel, o.status, o.refund_status, ${BUCKET} as bucket
    from orders o left join products p on p.id = o.product_id left join users u on u.id = o.user_id
    where true ${kindCond} ${q.status ? sql`and o.status = ${q.status}` : sql``} ${r ? sql`and ${inRange(sql`o.created_at`, r)}` : sql``}
    order by o.created_at desc limit ${q.limit ?? 100}`);
}
export async function subscriptionStats(db: Db, r: { from: string; to: string }) {
  const [x] = await rows<any>(db, sql`
    select
      count(*) filter (where status in ('active','grace') and expires_at > now() and plan = 'monthly')::int as monthly,
      count(*) filter (where status in ('active','grace') and expires_at > now() and plan = 'yearly')::int as yearly,
      count(*) filter (where ${inRange(sql`started_at`, r)})::int as new,
      count(*) filter (where canceled_at is not null and ${inRange(sql`canceled_at`, r)})::int as canceled,
      count(*) filter (where renewed_at is not null and ${inRange(sql`renewed_at`, r)})::int as renewed,
      coalesce(sum(amount) filter (where ${inRange(sql`started_at`, r)}), 0)::int as revenue
    from subscriptions`);
  return x;
}

export async function contentStats(db: Db, r: { from: string; to: string }) {
  const views = await rows(db, sql`select props->>'content' as content, count(*)::int as n from events where name = 'content_view' and ${inRange(sql`created_at`, r)} group by 1 order by 2 desc`);
  const shares = await rows(db, sql`select props->>'channel' as channel, count(*)::int as n from events where name = 'share_click' and ${inRange(sql`created_at`, r)} group by 1 order by 2 desc`);
  const shareByContent = await rows(db, sql`select props->>'contentId' as content, count(*)::int as n from events where name = 'share_click' and ${inRange(sql`created_at`, r)} group by 1 order by 2 desc limit 20`);
  const [links] = await rows<any>(db, sql`select
      (select count(*) from events where name = 'share_link_open' and ${inRange(sql`created_at`, r)})::int as opens,
      (select coalesce(sum(clicks), 0) from share_links)::int as total_clicks`);
  const funnel = await rows(db, sql`select name, count(*)::int as n from events where name in ('product_view','checkout_open','pay_start','pay_success','pay_cancel','pay_fail') and ${inRange(sql`created_at`, r)} group by 1`);
  const [conv] = await rows<any>(db, sql`select
      (select count(distinct coalesce(user_id, session_id)) from events where name = 'page_view' and ${inRange(sql`created_at`, r)})::int as visitors,
      (select count(*) from users where provider is not null and ${inRange(sql`created_at`, r)})::int as signups,
      (select count(distinct user_id) from orders where status = 'paid' and ${inRange(sql`created_at`, r)})::int as payers`);
  const productRevenue = await rows(db, sql`select o.product_id, p.title, count(*)::int as n, coalesce(sum(o.amount), 0)::int as revenue from orders o left join products p on p.id = o.product_id where o.status = 'paid' and ${inRange(sql`o.created_at`, r)} group by 1, 2 order by 4 desc limit 30`);
  const dreamTop = await rows(db, sql`select props->>'q' as q, count(*)::int as n from events where name = 'dream_search' and ${inRange(sql`created_at`, r)} group by 1 order by 2 desc limit 20`);
  const sources = await rows(db, sql`select coalesce(utm_source, '(직접)') as source, count(distinct coalesce(user_id, session_id))::int as visitors from events where name = 'page_view' and ${inRange(sql`created_at`, r)} group by 1 order by 2 desc`);
  return { views, shares, shareByContent, links, funnel: Object.fromEntries((funnel as any[]).map((f) => [f.name, f.n])), conversion: conv, productRevenue, dreamTop, sources };
}

export const toCsv = (list: Record<string, unknown>[]) => {
  if (!list.length) return '';
  const keys = Object.keys(list[0]);
  const esc = (v: unknown) => { const s = v instanceof Date ? v.toISOString() : String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '﻿' + [keys.join(','), ...list.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
};

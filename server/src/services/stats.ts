// 관리자 통계 — 한국 시간(KST) 날짜 기준. PGlite·PostgreSQL 모두 같은 SQL.
import { sql } from 'drizzle-orm';
import type { Db } from '../db/index.ts';

const KST = sql`'Asia/Seoul'`;
// PGlite 는 { rows }, postgres-js(운영)는 배열을 돌려준다 — 둘 다 받는다
const rows = async <T>(db: Db, q: ReturnType<typeof sql>) => { const r = (await db.execute(q)) as unknown; return (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as T[]; };

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

// 주문 매출 구분 — 사이트 분류와 같게: 운명·사주(천궁도사) / 연애·궁합(월하선녀) / 사진운세 / 타로 / 부적 / 구독
// (타로·사진 주문도 orders.kind 는 'reading' 이라 상품 종류(p.kind)로 먼저 가른다)
const BUCKET = sql`case when o.kind = 'subscription' or p.kind = 'subscription' then 'subscription'
  when o.kind = 'talisman' or p.kind = 'talisman' then 'talisman'
  when p.kind = 'tarot' then 'tarot' when p.kind = 'photo' then 'photo'
  when p.character = 'wolha' then 'love' else 'fate' end`;
export const BUCKETS = ['fate', 'love', 'photo', 'tarot', 'talisman', 'subscription'] as const;

// 유입 경로 — 첫 방문 때 붙은 utm_source, 없으면 referrer 주소로 가른다
const SRC = sql`case
  when e.utm_source = 'share' then 'share'
  when coalesce(e.utm_source, '') <> '' then lower(e.utm_source)
  when e.referrer ilike '%kakao%' then 'kakao'
  when e.referrer ilike '%naver%' then 'naver'
  when e.referrer ilike '%google%' then 'google'
  when e.referrer ilike '%instagram%' then 'instagram'
  when e.referrer ilike '%facebook%' then 'facebook'
  when e.referrer ilike '%youtube%' then 'youtube'
  when e.referrer ilike '%daum%' then 'daum'
  when coalesce(e.referrer, '') = '' or e.referrer ilike '%myunse365%' then 'direct'
  else 'etc' end`;

export async function dashboard(db: Db, r: { from: string; to: string }) {
  const [cards] = await rows<any>(db, sql`
    select
      (select count(distinct coalesce(user_id, session_id)) from events e where e.name = 'page_view' and ${inRange(sql`e.created_at`, r)})::int as visitors,
      (select count(*) from users u where u.provider is not null and ${inRange(sql`u.created_at`, r)})::int as signups,
      (select count(*) from users u where u.provider is null and ${inRange(sql`u.created_at`, r)})::int as guests,
      (select count(*) from subscriptions s where s.status in ('active','grace') and s.expires_at > now())::int as premium,
      (select count(*) from orders o where o.status = 'paid' and ${inRange(sql`o.created_at`, r)})::int as orders,
      (select count(distinct o.user_id) from orders o where o.status = 'paid' and ${inRange(sql`o.created_at`, r)})::int as payers,
      (select coalesce(sum(case when o.refund_status = 'done' then 0 else o.amount end), 0) from orders o where o.status = 'paid' and ${inRange(sql`o.created_at`, r)})::int as revenue`);
  const byKind = await rows<{ bucket: string; n: number; revenue: number }>(db, sql`
    select ${BUCKET} as bucket, count(*)::int as n, coalesce(sum(case when o.refund_status = 'done' then 0 else o.amount end), 0)::int as revenue
    from orders o left join products p on p.id = o.product_id
    where o.status = 'paid' and ${inRange(sql`o.created_at`, r)} group by 1`);
  // 일별 표는 최근 366일까지만(기간을 아주 길게 골라도 느려지지 않게)
  const dFrom = Date.parse(r.to) - Date.parse(r.from) > 365 * 86400000 ? new Date(Date.parse(r.to) - 365 * 86400000).toISOString().slice(0, 10) : r.from;
  const daily = await rows<any>(db, sql`
    with days as (select generate_series(${dFrom}::date, ${r.to}::date, interval '1 day')::date as d)
    select to_char(d, 'YYYY-MM-DD') as date,
      (select count(distinct coalesce(user_id, session_id)) from events e where e.name = 'page_view' and (e.created_at at time zone ${KST})::date = d)::int as visitors,
      (select count(*) from users u where u.provider is not null and (u.created_at at time zone ${KST})::date = d)::int as signups,
      (select count(*) from orders o where o.status = 'paid' and (o.created_at at time zone ${KST})::date = d)::int as orders,
      (select coalesce(sum(o.amount), 0) from orders o where o.status = 'paid' and (o.created_at at time zone ${KST})::date = d)::int as revenue
    from days order by d`);

  // 구독 — 지금 이용 중(월간·연간) + 기간 중 신규·해지·갱신 + 월 환산 매출(연간은 12로 나눔)
  const [subs] = await rows<any>(db, sql`
    select
      count(*) filter (where status in ('active','grace') and expires_at > now() and plan = 'monthly')::int as monthly,
      count(*) filter (where status in ('active','grace') and expires_at > now() and plan = 'yearly')::int as yearly,
      count(*) filter (where status in ('active','grace') and expires_at > now() and auto_renew)::int as auto_renew,
      count(*) filter (where ${inRange(sql`started_at`, r)})::int as new,
      count(*) filter (where canceled_at is not null and ${inRange(sql`canceled_at`, r)})::int as canceled,
      count(*) filter (where renewed_at is not null and ${inRange(sql`renewed_at`, r)})::int as renewed,
      coalesce(sum(case when plan = 'yearly' then amount / 12.0 else amount end) filter (where status in ('active','grace') and expires_at > now()), 0)::int as mrr
    from subscriptions`);

  // 유입 경로별 방문 → 가입 → 결제 (첫 방문 경로 기준)
  const first = sql`
    select distinct on (vid) vid, uid, src from (
      select coalesce(e.user_id, e.session_id) as vid, e.user_id as uid, ${SRC} as src, e.created_at
      from events e where e.name = 'page_view' and coalesce(e.user_id, e.session_id) is not null) x
    order by vid, created_at`;
  const ufirst = sql`
    select distinct on (uid) uid, src from (
      select e.user_id as uid, ${SRC} as src, e.created_at from events e where e.user_id is not null and e.name = 'page_view') y
    order by uid, created_at`;
  const visits = await rows<{ src: string; visitors: number }>(db, sql`
    with f as (${first}), v as (select distinct coalesce(user_id, session_id) as vid from events where name = 'page_view' and ${inRange(sql`created_at`, r)})
    select f.src, count(*)::int as visitors from f join v on v.vid = f.vid group by 1`);
  const joins = await rows<{ src: string; signups: number }>(db, sql`
    with uf as (${ufirst})
    select coalesce(uf.src, 'direct') as src, count(*)::int as signups
    from users u left join uf on uf.uid = u.id where u.provider is not null and ${inRange(sql`u.created_at`, r)} group by 1`);
  const pays = await rows<{ src: string; payers: number; revenue: number }>(db, sql`
    with uf as (${ufirst})
    select coalesce(uf.src, 'direct') as src, count(distinct o.user_id)::int as payers, coalesce(sum(case when o.refund_status = 'done' then 0 else o.amount end), 0)::int as revenue
    from orders o left join uf on uf.uid = o.user_id where o.status = 'paid' and ${inRange(sql`o.created_at`, r)} group by 1`);
  const src: Record<string, { src: string; visitors: number; signups: number; payers: number; revenue: number }> = {};
  const at = (k: string) => (src[k] ??= { src: k, visitors: 0, signups: 0, payers: 0, revenue: 0 });
  for (const v of visits) at(v.src).visitors = v.visitors;
  for (const j of joins) at(j.src).signups = j.signups;
  for (const p of pays) Object.assign(at(p.src), { payers: p.payers, revenue: p.revenue });
  const sources = Object.values(src).sort((a, b) => b.visitors - a.visitors || b.revenue - a.revenue);

  // 웹·앱 — 방문자는 이벤트 플랫폼, 매출은 결제 경로(웹 PayApp · 앱 Google Play)
  const platform = await rows<any>(db, sql`
    select coalesce(platform, 'web') as platform, count(distinct coalesce(user_id, session_id))::int as visitors
    from events where name = 'page_view' and ${inRange(sql`created_at`, r)} group by 1`);
  const channel = await rows<any>(db, sql`
    select o.channel, count(*)::int as n, coalesce(sum(case when o.refund_status = 'done' then 0 else o.amount end), 0)::int as revenue
    from orders o where o.status = 'paid' and ${inRange(sql`o.created_at`, r)} group by 1`);
  const top = await rows<any>(db, sql`
    select o.product_id, p.title, ${BUCKET} as bucket, count(*)::int as n, coalesce(sum(case when o.refund_status = 'done' then 0 else o.amount end), 0)::int as revenue
    from orders o left join products p on p.id = o.product_id
    where o.status = 'paid' and o.kind <> 'subscription' and ${inRange(sql`o.created_at`, r)} group by 1, 2, 3 order by 5 desc limit 5`);

  return { range: r, cards, byKind: Object.fromEntries(byKind.map((k) => [k.bucket, { n: k.n, revenue: k.revenue }])), daily, subs, sources, platform, channel, top };
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

export async function payments(db: Db, q: { kind?: string; status?: string; from?: string; to?: string; limit?: number; q?: string }) {
  const r = q.from && q.to ? { from: q.from, to: q.to } : null;
  const kindCond = q.kind && (BUCKETS as readonly string[]).includes(q.kind) ? sql`and ${BUCKET} = ${q.kind}` : sql``;
  // 검색: 주문번호·회원 이름·회원 번호 일부
  const term = (q.q ?? '').trim().slice(0, 40);
  const search = term ? sql`and (o.id ilike ${'%' + term + '%'} or u.name ilike ${'%' + term + '%'} or o.user_id ilike ${'%' + term + '%'})` : sql``;
  // cost_krw = 그 주문 풀이의 AI 원가(원) · reading_status = 풀이 상태(대기·작성 중·완료·실패) — 비용 이상·멈춘 풀이를 관리자가 바로 보게
  return rows<any>(db, sql`
    select o.id, o.created_at, o.user_id, u.name as user_name, o.product_id, p.title, o.amount, o.discount, o.method, o.channel, o.status, o.refund_status, ${BUCKET} as bucket,
      rd.cost_krw, rd.status as reading_status
    from orders o left join products p on p.id = o.product_id left join users u on u.id = o.user_id left join readings rd on rd.order_id = o.id
    where true ${kindCond} ${search} ${q.status ? sql`and o.status = ${q.status}` : sql``} ${r ? sql`and ${inRange(sql`o.created_at`, r)}` : sql``}
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

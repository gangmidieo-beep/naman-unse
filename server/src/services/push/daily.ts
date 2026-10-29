// 매일 아침 자동 푸시 — 사용자가 고른 알림 시간(pushTime, 기본 07:00, 한국 시간)에 "오늘의 운세" 한 줄을 보낸다. 하루 한 번(lastDailyPush).
// 1분마다 돈다. 받는 조건: 푸시 동의 + 토큰 있음 + 탈퇴·합쳐짐 아님. 대표 사주(isMain, 없으면 첫 사주)가 있으면 그 사람의 오늘 한 줄, 없으면 공통 문구.
// FCM 키(FIREBASE_SERVICE_ACCOUNT_JSON_BASE64)가 없으면 보내지 않는다(발송 기록도 남기지 않아 키가 들어오면 그날부터 나간다).
import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { schema as S, type Db } from '../../db/index.ts';
import { sajuOf, todayFortune } from '../../../../packages/content/src/today/engine.ts';
import { fcmConfigured, sendPush } from './fcm.ts';

export const kstNow = (d = new Date()) => {
  const k = new Date(d.getTime() + 9 * 3600_000);
  return { day: k.toISOString().slice(0, 10), hm: k.toISOString().slice(11, 16) };
};
const FALLBACK = ['오늘 나에게 찾아올 행운의 색과 숫자를 확인해 보세요', '오늘의 금전·연애·일 운세가 도착했어요', '천궁도사가 오늘 하루의 흐름을 읽어 두었소'];

export async function dailyMessage(db: Db, userId: string, day: string) {
  const [p] = await db.select().from(S.profiles).where(eq(S.profiles.userId, userId)).orderBy(sql`${S.profiles.isMain} desc`, asc(S.profiles.createdAt)).limit(1);
  if (!p) return { title: '☀️ 오늘의 운세가 도착했어요', body: FALLBACK[+day.slice(-1) % FALLBACK.length] };
  try {
    const f = todayFortune(sajuOf({ id: p.id, year: p.birthYear, month: p.birthMonth, day: p.birthDay, hour: p.birthHour, calendar: p.calendar as 'solar' | 'lunar', leap: p.leap, gender: p.gender as 'M' | 'F' }), new Date(`${day}T09:00:00+09:00`), p.id);
    return { title: `☀️ ${p.name}님, 오늘 운세 ${f.total}점`, body: f.oneLine };
  } catch {
    return { title: `☀️ ${p.name}님, 오늘의 운세가 도착했어요`, body: FALLBACK[0] };
  }
}

// 'HH:MM' 에서 분 빼기(0시 이전은 00:00)
const hmMinus = (hm: string, min: number) => { const t = Math.max(0, +hm.slice(0, 2) * 60 + +hm.slice(3) - min); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
export async function runDailyPush(db: Db, http: typeof fetch, now = new Date()) {
  if (!fcmConfigured()) return { sent: 0, skipped: true };
  const { day, hm } = kstNow(now);
  const due = await db.select({ id: S.users.id, token: S.users.pushToken }).from(S.users).where(and(
    eq(S.users.pushConsent, true), isNotNull(S.users.pushToken), isNull(S.users.deletedAt), isNull(S.users.mergedInto),
    // 정확히 그 분만 보던 방식은 배포·재시작·느린 1분에 걸리면 그날 알림이 빠졌다 → 받을 시각이 지난 2시간 안이고 오늘 아직 안 보낸 사람
    or(and(sql`${S.users.pushTime} <= ${hm}`, sql`${S.users.pushTime} >= ${hmMinus(hm, 120)}`), and(isNull(S.users.pushTime), sql`${'07:00'} <= ${hm}`, sql`${'07:00'} >= ${hmMinus(hm, 120)}`)),
    or(isNull(S.users.lastDailyPush), ne(S.users.lastDailyPush, day)),
  )).limit(5000);
  if (!due.length) return { sent: 0 };
  // 먼저 "오늘 보냄" 표시(서버가 두 대여도 두 번 안 가게)
  await db.update(S.users).set({ lastDailyPush: day }).where(inArray(S.users.id, due.map((u) => u.id)));
  let sent = 0;
  const dead: string[] = [];
  for (const u of due) {
    const m = await dailyMessage(db, u.id, day);
    const r = await sendPush([u.token!], { ...m, link: '/today' }, http);
    sent += r.sent;
    dead.push(...r.dead);
  }
  if (dead.length) await db.update(S.users).set({ pushToken: null }).where(inArray(S.users.pushToken, dead));
  return { sent };
}

// 이용권 만료 알림 — 자동결제가 아닌 구독(웹 연간 이용권·자동결제를 해지한 월 구독)이 끝나기 7일 전·1일 전 오전 10시(한국)에 한 번씩.
// 웹은 앱 푸시를 못 받으니 화면(홈·운세함)에도 "N일 남았어요 · 연장하기" 를 띄운다(web: ExpiryNotice).
export async function runExpiryReminders(db: Db, http: typeof fetch, now = new Date()) {
  const { day, hm } = kstNow(now);
  if (hm !== '10:00' || !fcmConfigured()) return { sent: 0 };
  const dayMs = 86_400_000;
  const today = Date.parse(`${day}T00:00:00+09:00`);
  const rows = await db.select({ sub: S.subscriptions, token: S.users.pushToken }).from(S.subscriptions)
    .innerJoin(S.users, eq(S.users.id, S.subscriptions.userId))
    .where(and(
      eq(S.subscriptions.autoRenew, false), inArray(S.subscriptions.status, ['active', 'grace']),
      sql`${S.subscriptions.expiresAt} > ${new Date(today)} and ${S.subscriptions.expiresAt} < ${new Date(today + 9 * dayMs)}`,
      or(isNull(S.subscriptions.remindDay), ne(S.subscriptions.remindDay, day)),
      eq(S.users.pushConsent, true), isNotNull(S.users.pushToken), isNull(S.users.deletedAt),
    )).limit(5000);
  let sent = 0;
  for (const { sub, token } of rows) {
    const left = Math.round((Date.parse(`${kstNow(sub.expiresAt).day}T00:00:00+09:00`) - today) / dayMs); // 만료일(한국 날짜)까지 남은 날
    if (left !== 7 && left !== 1) continue;
    await db.update(S.subscriptions).set({ remindDay: day }).where(eq(S.subscriptions.id, sub.id));
    const r = await sendPush([token!], { title: `✦ 프리미엄 이용 기간이 ${left}일 남았어요`, body: '연장하시면 남은 기간 뒤에 이어서 늘어나요. 혜택을 계속 누려 보세요.', link: '/premium' }, http);
    sent += r.sent;
  }
  return { sent };
}

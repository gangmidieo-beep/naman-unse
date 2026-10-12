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

export async function runDailyPush(db: Db, http: typeof fetch, now = new Date()) {
  if (!fcmConfigured()) return { sent: 0, skipped: true };
  const { day, hm } = kstNow(now);
  const due = await db.select({ id: S.users.id, token: S.users.pushToken }).from(S.users).where(and(
    eq(S.users.pushConsent, true), isNotNull(S.users.pushToken), isNull(S.users.deletedAt), isNull(S.users.mergedInto),
    hm === '07:00' ? or(eq(S.users.pushTime, hm), isNull(S.users.pushTime)) : eq(S.users.pushTime, hm),
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

// 매일 아침 자동 푸시 — 사용자 알림 시간(한국 시간)에 하루 한 번, 대표 사주의 오늘 한 줄
import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { openDb, schema as S } from '../src/db/index.ts';
import { runDailyPush, runExpiryReminders, kstNow } from '../src/services/push/daily.ts';

describe('매일 아침 자동 푸시', () => {
  it('07:00(KST) 동의한 사람에게 한 번만, 다른 시간 사람은 안 보냄', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from(JSON.stringify({ client_email: 'x@y.iam', project_id: 'p', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })).toString('base64');
    const sent: any[] = [];
    const http = (async (url: string, init?: RequestInit) => {
      if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }));
      sent.push(JSON.parse(String(init?.body)).message);
      return new Response('{}');
    }) as typeof fetch;
    const { db, close } = await openDb({ dir: 'memory' });
    await db.insert(S.users).values([
      { id: 'u1', pushToken: 'tok1', pushConsent: true, pushTime: '07:00' },
      { id: 'u2', pushToken: 'tok2', pushConsent: true, pushTime: '08:30' },
      { id: 'u3', pushToken: 'tok3', pushConsent: false, pushTime: '07:00' },
      { id: 'u4', pushToken: 'tok4', pushConsent: true, pushTime: null },
    ]);
    await db.insert(S.profiles).values({ id: 'p1', userId: 'u1', name: '김서연', gender: 'F', birthYear: 1990, birthMonth: 6, birthDay: 12, calendar: 'solar', isMain: true });
    const at7 = new Date('2026-10-13T07:00:20+09:00');
    expect(kstNow(at7)).toEqual({ day: '2026-10-13', hm: '07:00' });
    const r = await runDailyPush(db, http, at7);
    expect(r.sent).toBe(2);
    expect(sent.map((m) => m.token).sort()).toEqual(['tok1', 'tok4']);
    const m1 = sent.find((m) => m.token === 'tok1');
    expect(m1.notification.title).toMatch(/김서연님, 오늘 운세 \d+점/);
    expect(m1.data.link).toBe('/today');
    expect((await runDailyPush(db, http, at7)).sent).toBe(0); // 같은 날 두 번 안 감
    expect((await runDailyPush(db, http, new Date('2026-10-13T08:30:05+09:00'))).sent).toBe(1);
    expect((await db.select().from(S.users).where(eq(S.users.id, 'u1')))[0].lastDailyPush).toBe('2026-10-13');
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    await close();
  }, 60_000);
  it('이용권 만료 알림: 자동결제 아닌 구독만, 7일 전·1일 전 오전 10시에 한 번', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from(JSON.stringify({ client_email: 'x@y.iam', project_id: 'p', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })).toString('base64');
    const sent: any[] = [];
    const http = (async (url: string, init?: RequestInit) => {
      if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }));
      sent.push(JSON.parse(String(init?.body)).message);
      return new Response('{}');
    }) as typeof fetch;
    const { db, close } = await openDb({ dir: 'memory' });
    await db.insert(S.users).values([1, 2, 3, 4].map((i) => ({ id: `e${i}`, pushToken: `t${i}`, pushConsent: true })));
    const at = (d: string) => new Date(`${d}+09:00`);
    await db.insert(S.subscriptions).values([
      { id: 's1', userId: 'e1', plan: 'yearly', status: 'active', channel: 'pg', amount: 59000, expiresAt: at('2026-10-20T15:00:00') }, // 7일 전
      { id: 's2', userId: 'e2', plan: 'monthly', status: 'active', channel: 'pg', amount: 6900, expiresAt: at('2026-10-14T09:00:00') }, // 1일 전(해지한 월 구독)
      { id: 's3', userId: 'e3', plan: 'monthly', status: 'active', channel: 'pg', amount: 6900, expiresAt: at('2026-10-20T15:00:00'), autoRenew: true }, // 자동결제 → 알림 없음
      { id: 's4', userId: 'e4', plan: 'yearly', status: 'active', channel: 'pg', amount: 59000, expiresAt: at('2026-10-18T15:00:00') }, // 5일 전 → 없음
    ]);
    expect((await runExpiryReminders(db, http, at('2026-10-13T09:59:00'))).sent).toBe(0);
    expect((await runExpiryReminders(db, http, at('2026-10-13T10:00:10'))).sent).toBe(2);
    expect(sent.map((m) => m.token).sort()).toEqual(['t1', 't2']);
    expect(sent.find((m) => m.token === 't2').notification.title).toContain('1일 남았어요');
    expect(sent[0].data.link).toBe('/premium');
    expect((await runExpiryReminders(db, http, at('2026-10-13T10:00:40'))).sent).toBe(0); // 같은 날 한 번만
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    await close();
  }, 60_000);
});

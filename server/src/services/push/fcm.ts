// 앱 푸시 — Firebase Cloud Messaging HTTP v1. 대표님 Firebase 서비스 계정 JSON 을 FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 에.
// 키가 없으면 보내지 않고 대상 수만 센다(관리자 화면에 "발송 준비 중" 으로 보임).
import { SignJWT, importPKCS8 } from 'jose';

type SA = { client_email: string; private_key: string; project_id: string };
const sa = (): SA | null => {
  const b = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!b) return null;
  try { return JSON.parse(Buffer.from(b, 'base64').toString('utf8')); } catch { return null; }
};
export const fcmConfigured = () => !!sa();

let cached: { token: string; exp: number } | null = null;
async function token(s: SA, http: typeof fetch) {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const key = await importPKCS8(s.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer(s.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
  const r = await http('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  if (!r.ok) throw new Error('Firebase 인증 실패');
  const j = (await r.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

// 받는 사람마다 1건씩(최대 동시 20). 지워진 토큰(UNREGISTERED)은 돌려줘서 DB 에서 비우게 한다.
export async function sendPush(tokens: string[], msg: { title: string; body: string; link: string }, http: typeof fetch = fetch) {
  const s = sa();
  if (!s) return { sent: 0, failed: 0, dead: [] as string[], configured: false };
  const t = await token(s, http);
  let sent = 0, failed = 0;
  const dead: string[] = [];
  for (let i = 0; i < tokens.length; i += 20) {
    await Promise.all(tokens.slice(i, i + 20).map(async (tk) => {
      const r = await http(`https://fcm.googleapis.com/v1/projects/${s.project_id}/messages:send`, {
        method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
        body: JSON.stringify({ message: { token: tk, notification: { title: msg.title, body: msg.body }, data: { link: msg.link }, android: { priority: 'high', notification: { channel_id: 'daily' } } } }),
      }).catch(() => null);
      if (r?.ok) sent++;
      else { failed++; if (r && (r.status === 404 || (await r.text()).includes('UNREGISTERED'))) dead.push(tk); }
    }));
  }
  return { sent, failed, dead, configured: true };
}

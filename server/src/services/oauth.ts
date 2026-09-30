// 간편 로그인(서버 OAuth) — Google · 카카오 · 네이버. 웹은 리다이렉트, 앱은 브라우저 창 → 딥링크로 같은 흐름.
// 키가 없으면(개발·시안) mock 제공자로 흐름만 완성한다. 각 콘솔 등록 방법은 내할일.md.
import { randomBytes } from 'node:crypto';

export type Provider = 'google' | 'kakao' | 'naver';
type Cfg = { authUrl: string; tokenUrl: string; profileUrl: string; scope: string; id?: string; secret?: string };
const CFG: Record<Provider, Cfg> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://openidconnect.googleapis.com/v1/userinfo', scope: 'openid email profile',
    id: process.env.GOOGLE_OAUTH_CLIENT_ID, secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  },
  kakao: {
    authUrl: 'https://kauth.kakao.com/oauth/authorize', tokenUrl: 'https://kauth.kakao.com/oauth/token',
    profileUrl: 'https://kapi.kakao.com/v2/user/me', scope: 'profile_nickname',
    id: process.env.KAKAO_REST_KEY, secret: process.env.KAKAO_CLIENT_SECRET,
  },
  naver: {
    authUrl: 'https://nid.naver.com/oauth2.0/authorize', tokenUrl: 'https://nid.naver.com/oauth2.0/token',
    profileUrl: 'https://openapi.naver.com/v1/nid/me', scope: '',
    id: process.env.NAVER_CLIENT_ID, secret: process.env.NAVER_CLIENT_SECRET,
  },
};
export const isConfigured = (p: Provider) => !!CFG[p].id;
export const isProvider = (p: string): p is Provider => p in CFG;

// state 는 서버 메모리에 10분 보관(돌아올 곳 포함). ponytail: 서버 1대 기준 — 여러 대로 늘리면 DB/Redis 로
const states = new Map<string, { redirect: string; at: number }>();
export function startUrl(p: Provider, callbackUrl: string, redirect: string) {
  const state = randomBytes(12).toString('hex');
  states.set(state, { redirect, at: Date.now() });
  for (const [k, v] of states) if (Date.now() - v.at > 600_000) states.delete(k);
  const c = CFG[p];
  const q = new URLSearchParams({ response_type: 'code', client_id: c.id!, redirect_uri: callbackUrl, state });
  if (c.scope) q.set('scope', c.scope);
  return `${c.authUrl}?${q}`;
}
export function takeState(state: string) {
  const v = states.get(state);
  states.delete(state);
  return v && Date.now() - v.at < 600_000 ? v : null;
}

// code → 사용자 정보 { providerId, name, email }
export async function exchange(p: Provider, code: string, callbackUrl: string, state: string) {
  const c = CFG[p];
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: callbackUrl, client_id: c.id!, state });
  if (c.secret) body.set('client_secret', c.secret);
  const tr = await fetch(c.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  if (!tr.ok) throw new Error(`${p} 토큰 교환 실패 ${tr.status}`);
  const tok = (await tr.json()) as { access_token: string };
  const pr = await fetch(c.profileUrl, { headers: { authorization: `Bearer ${tok.access_token}` } });
  if (!pr.ok) throw new Error(`${p} 사용자 정보 실패 ${pr.status}`);
  const j = (await pr.json()) as any;
  if (p === 'google') return { providerId: String(j.sub), name: j.name ?? '회원', email: j.email ?? null };
  if (p === 'kakao') return { providerId: String(j.id), name: j.properties?.nickname ?? '회원', email: j.kakao_account?.email ?? null };
  return { providerId: String(j.response?.id), name: j.response?.nickname ?? j.response?.name ?? '회원', email: j.response?.email ?? null };
}

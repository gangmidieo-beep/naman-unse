// 토큰(JWT HS256) — 사용자 30일, 관리자 12시간. 비밀키는 JWT_SECRET(.env). 없으면 개발용 임시 키(운영에서는 서버가 시작을 거부).
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.APP_ENV === 'production') throw new Error('JWT_SECRET 이 없어요(.env)');
  return new TextEncoder().encode(s || 'dev-only-secret-change-me');
};
export type UserClaims = { sub: string; kind: 'user' };
export type AdminClaims = { sub: string; kind: 'admin'; role: 'super' | 'operator'; email: string };

export async function signUser(userId: string) {
  return new SignJWT({ kind: 'user' }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('30d').sign(secret());
}
export async function signAdmin(id: number, role: AdminClaims['role'], email: string) {
  return new SignJWT({ kind: 'admin', role, email }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(id)).setIssuedAt().setExpirationTime('12h').sign(secret());
}
export async function verify<T extends UserClaims | AdminClaims>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as T;
  } catch {
    return null;
  }
}
export const newId = (prefix = '') => prefix + randomBytes(8).toString('hex');

// 관리자 API 호출 — 토큰은 localStorage(naman-admin). 서버 주소는 API_ORIGIN(.env), 없으면 로컬 8791.
export const ADMIN_API = (__API_ORIGIN__ || 'http://localhost:8791') + '/admin/api';
type Session = { token: string; email: string; role: 'super' | 'operator' };

export const session = (): Session | null => {
  try { return JSON.parse(localStorage.getItem('naman-admin') || 'null'); } catch { return null; }
};
export const saveSession = (s: Session | null) => (s ? localStorage.setItem('naman-admin', JSON.stringify(s)) : localStorage.removeItem('naman-admin'));

export async function adminApi<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const s = session();
  const res = await fetch(ADMIN_API + path, {
    ...init,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    headers: { ...(init.json !== undefined ? { 'content-type': 'application/json' } : {}), ...(s ? { authorization: `Bearer ${s.token}` } : {}), ...init.headers },
  });
  if (res.status === 401) { saveSession(null); location.assign('/admin/login'); throw new Error('로그인이 필요해요'); }
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((body as any)?.error ?? `${res.status}`);
  return body as T;
}
export async function download(path: string, filename: string) {
  const s = session();
  const res = await fetch(ADMIN_API + path, { headers: s ? { authorization: `Bearer ${s.token}` } : {} });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
export const won = (n: number) => `${(n ?? 0).toLocaleString('ko-KR')}원`;
export const dt = (s: string | null) => (s ? new Date(s).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');
export const fileToDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

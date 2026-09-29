// 서버 통신 래퍼. MOCK_MODE 면 src/mock/*.json 을 돌려준다(08 단계에서 실제 서버 연결).
const mocks = import.meta.glob('../mock/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export const MOCK_MODE = __MOCK_MODE__;

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (MOCK_MODE) {
    const key = `../mock/${path.replace(/^\//, '').replace(/\//g, '_')}.json`;
    if (key in mocks) return structuredClone(mocks[key]) as T;
    throw new Error(`mock 없음: ${path}`);
  }
  const res = await fetch(`${__API_ORIGIN__}${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

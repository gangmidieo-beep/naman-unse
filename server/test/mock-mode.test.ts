// 시험 모드 기본값 — 변수가 없거나 오타면 운영(결제 필요). 'true' 라고 적었을 때만 시험 모드
import { describe, it, expect } from 'vitest';
import { mockMode } from '../src/services/mock.ts';

describe('MOCK_MODE 판정', () => {
  const withEnv = (mock: string | undefined, nodeEnv: string | undefined, f: () => void) => {
    const m = process.env.MOCK_MODE, n = process.env.NODE_ENV;
    if (mock === undefined) delete process.env.MOCK_MODE; else process.env.MOCK_MODE = mock;
    if (nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = nodeEnv;
    try { f(); } finally { if (m === undefined) delete process.env.MOCK_MODE; else process.env.MOCK_MODE = m; if (n === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = n; }
  };
  it("'true' 만 시험 모드", () => {
    withEnv('true', 'production', () => expect(mockMode()).toBe(true));
    withEnv('false', 'production', () => expect(mockMode()).toBe(false));
    withEnv('False', 'production', () => expect(mockMode()).toBe(false));
    withEnv('1', 'production', () => expect(mockMode()).toBe(false));
  });
  it('변수가 없으면 운영(테스트 실행 중에만 시험 모드)', () => {
    withEnv(undefined, 'production', () => expect(mockMode()).toBe(false));
    withEnv(undefined, undefined, () => expect(mockMode()).toBe(false));
    withEnv(undefined, 'test', () => expect(mockMode()).toBe(true));
  });
});

import { describe, expect, it } from 'vitest';
import { aiStatus, normalizeAiEnv } from '../src/services/env.ts';

describe('AI 변수 정리(양도 후 대표님 직접 입력 대비)', () => {
  it('앞뒤 공백·따옴표·대문자를 정리하면 켜진다', () => {
    const env: NodeJS.ProcessEnv = { READING_AI: ' "Live" \n', ANTHROPIC_API_KEY: 'sk-ant-abc  ', ANTHROPIC_MODEL: "'claude-sonnet-5-5'" };
    expect(aiStatus(env).reading).toBe(false);
    normalizeAiEnv(env);
    expect(env.READING_AI).toBe('live');
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-abc');
    expect(env.ANTHROPIC_MODEL).toBe('claude-sonnet-5-5');
    expect(aiStatus(env)).toEqual({ reading: true, photo: true, baby: false, missing: [] });
  });
  it('이름 뒤에 공백이 붙은 변수도 찾아 쓴다', () => {
    const env: NodeJS.ProcessEnv = { 'READING_AI ': 'live', ANTHROPIC_API_KEY: 'sk-ant-x', ANTHROPIC_MODEL: 'm' };
    normalizeAiEnv(env);
    expect(aiStatus(env).reading).toBe(true);
  });
  it('빠진 변수 이름만 알려 주고 값은 내보내지 않는다', () => {
    const s = aiStatus({ READING_AI: 'on', ANTHROPIC_API_KEY: 'abc', GEMINI_API_KEY: 'g' });
    expect(s.reading).toBe(false);
    expect(s.baby).toBe(true);
    expect(s.missing).toEqual(['READING_AI=live', 'ANTHROPIC_API_KEY(sk-ant- 로 시작해야 함)', 'ANTHROPIC_MODEL']);
    expect(JSON.stringify(s)).not.toContain('abc');
  });
});

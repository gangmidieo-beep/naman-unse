// tokens.css 의 색 = brand.config.json colors (디자인가이드 1장)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import brand from '../../../brand.config.json';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const vars = Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
describe('디자인 토큰', () => {
  for (const [k, v] of Object.entries(brand.colors)) it(k, () => expect(vars[k]?.replace(/\s/g, '')).toBe(v.replace(/\s/g, '')));
  it('글자 크기 토큰', () => {
    expect(vars['--fs-body']).toBe('18px');
    expect(vars['--fs-small']).toBe('16px');
  });
});

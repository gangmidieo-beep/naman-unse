import { describe, it, expect } from 'vitest';
import { buyLabel, productById, memberPrice, FATE, LOVE, TALISMANS } from './catalog';

describe('카탈로그', () => {
  it('상품 26 + 부적 14', () => {
    expect(FATE.length + LOVE.length).toBe(26);
    expect(TALISMANS).toHaveLength(14);
  });
  it('부적 버튼 문구 (HWP)', () => {
    expect(buyLabel(productById('t_wealth')!)).toBe('나만의 재물부적 받기 – 14,900원');
    expect(buyLabel(productById('t_luck')!)).toBe('나만의 행운부적 받기 – 9,900원');
    expect(buyLabel(productById('t_pass')!)).toBe('나만의 취업합격부적 받기 – 9,900원');
  });
  it('회원가 10%', () => {
    expect(memberPrice(productById('wealth')!)).toBe(17100);
    expect(memberPrice(productById('t_wealth')!)).toBe(13410);
  });
  it('캐릭터 버튼', () => {
    expect(buyLabel(productById('wealth')!)).toBe('천궁도사의 상세풀이 받기');
    expect(buyLabel(productById('gunghap')!)).toBe('나의 인연서 열어보기');
  });
});

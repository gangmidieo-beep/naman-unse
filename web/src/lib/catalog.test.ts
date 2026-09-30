import { describe, it, expect } from 'vitest';
import { applyServerProducts, buyLabel, priceView, productById, recommendFor, TAROTS } from './catalog';

describe('관리자 값 반영(서버 products 덮어쓰기)', () => {
  it('정가·할인 표시·버튼·추천 부적이 앱에 반영된다', () => {
    expect(priceView(productById('career')!).label).toBe('회원');
    applyServerProducts([{ id: 'career', listPrice: 25000, price: 19000, buttonLabel: '지금 풀이 받기', recommend: ['t_pass'] }]);
    const p = productById('career')!;
    expect(priceView(p)).toMatchObject({ rate: 24, strike: 25000, final: 19000 });
    expect(buyLabel(p)).toBe('지금 풀이 받기');
    expect(recommendFor('career').map((t) => t.id)).toEqual(['t_pass']);
    applyServerProducts([{ id: 'career', showDiscount: false }]);
    expect(priceView(p).rate).toBe(0);
  });
  it('기본 추천 부적 매핑 · 타로 버튼', () => {
    expect(recommendFor('gunghap').map((t) => t.id)).toEqual(['t_couple']);
    expect(recommendFor('jeongtong').map((t) => t.id)).toEqual(['t_wish', 't_luck']);
    expect(buyLabel(TAROTS[0])).toBe('타로 리딩 받기');
  });
});

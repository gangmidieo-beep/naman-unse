// 상품 카탈로그 — 원본은 brand.config.json (docs/상품카탈로그_v2.json 에서 생성). 08 단계 이후에는 서버 products 가 우선.
import brand from '../../../brand.config.json';
import { THUMBS } from '../assets/thumbs';
import { newYearTarget } from './dates';

export const BRAND = brand;
export type CharId = 'cheongung' | 'wolha';
export type Reading = (typeof brand.fate)[number] | (typeof brand.love)[number];
export type Talisman = (typeof brand.talisman)[number];
export type Product = Reading | Talisman;

export const FATE = brand.fate as Reading[];
export const LOVE = brand.love as Reading[];
export const TALISMANS = brand.talisman as Talisman[];
export const ALL: Product[] = [...FATE, ...LOVE, ...TALISMANS];
export const productById = (id: string) => ALL.find((p) => p.id === id);
export const isTalisman = (p: Product): p is Talisman => p.kind === 'talisman';
export const isTwoPerson = (id: string) => brand.twoPerson.includes(id);
export const charOf = (p: Product) => p.character as CharId;
export const CHAR = {
  cheongung: { name: '천궁도사', hanja: '天宮道士', book: '운명서', face: 'cheongungFace' as const, banner: 'cheongungBanner' as const, card: 'cheongungCard' as const },
  wolha: { name: '월하선녀', hanja: '月下仙女', book: '인연서', face: 'wolhaFace' as const, banner: 'wolhaBanner' as const, card: 'wolhaCard' as const },
};

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
// 회원가 = 정가에서 memberDiscountRate 할인, 10원 단위 반올림 (카탈로그 memberPrice 가 있으면 그 값)
export const memberPrice = (p: Product) => (p as any).memberPrice ?? Math.round((p.price * (1 - brand.subscription.memberDiscountRate)) / 10) * 10;
export const payPrice = (p: Product, premium: boolean) => (premium ? memberPrice(p) : p.price);

// 신년운세·토정비결은 대상 해를 자동으로(9월부터 다음 해)
export function displayTitle(p: Product) {
  if (p.id === 'newyear') return `${newYearTarget().year} 신년운세`;
  if (p.id === 'tojeong') return `${newYearTarget().year} 토정비결`;
  return p.title;
}
export function displayCopy(p: Product) {
  return p.cardCopy.replace(/20\d\d년/, `${newYearTarget().year}년`);
}
// 썸네일: 이미지가 있으면 이미지, 없으면 먹색+금 한자
export function thumbOf(p: Product): { src?: string; hanja: string } {
  const hanja = p.id === 'newyear' ? newYearTarget().pillar.hanja : (p as any).thumbHanja ?? '符';
  return { src: THUMBS[p.id], hanja };
}
export const buyLabel = (p: Product) => {
  // HWP 예: "재물운 부적" → "나만의 재물부적 받기 – 14,900원" (끝의 '운'은 떼되 '행운'처럼 두 글자면 유지)
  if (isTalisman(p)) {
    let base = p.title.replace(/\s*부적$/, '').replace(/·/g, '');
    if (base.length > 2 && base.endsWith('운')) base = base.slice(0, -1);
    return brand.buttons.talisman.replace('{name}', `${base}부적`).replace('{price}', won(p.price));
  }
  return charOf(p) === 'cheongung' ? brand.buttons.cheongung[0] : brand.buttons.wolha[0];
};
export const resultTitle = (p: Product) => brand.resultTitles[charOf(p)];
export const BADGE_LABEL: Record<string, string> = { BEST: 'BEST', HOT: 'HOT', NEW: 'NEW', 인기: '인기' };

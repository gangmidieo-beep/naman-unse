import brand from '../../../brand.config.json';

export type Product = (typeof brand.products)[number];
export const BRAND = brand;
export const productById = (id: string) => brand.products.find((p) => p.id === id);
export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
export const discounted = (price: number) => Math.round((price * (1 - brand.subscription.discountRate)) / 100) * 100;
export const characterOf = (id: 'dosa' | 'sunnyeo') => brand.characters.find((c) => c.id === id)!;

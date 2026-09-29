export { ZODIAC_KEYS, zodiacToday } from '@naman/content';
// 띠(양력 연도 기준 — 띠별 목록용)
export const zodiacOfYear = (y: number) => (((y - 4) % 12) + 12) % 12;

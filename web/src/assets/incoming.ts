// scripts/make-images.mjs 가 만드는 파일 — _incoming 에서 변환된 이미지 목록. 직접 고치지 말 것.
export const INCOMING: Partial<Record<string, { src: string; srcset?: string; w: number; h: number }>> = {};

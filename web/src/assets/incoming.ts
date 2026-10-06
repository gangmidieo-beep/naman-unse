// scripts/make-images.mjs 가 만드는 파일 — _incoming 에서 변환된 이미지 목록. 직접 고치지 말 것.
export const INCOMING: Partial<Record<string, { src: string; srcset?: string; w: number; h: number }>> = {
  "logo_brand": {
    "src": "/img/logo/logo_brand_780.webp",
    "srcset": "/img/logo/logo_brand_780.webp 780w, /img/logo/logo_brand_1200.webp 1200w, /img/logo/logo_brand_1600.webp 1600w",
    "w": 780,
    "h": 293
  }
};

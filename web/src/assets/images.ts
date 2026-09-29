// 이미지 목록 — 컴포넌트는 이 키로만 이미지를 부른다(교체 시 여기만 수정). 06 단계 make-images 결과와 맞춘다.
export const IMG = {
  dosaFace: { src: '/img/char/dosa_face.webp', w: 240, h: 240, alt: '천궁도령 얼굴' },
  sunnyeoFace: { src: '/img/char/sunnyeo_face.webp', w: 240, h: 240, alt: '월하선녀 얼굴' },
  dosaBanner: { src: '/img/char/dosa_banner.webp', w: 800, h: 547, alt: '별자리 부채를 든 천궁도령' },
  sunnyeoBanner: { src: '/img/char/sunnyeo_banner.webp', w: 800, h: 547, alt: '붉은 실을 든 월하선녀' },
  dosaCard: { src: '/img/char/dosa_card.webp', w: 640, h: 960, alt: '천궁도령' },
  sunnyeoCard: { src: '/img/char/sunnyeo_card.webp', w: 640, h: 960, alt: '월하선녀' },
} as const;
export type ImgKey = keyof typeof IMG;

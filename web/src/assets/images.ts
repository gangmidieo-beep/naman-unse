// 이미지 목록 — 컴포넌트는 이 키로만 이미지를 부른다(교체 시 여기만 수정).
// 기본은 캐릭터 원본에서 만든 이미지. _incoming 으로 새 이미지가 들어오면(npm run make:images) INCOMING 이 우선한다.
import { INCOMING } from './incoming';

const BASE = {
  dosaFace: { src: '/img/char/dosa_face.webp', w: 240, h: 240, alt: '천궁도령 얼굴' },
  sunnyeoFace: { src: '/img/char/sunnyeo_face.webp', w: 240, h: 240, alt: '월하선녀 얼굴' },
  dosaBanner: { src: '/img/char/dosa_banner.webp', w: 800, h: 547, alt: '별자리 부채를 든 천궁도령' },
  sunnyeoBanner: { src: '/img/char/sunnyeo_banner.webp', w: 800, h: 547, alt: '붉은 실을 든 월하선녀' },
  dosaCard: { src: '/img/char/dosa_card.webp', w: 640, h: 960, alt: '천궁도령' },
  sunnyeoCard: { src: '/img/char/sunnyeo_card.webp', w: 640, h: 960, alt: '월하선녀' },
} as const;
export type ImgKey = keyof typeof BASE;
type Entry = { src: string; srcset?: string; w: number; h: number; alt: string };

// 들어온 이미지 파일명(docs/이미지프롬프트.md) → 화면 키
const INCOMING_FOR: Partial<Record<ImgKey, string>> = {
  dosaBanner: 'banner_dosa',
  sunnyeoBanner: 'banner_sunnyeo',
  dosaCard: 'card_saju',
  sunnyeoCard: 'card_gunghap',
};
export const IMG: Record<ImgKey, Entry> = Object.fromEntries(
  (Object.keys(BASE) as ImgKey[]).map((k) => {
    const inc = INCOMING_FOR[k] ? INCOMING[INCOMING_FOR[k]!] : undefined;
    return [k, inc ? { ...inc, alt: BASE[k].alt } : { ...BASE[k] }];
  }),
) as Record<ImgKey, Entry>;

// 선택 이미지(없으면 undefined → 화면이 CSS 대체)
export const optionalImg = (name: 'card_newyear' | 'card_talisman' | 'banner_premium' | 'loading_dosa' | 'logo_seal') => INCOMING[name];

// 상품 카탈로그 — 원본은 brand.config.json (docs/상품카탈로그_v2.json + v3 추가 상품). 서버 연결 시 서버 products 가 우선(관리자 수정 반영).
import brand from '../../../brand.config.json';
import talismanMap from '@naman/content/data/talisman-map.json';
import { THUMBS } from '../assets/thumbs';
import { newYearTarget } from './dates';

export const BRAND = brand;
export type CharId = 'cheongung' | 'wolha';
export type Reading = (typeof brand.fate)[number] | (typeof brand.love)[number];
export type Talisman = (typeof brand.talisman)[number];
export type TarotProduct = (typeof brand.tarot)[number];
export type PhotoProduct = (typeof brand.photo)[number];
export type Product = Reading | Talisman | TarotProduct | PhotoProduct;

export const FATE = brand.fate as Reading[];
export const LOVE = brand.love as Reading[];
export const TALISMANS = brand.talisman as Talisman[];
export const TAROTS = brand.tarot as TarotProduct[];
export const PHOTOS = brand.photo as PhotoProduct[];
export const ALL: Product[] = [...FATE, ...LOVE, ...TALISMANS, ...TAROTS, ...PHOTOS];
export const productById = (id: string) => ALL.find((p) => p.id === id);
export const isTalisman = (p: Product): p is Talisman => p.kind === 'talisman';
export const isTarot = (p: Product): p is TarotProduct => p.kind === 'tarot';
export const isPhoto = (p: Product): p is PhotoProduct => p.kind === 'photo';
export const isTwoPerson = (id: string) => brand.twoPerson.includes(id);
export const charOf = (p: Product) => p.character as CharId;
export const productPath = (p: Product) => (isTalisman(p) ? `/talisman/${p.id}` : `/product/${p.id}`);
export const CHAR = {
  cheongung: { name: '천궁도사', hanja: '天宮道士', book: '운명서', face: 'cheongungFace' as const, banner: 'cheongungBanner' as const, card: 'cheongungCard' as const },
  wolha: { name: '월하선녀', hanja: '月下仙女', book: '인연서', face: 'wolhaFace' as const, banner: 'wolhaBanner' as const, card: 'wolhaCard' as const },
};

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
// 회원가 = 정가에서 memberDiscountRate 할인, 10원 단위 반올림 (카탈로그 memberPrice 가 있으면 그 값)
export const memberPrice = (p: Product) => (p as any).memberPrice ?? Math.round((p.price * (1 - brand.subscription.memberDiscountRate)) / 10) * 10;
export const payPrice = (p: Product, premium: boolean) => (premium ? memberPrice(p) : p.price);
// 카드 가격 표시(결정필요 D25): 정가(listPrice)가 있으면 "할인율% 정가(취소선) 판매가", 없으면 "10% 판매가(취소선) 회원가"
export function priceView(p: Product) {
  if ((p as any).showDiscount === false) return { rate: 0, strike: 0, final: p.price, label: '' };
  const list = (p as any).listPrice as number | undefined;
  if (list && list > p.price) return { rate: Math.round(((list - p.price) / list) * 100), strike: list, final: p.price, label: '' };
  const m = memberPrice(p);
  return { rate: Math.round(((p.price - m) / p.price) * 100), strike: p.price, final: m, label: '회원' };
}

// 신년운세·토정비결은 대상 해를 자동으로(9월부터 다음 해)
export function displayTitle(p: Product) {
  if (p.id === 'newyear') return `${newYearTarget().year} 신년운세`;
  if (p.id === 'tojeong') return `${newYearTarget().year} 토정비결`;
  return p.title;
}
export function displayCopy(p: Product) {
  return p.cardCopy.replace(/20\d\d년/, `${newYearTarget().year}년`);
}
// 썸네일: 이미지가 있으면 이미지(web/public/img/thumb/thumb_<id>.webp), 없으면 먹색+금 한자
export function thumbOf(p: Product): { src?: string; hanja: string } {
  const hanja = p.id === 'newyear' ? newYearTarget().pillar.hanja : (p as any).thumbHanja ?? '符';
  return { src: (p as any).imageUrl ?? THUMBS[p.id], hanja };
}
export const buyLabel = (p: Product) => {
  if ((p as any).buttonLabel) return (p as any).buttonLabel as string; // 관리자 값
  // HWP 예: "재물운 부적" → "나만의 재물부적 받기 – 14,900원" (끝의 '운'은 떼되 '행운'처럼 두 글자면 유지)
  if (isTalisman(p)) {
    let base = p.title.replace(/\s*부적$/, '').replace(/·/g, '');
    if (base.length > 2 && base.endsWith('운')) base = base.slice(0, -1);
    return brand.buttons.talisman.replace('{name}', `${base}부적`).replace('{price}', won(p.price));
  }
  if (isTarot(p)) return brand.buttons.tarot;
  if (isPhoto(p)) return brand.buttons.photo;
  return charOf(p) === 'cheongung' ? brand.buttons.cheongung[0] : brand.buttons.wolha[0];
};
export const resultTitle = (p: Product) =>
  (p as any).resultTitle as string || isTarot(p) ? brand.resultTitles.tarot : isPhoto(p) ? brand.resultTitles.photo.replace('{name}', p.title.replace(' 풀이', '')) : brand.resultTitles[charOf(p)];
// 결과 화면 아래 추천 부적(1~2개) — packages/content/data/talisman-map.json (서버 연결 시 관리자 값 우선)
export function recommendFor(productId: string): Talisman[] {
  const own = (productById(productId) as any)?.recommend as string[] | undefined; // 관리자 값
  const rule = talismanMap.rules.find((r) => r.products.includes(productId));
  return (own?.length ? own : rule?.talismans ?? ['t_luck']).slice(0, 2).map((id) => TALISMANS.find((t) => t.id === id)!).filter(Boolean);
}

// 서버 연결 시: 관리자에서 고친 상품 값(이름·문구·가격·배지·노출·순서·이미지·버튼·결과 제목·추천 부적·상세 문구)을 앱 시작 때 덮어쓴다.
// 첫 화면을 늦추지 않도록 1.5초 안에 못 받으면 기본값(brand.config)으로 시작한다.
const FIELDS = ['title', 'cardCopy', 'detail', 'price', 'memberPrice', 'listPrice', 'showDiscount', 'badge', 'visible', 'sort', 'imageUrl', 'buttonLabel', 'resultTitle', 'recommend', 'detailCopy'] as const;
export function applyServerProducts(rows: Record<string, any>[]) {
  for (const r of rows) {
    const p = productById(r.id) as any;
    if (!p) continue;
    for (const k of FIELDS) if (r[k] !== undefined && r[k] !== null) p[k] = r[k];
    if (r.memberPrice == null && r.price != null) delete p.memberPrice; // 관리자가 회원가를 비우면 10% 자동 계산
  }
}
export async function loadServerCatalog(origin: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 1500);
  try {
    const all = await fetch(`${origin}/products`, { signal: ctl.signal }).then((r) => r.json());
    applyServerProducts(all);
    // 숨김 처리된 상품은 /products 에 안 오므로 목록에서도 숨긴다
    const ids = new Set(all.map((r: any) => r.id));
    for (const p of ALL as any[]) if (!ids.has(p.id)) p.visible = false;
  } catch { /* 서버 없음 — 기본값 */ } finally { clearTimeout(t); }
}

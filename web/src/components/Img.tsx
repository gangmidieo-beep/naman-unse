import { IMG, type ImgKey } from '../assets/images';

// 모든 이미지는 manifest 키로. 첫 화면 위쪽 이미지만 eager.
export function Img({ k, className, eager, alt }: { k: ImgKey; className?: string; eager?: boolean; alt?: string }) {
  const i = IMG[k];
  return <img className={className} src={i.src} width={i.w} height={i.h} alt={alt ?? i.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}

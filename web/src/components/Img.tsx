import { IMG, type ImgKey } from '../assets/images';

type Raw = { src: string; srcset?: string; w: number; h: number };
// 모든 이미지는 manifest 키(k) 또는 들어온 이미지(raw)로. 첫 화면 위쪽 이미지만 eager.
export function Img({ k, raw, className, eager, alt, sizes = '(max-width: 480px) 100vw, 480px' }: {
  k?: ImgKey; raw?: Raw; className?: string; eager?: boolean; alt?: string; sizes?: string;
}) {
  const i = raw ?? (k ? IMG[k] : null);
  if (!i) return null;
  return (
    <img className={className} src={i.src} srcSet={i.srcset} sizes={i.srcset ? sizes : undefined} width={i.w} height={i.h}
      alt={alt ?? (k ? IMG[k].alt : '')} loading={eager ? 'eager' : 'lazy'} decoding="async" />
  );
}

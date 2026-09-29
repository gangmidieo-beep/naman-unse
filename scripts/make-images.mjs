// 이미지 만들기 — 캐릭터 원본(assets/characters, 1024×1536) → web/public/img/char/ 크기별 webp.
// 크롭 위치는 기준 시안(docs/시안/img)과 같게 맞춘 값. 06 단계에서 _incoming 변환을 여기에 추가한다.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(root, 'web/public/img/char');
mkdirSync(OUT, { recursive: true });

const CHARS = {
  dosa: { src: '천궁도령.png', face: { left: 432, top: 36, width: 270, height: 270 }, bannerTop: 20 },
  sunnyeo: { src: '월하선녀.png', face: { left: 380, top: 100, width: 270, height: 270 }, bannerTop: 74 },
};

for (const [id, c] of Object.entries(CHARS)) {
  const src = join(root, 'assets/characters', c.src);
  await sharp(src).extract(c.face).resize(240, 240).webp({ quality: 82 }).toFile(join(OUT, `${id}_face.webp`));
  await sharp(src).extract({ left: 0, top: c.bannerTop, width: 1024, height: 700 }).resize(800, 547).webp({ quality: 78 }).toFile(join(OUT, `${id}_banner.webp`));
  await sharp(src).resize(640, 960).webp({ quality: 78 }).toFile(join(OUT, `${id}_card.webp`));
}
console.log('char images ok');

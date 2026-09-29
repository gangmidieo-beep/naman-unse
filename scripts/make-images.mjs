// 이미지 만들기 (npm run make:images)
// 1) 캐릭터 원본(assets/characters, 1024×1536) → web/public/img/char/ 크기별 webp (크롭 위치는 기준 시안과 같게)
// 2) web/public/img/_incoming/ 에 사람이 넣은 이미지(파일명 규칙: docs/이미지프롬프트.md) → 용도별 크기로 변환해 web/public/img/ 아래 저장
//    원본은 docs/assets-source/ 로 복사해 보관(양도 시 함께 넘김). 변환 목록은 web/src/assets/incoming.ts 로 기록.
// 3) 없는 파일은 화면에서 자동 대체(배너=캐릭터 크롭, 아이콘=단색 SVG, 신년운세 카드=네이비+한자) — 코드 쪽 처리.
import sharp from 'sharp';
import { mkdirSync, readdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, parse } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const PUB = join(root, 'web/public/img');
const INCOMING = join(PUB, '_incoming');
const SOURCE = join(root, 'docs/assets-source');
const mk = (d) => mkdirSync(d, { recursive: true });

/* ---------- 1) 캐릭터 ---------- */
const CHARS = {
  dosa: { src: '천궁도령.png', face: { left: 432, top: 36, width: 270, height: 270 }, bannerTop: 20 },
  sunnyeo: { src: '월하선녀.png', face: { left: 380, top: 100, width: 270, height: 270 }, bannerTop: 74 },
};
mk(join(PUB, 'char'));
for (const [id, c] of Object.entries(CHARS)) {
  const src = join(root, 'assets/characters', c.src);
  await sharp(src).extract(c.face).resize(240, 240).webp({ quality: 82 }).toFile(join(PUB, 'char', `${id}_face.webp`));
  await sharp(src).extract({ left: 0, top: c.bannerTop, width: 1024, height: 700 }).resize(800, 547).webp({ quality: 78 }).toFile(join(PUB, 'char', `${id}_banner.webp`));
  await sharp(src).resize(640, 960).webp({ quality: 78 }).toFile(join(PUB, 'char', `${id}_card.webp`));
}

/* ---------- 2) _incoming ---------- */
const ANDROID_ICON = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const manifest = {};
const report = [];
mk(INCOMING);
const files = readdirSync(INCOMING).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
for (const file of files) {
  const { name } = parse(file);
  const src = join(INCOMING, file);
  mk(SOURCE);
  copyFileSync(src, join(SOURCE, file));
  const out = (dir) => (mk(join(PUB, dir)), join(PUB, dir));
  if (name.startsWith('banner_')) {
    const d = out('banner');
    for (const w of [800, 1200]) await sharp(src).resize(w, Math.round((w * 9) / 16), { fit: 'cover' }).webp({ quality: 78 }).toFile(join(d, `${name}_${w}.webp`));
    manifest[name] = { src: `/img/banner/${name}_800.webp`, srcset: `/img/banner/${name}_800.webp 800w, /img/banner/${name}_1200.webp 1200w`, w: 800, h: 450 };
  } else if (name.startsWith('card_')) {
    const d = out('cards');
    for (const [w, h] of [[440, 600], [660, 900]]) await sharp(src).resize(w, h, { fit: 'cover', position: 'top' }).webp({ quality: 78 }).toFile(join(d, `${name}_${w}.webp`));
    manifest[name] = { src: `/img/cards/${name}_440.webp`, srcset: `/img/cards/${name}_440.webp 440w, /img/cards/${name}_660.webp 660w`, w: 440, h: 600 };
  } else if (name.startsWith('icon_') || name.startsWith('zodiac_') || name === 'loading_dosa') {
    const d = out('icons');
    const sizes = name === 'loading_dosa' ? [240, 480] : [128, 256];
    for (const s of sizes) await sharp(src).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85 }).toFile(join(d, `${name}_${s}.webp`));
    manifest[name] = { src: `/img/icons/${name}_${sizes[1]}.webp`, w: sizes[0], h: sizes[0] };
  } else if (name === 'logo_seal') {
    const d = out('logo');
    for (const s of [64, 128]) {
      await sharp(src).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(join(d, `logo_seal_${s}.png`));
      await sharp(src).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toFile(join(d, `logo_seal_${s}.webp`));
    }
    manifest[name] = { src: '/img/logo/logo_seal_128.webp', w: 64, h: 64 };
  } else if (name === 'app_icon') {
    // 10 단계 Android 용 — web 번들에는 넣지 않고 app-assets 로
    const d = join(root, 'docs/assets-source/app-icon');
    mk(d);
    for (const [k, s] of Object.entries(ANDROID_ICON)) await sharp(src).resize(s, s).png().toFile(join(d, `mipmap-${k}.png`));
    await sharp(src).resize(512, 512).png().toFile(join(d, 'playstore-512.png'));
  } else if (name === 'feature_graphic') {
    const d = join(root, 'docs/assets-source/store');
    mk(d);
    await sharp(src).resize(1024, 500, { fit: 'cover' }).jpeg({ quality: 88 }).toFile(join(d, 'feature_graphic_1024x500.jpg'));
  } else {
    report.push(`알 수 없는 파일명(건너뜀): ${file}`);
    continue;
  }
  report.push(`변환: ${file}`);
}
writeFileSync(
  join(root, 'web/src/assets/incoming.ts'),
  `// scripts/make-images.mjs 가 만드는 파일 — _incoming 에서 변환된 이미지 목록. 직접 고치지 말 것.\n` +
    `export const INCOMING: Partial<Record<string, { src: string; srcset?: string; w: number; h: number }>> = ${JSON.stringify(manifest, null, 2)};\n`,
);
console.log(`캐릭터 이미지 ✓ · _incoming ${files.length}개`);
report.forEach((r) => console.log(' ', r));
if (!existsSync(join(INCOMING, '.gitkeep'))) writeFileSync(join(INCOMING, '.gitkeep'), '');

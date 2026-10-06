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

/* ---------- 1) 캐릭터 (v2 원본이 있으면 v2, 없으면 v1) ---------- */
const CHARS = {
  cheongung: {
    v2: { src: '천궁도사_v2.png', face: { left: 295, top: 170, width: 340, height: 340 }, banner: { left: 0, top: 30, width: 1024, height: 700 }, card: { left: 0, top: 0, width: 1024, height: 1536 } },
    v1: { src: '천궁도사_v1.png', face: { left: 432, top: 36, width: 270, height: 270 }, banner: { left: 0, top: 20, width: 1024, height: 700 }, card: { left: 0, top: 0, width: 1024, height: 1536 } },
  },
  wolha: {
    v2: { src: '월하선녀_v2.png', face: { left: 300, top: 225, width: 340, height: 340 }, banner: { left: 0, top: 130, width: 941, height: 643 }, card: { left: 0, top: 60, width: 941, height: 1411 } },
    v1: { src: '월하선녀_v1.png', face: { left: 380, top: 100, width: 270, height: 270 }, banner: { left: 0, top: 74, width: 1024, height: 700 }, card: { left: 0, top: 0, width: 1024, height: 1536 } },
  },
};
mk(join(PUB, 'char'));
for (const [id, both] of Object.entries(CHARS)) {
  const c = existsSync(join(root, 'assets/characters', both.v2.src)) ? both.v2 : both.v1;
  const src = join(root, 'assets/characters', c.src);
  await sharp(src).extract(c.face).resize(240, 240).webp({ quality: 82 }).toFile(join(PUB, 'char', `${id}_face.webp`));
  await sharp(src).extract(c.banner).resize(800, 547).webp({ quality: 78 }).toFile(join(PUB, 'char', `${id}_banner.webp`));
  await sharp(src).extract(c.card).resize(640, 960).webp({ quality: 78 }).toFile(join(PUB, 'char', `${id}_card.webp`));
}

/* ---------- 1-2) 상품 썸네일 — 대표님이 보낸 시트(docs/대표님자료/상품썸네일_시트.png, 6열×4행)에서 잘라 쓴다 ---------- */
// 대표님이 직접 만든 시트(저작권 문제 없음 — 결정필요 D15 해결). 낱장 원본이 올 때까지 임시로 잘라 쓴다.
// 파일명 규칙: web/public/img/thumb/thumb_<상품id>.webp — 낱장 원본은 _incoming/thumb_<상품id>.png 로 넣으면 같은 이름으로 덮어쓰고,
// 그 상품은 시트에서 다시 잘라내지 않는다.
// ponytail: 시트 칸 위치를 고정값으로 자름 — 시트가 바뀌면 THUMB_COLS/ROWS 를 다시 맞출 것
const SHEET = join(root, 'docs/대표님자료/상품썸네일_시트.png');
const THUMB_COLS = [4, 236, 466, 694, 924, 1154];
const THUMB_ROWS = [[4, 155], [224, 338], [406, 522], [588, 685]];
const THUMB_IDS = [
  'jeongtong', 'pyeongsaeng', 'daewoon', 'ohaeng', 'wealth', 'career',
  'business', 'startup', 'exam', 'newyear', 'tojeong', 'monthly',
  'love', 'inyeon', 'marriage', 'lifelove', 'gunghap', 'couple',
  'spouse', 'reunion', 'fun_tarot', 'fun_dream', 'fun_mbti', 'fun_factbomb',
];
const thumbs = {};
if (existsSync(SHEET)) {
  mk(join(PUB, 'thumb'));
  for (const [i, id] of THUMB_IDS.entries()) {
    if (['png', 'jpg', 'jpeg', 'webp'].some((x) => existsSync(join(INCOMING, `thumb_${id}.${x}`)))) continue; // 낱장 원본 우선
    const [t, b] = THUMB_ROWS[Math.floor(i / 6)];
    const side = Math.min(b - t, 226);
    const left = THUMB_COLS[i % 6] + Math.round((226 - side) / 2);
    await sharp(SHEET).extract({ left, top: t, width: side, height: side }).resize(224, 224, { kernel: 'lanczos3' }).webp({ quality: 84 }).toFile(join(PUB, 'thumb', `thumb_${id}.webp`));
    thumbs[id] = `/img/thumb/thumb_${id}.webp`;
  }
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
  } else if (name.startsWith('thumb_')) {
    const d = out('thumb');
    await sharp(src).resize(448, 448, { fit: 'cover' }).webp({ quality: 82 }).toFile(join(d, `${name}.webp`)); // thumb_<id>.webp 덮어쓰기
    thumbs[name.slice(6)] = `/img/thumb/${name}.webp`;
  } else if (name.startsWith('tarot_')) {
    const d = out('tarot');
    await sharp(src).resize(300, 488, { fit: 'cover' }).webp({ quality: 82 }).toFile(join(d, `${name}.webp`));
    manifest[name] = { src: `/img/tarot/${name}.webp`, w: 300, h: 488 };
  } else if (name.startsWith('hero_')) {
    const d = out('banner');
    await sharp(src).resize(1200, 800, { fit: 'cover' }).webp({ quality: 78 }).toFile(join(d, `${name}.webp`));
    manifest[name] = { src: `/img/banner/${name}.webp`, w: 1200, h: 800 };
  } else if (name.startsWith('icon_') || name.startsWith('zodiac_') || name === 'loading_cheongung') {
    const d = out('icons');
    const sizes = name === 'loading_cheongung' ? [240, 480] : [128, 256];
    for (const s of sizes) await sharp(src).resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85 }).toFile(join(d, `${name}_${s}.webp`));
    manifest[name] = { src: `/img/icons/${name}_${sizes[1]}.webp`, w: sizes[0], h: sizes[0] };
  } else if (name === 'logo_brand') {
    // 대표님 상단 로고 배너(2048×768, 한지+먹색·금 글씨) — 모바일 최상단 헤더에 가로 꽉 차게
    const d = out('logo');
    const meta = await sharp(src).metadata();
    const h = (w) => Math.round((w * meta.height) / meta.width);
    for (const w of [780, 1200, 1600]) await sharp(src).resize(w, h(w)).webp({ quality: 84 }).toFile(join(d, `logo_brand_${w}.webp`));
    manifest[name] = { src: '/img/logo/logo_brand_780.webp', srcset: '/img/logo/logo_brand_780.webp 780w, /img/logo/logo_brand_1200.webp 1200w, /img/logo/logo_brand_1600.webp 1600w', w: 780, h: h(780) };
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
    await sharp(src).resize(1024, 1024).png().toFile(join(d, 'icon-1024.png'));
    // 웹 파비콘·홈 화면 아이콘도 같은 아이콘으로
    const fd = out('icons');
    for (const s of [32, 180, 192]) await sharp(src).resize(s, s).png().toFile(join(fd, `app_icon_${s}.png`));
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
  join(root, 'web/src/assets/thumbs.ts'),
  `// scripts/make-images.mjs 가 만드는 파일 — 상품 id → 썸네일. 없는 상품은 먹색+금 한자로 대체. 직접 고치지 말 것.
export const THUMBS: Partial<Record<string, string>> = ${JSON.stringify(thumbs, null, 2)};
`,
);
writeFileSync(
  join(root, 'web/src/assets/incoming.ts'),
  `// scripts/make-images.mjs 가 만드는 파일 — _incoming 에서 변환된 이미지 목록. 직접 고치지 말 것.\n` +
    `export const INCOMING: Partial<Record<string, { src: string; srcset?: string; w: number; h: number }>> = ${JSON.stringify(manifest, null, 2)};\n`,
);
console.log(`캐릭터 이미지 ✓ · _incoming ${files.length}개`);
report.forEach((r) => console.log(' ', r));
if (!existsSync(join(INCOMING, '.gitkeep'))) writeFileSync(join(INCOMING, '.gitkeep'), '');

// 앱 아이콘·스플래시 만들기 (npm run app:assets) — 원본: docs/assets-source/app_icon.png(대표님 앱 아이콘), logo_brand.png(상단 로고)
// 안드로이드 런처 아이콘(일반·원형·적응형 전경) + 스플래시(세로·가로 각 해상도)를 app/android/app/src/main/res 에 덮어쓴다.
import sharp from 'sharp';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RES = join(ROOT, 'app/android/app/src/main/res');
const ICON = join(ROOT, 'docs/assets-source/app_icon.png');
const LOGO = join(ROOT, 'docs/assets-source/logo_brand.png');
const HANJI = { r: 0xf5, g: 0xef, b: 0xe1, alpha: 1 };
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const meta = await sharp(ICON).metadata();
const m = Math.round(meta.width * 0.025); // 원본 바깥 여백(한지색) 잘라내기
const inner = await sharp(ICON).extract({ left: m, top: m, width: meta.width - m * 2, height: meta.height - m * 2 }).toBuffer();
const circle = (s) => Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);

for (const [k, x] of Object.entries(D)) {
  const dir = join(RES, `mipmap-${k}`);
  const s = Math.round(48 * x), f = Math.round(108 * x);
  await sharp(ICON).resize(s, s).png().toFile(join(dir, 'ic_launcher.png'));
  await sharp(inner).resize(s, s).composite([{ input: circle(s), blend: 'dest-in' }]).png().toFile(join(dir, 'ic_launcher_round.png'));
  // 적응형 전경: 108dp 캔버스에 그림을 꽉 채움(가장자리는 기기 모양으로 잘림, 가운데 글씨는 안전 영역 안)
  await sharp(inner).resize(f, f).png().toFile(join(dir, 'ic_launcher_foreground.png'));
}
writeFileSync(join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F5EFE1</color>\n</resources>\n');

// 스플래시: 한지색 바탕 가운데에 상단 로고(가로 70%)
for (const name of readdirSync(RES).filter((n) => n.startsWith('drawable'))) {
  const file = join(RES, name, 'splash.png');
  let w, h;
  try { ({ width: w, height: h } = await sharp(file).metadata()); } catch { continue; }
  const lw = Math.round(Math.min(w, h * 1.4) * 0.7);
  const logo = await sharp(LOGO).resize(lw).png().toBuffer();
  const lm = await sharp(logo).metadata();
  await sharp({ create: { width: w, height: h, channels: 4, background: HANJI } })
    .composite([{ input: logo, left: Math.round((w - lw) / 2), top: Math.round((h - lm.height) / 2) }]).png().toFile(file + '.tmp.png');
  await sharp(file + '.tmp.png').toFile(file);
  (await import('node:fs')).rmSync(file + '.tmp.png');
}
console.log('앱 아이콘·스플래시 ✓');

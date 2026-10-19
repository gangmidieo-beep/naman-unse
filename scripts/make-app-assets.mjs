// 앱 아이콘·스플래시 만들기 (npm run app:assets) — 원본: docs/assets-source/app_icon.png(대표님 앱 아이콘), logo_brand.png(상단 로고)
// 2026-10-19 대표님이 Play 등록용 새 아이콘(아이보리 바탕 + 붓글씨 '나만의 운세' + 運勢 낙관)을 보내 주심 → app_icon.png 교체(예전 것은 app_icon_v1_2026-10-07.png).
// 새 아이콘은 테두리 없이 바탕까지 꽉 찬 정사각형이라, 원형·적응형 아이콘은 글씨가 잘리지 않게 바탕색 여백을 두고 줄여 넣는다.
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
const IVORY = { r: 0xfe, g: 0xfc, b: 0xf2, alpha: 1 }; // 새 아이콘 바탕색
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const circle = (s) => Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);
// 바탕색 캔버스 가운데에 아이콘을 ratio 크기로 (원형 마스크·적응형 안전 영역에 글씨가 들어오게)
const padded = async (s, ratio, bg) => {
  const inner = Math.round(s * ratio);
  const img = await sharp(ICON).resize(inner, inner).png().toBuffer();
  return sharp({ create: { width: s, height: s, channels: 4, background: bg } }).composite([{ input: img, left: Math.round((s - inner) / 2), top: Math.round((s - inner) / 2) }]).png().toBuffer();
};

for (const [k, x] of Object.entries(D)) {
  const dir = join(RES, `mipmap-${k}`);
  const s = Math.round(48 * x), f = Math.round(108 * x);
  await sharp(ICON).resize(s, s).png().toFile(join(dir, 'ic_launcher.png'));
  await sharp(await padded(s, 0.9, IVORY)).composite([{ input: circle(s), blend: 'dest-in' }]).png().toFile(join(dir, 'ic_launcher_round.png'));
  // 적응형 전경: 108dp 캔버스(투명) 가운데 76% — 기기 모양(원·둥근 사각)으로 잘려도 글씨·낙관은 안전 영역 안
  await sharp(await padded(f, 0.76, { r: 0, g: 0, b: 0, alpha: 0 })).png().toFile(join(dir, 'ic_launcher_foreground.png'));
}
// Play 스토어 아이콘 512×512 (32비트 PNG, 테두리·모서리 없이 꽉 채움 — 둥근 모양은 Play 가 입힘)
await sharp(ICON).resize(512, 512).png().toFile(join(ROOT, 'docs/store/icon_512.png'));
await sharp(ICON).resize(512, 512).png().toFile(join(ROOT, 'docs/assets-source/app-icon/playstore-512.png'));
writeFileSync(join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FEFCF2</color>\n</resources>\n');

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

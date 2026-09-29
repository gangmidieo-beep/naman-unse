// 기준 시안과 구현 화면 나란히 비교 이미지 — node scripts/compare-mockup.mjs <구현캡처.png> <출력.png> [시안 화면 번호 0~2]
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const [oursPng, out, nth = '0'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
await p.goto(pathToFileURL(root + '/docs/시안/시안_v1.html').href + '#long', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const phone = p.locator('.phone').nth(+nth);
await phone.screenshot({ path: out + '.mock.png' });
await b.close();
const a = await sharp(out + '.mock.png').resize({ width: 390 }).toBuffer();
const o = await sharp(oursPng).resize({ width: 390 }).toBuffer();
const ha = (await sharp(a).metadata()).height, ho = (await sharp(o).metadata()).height;
const H = Math.max(ha, ho) + 60;
const label = (t, x) => ({ input: Buffer.from(`<svg width="390" height="50"><text x="195" y="34" font-size="24" font-weight="700" text-anchor="middle" font-family="Malgun Gothic" fill="#1E2748">${t}</text></svg>`), left: x, top: 0 });
await sharp({ create: { width: 390 * 2 + 60, height: H, channels: 3, background: '#E9E3D6' } })
  .composite([label('시안 v1', 20), label('구현 (web)', 430), { input: a, left: 20, top: 55 }, { input: o, left: 430, top: 55 }])
  .png().toFile(out);
console.log('ok', ha, ho);

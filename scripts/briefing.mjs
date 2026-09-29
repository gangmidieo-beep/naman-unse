// 브리핑 캡처 — node scripts/briefing.mjs [주소=http://localhost:5391] [폴더=docs/briefing/2026-09-30]
// 390×844, deviceScaleFactor 2 로 12개 화면을 찍고, 합본 3장 + 디자인 포인트 1장을 만든다. (dev 서버 또는 preview 서버가 떠 있어야 함)
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const BASE = process.argv[2] ?? 'http://localhost:5391';
const OUT = join(root, process.argv[3] ?? 'docs/briefing/2026-09-30');
mkdirSync(OUT, { recursive: true });
const brand = JSON.parse(readFileSync(join(root, 'brand.config.json'), 'utf8'));

const ME = { id: 'me1', name: '김순자', gender: 'F', year: 1964, month: 5, day: 21, calendar: 'solar', leap: false, hour: 6 };
const PARTNER = { id: 'p2', name: '박철수', gender: 'M', year: 1962, month: 11, day: 3, calendar: 'lunar', leap: false, hour: 20 };
const base = { fontScale: '100', notifyOn: false, notifyTime: '07:00', premium: false, purchases: [] };
const S = {
  intro: null,
  sample: { ...base, introSeen: true, profiles: [], mainId: null },
  me: { ...base, introSeen: true, profiles: [ME, PARTNER], mainId: 'me1' },
  bought: {
    ...base, introSeen: true, profiles: [ME, PARTNER], mainId: 'me1',
    purchases: [{ orderId: 'ODEMO1', productId: 'saju_wealth', profileId: 'me1', price: 9900, createdAt: '2026-09-30T09:00:00.000Z' }],
  },
};

const MAX_H = 2400; // 긴 화면은 위에서부터 이 높이(CSS px)까지
const SHOTS = [
  { file: '01_첫실행', title: '첫 실행', path: '/intro', state: 'intro' },
  { file: '02_정보입력', title: '정보 입력 (대화형)', path: '/profile/new', state: 'sample', act: async (p) => {
    await p.getByLabel('이름 또는 별명').fill('김순자');
    await p.getByRole('button', { name: '다음' }).click();
    await p.getByRole('button', { name: '여성' }).click();
    await p.getByRole('button', { name: '다음' }).click();
    await p.getByLabel('생년월일 8자리').fill('19640521');
    await p.getByRole('button', { name: '다음' }).click();
    await p.getByRole('button', { name: '다음' }).click();
    await p.getByRole('button', { name: /묘시/ }).click();
  } },
  { file: '03_홈_예시', title: '홈 (정보 입력 전 · 예시)', path: '/', state: 'sample', full: true },
  { file: '04_홈_내운세', title: '홈 (내 운세)', path: '/', state: 'me', full: true },
  { file: '05_오늘의운세', title: '오늘의 운세', path: '/today', state: 'me', full: true },
  { file: '06_재물상세', title: '재물운 상세', path: '/today/wealth', state: 'me', full: true },
  { file: '07_띠별운세', title: '띠별 운세 (말띠)', path: '/zodiac/horse', state: 'me', full: true },
  { file: '08_사주상담', title: '사주상담', path: '/consult', state: 'me', full: true, act: async (p) => {
    await p.getByRole('button', { name: '돈·재물' }).click();
  } },
  { file: '09_결제', title: '결제 (테스트)', path: '/checkout/saju_wealth', state: 'me', full: true, act: async (p) => {
    await p.getByRole('checkbox').check();
  } },
  { file: '10_풀이결과', title: '풀이 결과', path: '/reading/ODEMO1', state: 'bought', full: true, wait: 4500 },
  { file: '11_프리미엄', title: '프리미엄', path: '/premium', state: 'me', full: true },
  { file: '12_내정보', title: '내 정보', path: '/me', state: 'bought', full: true },
];

const browser = await chromium.launch();
const problems = [];
async function newPage(state) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
  const st = S[state];
  await page.addInitScript((s) => { if (s) localStorage.setItem('naman-unse', JSON.stringify({ state: s, version: 1 })); else localStorage.clear(); }, st);
  return page;
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
    for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
    scrollTo(0, 0);
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  await page.waitForTimeout(800);
}

for (const s of SHOTS) {
  const page = await newPage(s.state);
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.act) await s.act(page);
  await settle(page);
  const file = join(OUT, `${s.file}.png`);
  if (s.full) {
    await page.addStyleTag({ content: '.tabs{position:absolute!important}.toast{display:none!important}' });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width: 390, height: Math.min(h, MAX_H) } });
  } else {
    await page.addStyleTag({ content: '.toast{display:none!important}' });
    await page.screenshot({ path: file });
  }
  await page.close();
  console.log('✓', s.file);
}

/* ---------- 합본 ---------- */
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function montage(items, cols, out, heading) {
  const TW = 700, TH = 1516, LABEL = 70, GAP = 40, HEAD = heading ? 130 : 0;
  const rows = Math.ceil(items.length / cols);
  const W = cols * TW + (cols + 1) * GAP, H = HEAD + rows * (TH + LABEL + GAP) + GAP;
  const comps = [];
  if (heading) comps.push({ input: Buffer.from(`<svg width="${W}" height="${HEAD}"><text x="${W / 2}" y="86" font-size="56" font-weight="700" text-anchor="middle" font-family="Malgun Gothic, sans-serif" fill="#1E2748">${esc(heading)}</text></svg>`), left: 0, top: 0 });
  for (const [i, s] of items.entries()) {
    const x = GAP + (i % cols) * (TW + GAP), y = HEAD + GAP + Math.floor(i / cols) * (TH + LABEL + GAP);
    const img = sharp(join(OUT, `${s.file}.png`));
    const m = await img.metadata();
    const scaled = await img.resize({ width: TW }).toBuffer();
    const sh = Math.round((m.height * TW) / m.width);
    const tile = await sharp(scaled).extract({ left: 0, top: 0, width: TW, height: Math.min(sh, TH) }).toBuffer();
    comps.push({ input: Buffer.from(`<svg width="${TW}" height="${LABEL}"><rect x="0" y="8" rx="26" ry="26" width="${TW}" height="54" fill="#1E2748"/><text x="${TW / 2}" y="46" font-size="30" font-weight="700" text-anchor="middle" font-family="Malgun Gothic, sans-serif" fill="#fff">${esc(`${s.file.slice(0, 2)}. ${s.title}`)}</text></svg>`), left: x, top: y });
    comps.push({ input: await sharp({ create: { width: TW, height: TH, channels: 3, background: '#FBF7EE' } }).composite([{ input: tile, left: 0, top: 0 }]).png().toBuffer(), left: x, top: y + LABEL });
  }
  const path = join(OUT, out);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#EFE7D6' } }).composite(comps).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(path);
  console.log('✓', out, `${W}×${H}`, `${(statSync(path).size / 1048576).toFixed(1)}MB`);
}
// 가로 2400px 이내: 3열이면 칸 폭을 줄여서
async function fit(out) {
  const p = join(OUT, out), m = await sharp(p).metadata();
  if (m.width > 2400) {
    const buf = await sharp(p).resize({ width: 2400 }).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
    writeFileSync(p, buf);
  }
  const m2 = await sharp(p).metadata();
  console.log('  →', out, `${m2.width}×${m2.height}`, `${(statSync(p).size / 1048576).toFixed(1)}MB`);
}
await montage(SHOTS, 3, '전체화면_합본.png', '나만의 운세 · 1차 시안 전체 화면');
await fit('전체화면_합본.png');
await montage(SHOTS.slice(0, 7), 4, '무료흐름_합본.png', '무료 흐름 — 첫 실행 → 정보 입력 → 홈 → 오늘의 운세 → 분야 → 띠별');
await fit('무료흐름_합본.png');
await montage(SHOTS.slice(7), 3, '유료흐름_합본.png', '유료 흐름 — 상담 → 선택 → 결제 → 풀이');
await fit('유료흐름_합본.png');

/* ---------- 디자인 포인트 ---------- */
const cap = await newPage('me');
await cap.goto(BASE + '/', { waitUntil: 'networkidle' });
await settle(cap);
const freeCard = (await cap.locator('.card').first().screenshot()).toString('base64');
const rareCard = (await cap.locator('.rare').first().screenshot()).toString('base64');
await cap.close();
const face = (f) => readFileSync(join(root, 'web/public/img/char', f)).toString('base64');
const chips = ['--bg', '--surface', '--gold', '--gold-deep', '--navy', '--purple', '--lavender', '--rose', '--seal']
  .map((k) => `<div class="chip"><i style="background:${brand.colors[k]}"></i><b>${k.slice(2)}</b><span>${brand.colors[k]}</span></div>`).join('');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>
@font-face{font-family:P;src:local('Malgun Gothic')}
body{margin:0;background:#FBF7EE;font-family:'Pretendard','Malgun Gothic',sans-serif;color:#2A2320;width:1200px;padding:50px 60px;box-sizing:border-box}
h1{font-size:44px;margin:0 0 30px;color:#1E2748}
.two{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:40px}
.two>div{background:#fff;border-radius:24px;padding:28px;text-align:center;border:1px solid #EDE3CF}
.two h2{font-size:30px;margin:0 0 6px}.two p{font-size:20px;color:#5E554C;margin:0 0 20px}
.two img{max-width:100%;border-radius:18px}
.chips{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:36px}
.chip{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #EDE3CF;border-radius:16px;padding:12px 16px;font-size:20px}
.chip i{width:40px;height:40px;border-radius:50%;border:1px solid #0002}.chip span{margin-left:auto;color:#8C8278}
.type{background:#fff;border:1px solid #EDE3CF;border-radius:20px;padding:24px 28px;margin-bottom:36px}
.type .b{font-size:36px;line-height:1.6}.type .s{font-size:30px;color:#8C8278}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:20px;overflow:hidden;font-size:24px}
td,th{padding:16px;border-top:1px solid #EDE3CF;text-align:left}th{background:#F1EADB}
td img{width:72px;height:72px;border-radius:50%;vertical-align:middle;margin-right:12px}
</style><h1>나만의 운세 — 디자인 포인트</h1>
<div class="two"><div><h2>무료 = 일반 카드</h2><p>흰 카드 · 얇은 베이지 테두리 · 네이비 "매일 무료"</p><img src="data:image/png;base64,${freeCard}"></div>
<div><h2>유료 = 금색 레어 카드</h2><p>금색 테두리 · ✦ 프리미엄 배지 · 반짝임</p><img src="data:image/png;base64,${rareCard}" style="max-height:560px"></div></div>
<div class="chips">${chips}</div>
<div class="type"><div class="b">본문 18px (실제 화면의 2배로 표시) — 오늘은 서두르지 말고 들어주는 쪽이 복을 불러요.</div><div class="s">설명 16px 이 가장 작은 글씨 · 설정에서 크게/아주 크게(115%·130%)</div></div>
<table><tr><th>캐릭터</th><th>담당</th><th>말투</th></tr>
<tr><td><img src="data:image/webp;base64,${face('dosa_face.webp')}">천궁도령</td><td>정통사주 · 재물 · 직장 · 신년운세 · 부적</td><td>점잖은 하오체 "~하시게"</td></tr>
<tr><td><img src="data:image/webp;base64,${face('sunnyeo_face.webp')}">월하선녀</td><td>오늘의 운세 · 애정 · 궁합 · 띠별 · MBTI</td><td>다정한 해요체 "~해요"</td></tr></table></html>`;
const tmp = join(OUT, '_point.html');
writeFileSync(tmp, html);
const pp = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
await pp.goto(pathToFileURL(tmp).href);
await pp.screenshot({ path: join(OUT, 'briefing_포인트.png'), fullPage: true });
await pp.close();
const { unlinkSync } = await import('node:fs');
unlinkSync(tmp);
console.log('✓ briefing_포인트.png');
await browser.close();
if (problems.length) { console.error('콘솔 에러:', [...new Set(problems)]); process.exit(1); }

// 브리핑 캡처 — node scripts/briefing.mjs <세트: v2|extra> [주소=http://localhost:5391]
// 390×844, deviceScaleFactor 2 로 화면을 찍고 합본을 만든다(가로 2400px 이내). dev 또는 preview 서버가 떠 있어야 한다.
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const SET = process.argv[2] ?? 'v2';
const BASE = process.argv[3] ?? 'http://localhost:5391';

const ME = { id: 'me1', name: '김순자', gender: 'F', year: 1964, month: 5, day: 21, calendar: 'solar', leap: false, hour: 6, relation: '나', bloodType: 'A', mbti: 'ISFJ' };
const SPOUSE = { id: 'p2', name: '박철수', gender: 'M', year: 1962, month: 11, day: 3, calendar: 'lunar', leap: false, hour: 20, relation: '배우자' };
const base = { fontScale: '100', notifyOn: true, notifyTime: '07:00', eventNotify: true, pushConsent: true, plan: null, purchases: [], talismans: [], account: null, adViews: { date: '', count: 0, last: 0 }, unlocked: {} };
const T0 = '2026-09-30T09:00:00.000Z';
const BOUGHT = {
  purchases: [
    { orderId: 'ODEMO1', productId: 'wealth', profileId: 'me1', price: 19000, createdAt: T0, kind: 'reading', status: 'paid' },
    { orderId: 'ODEMO2', productId: 'spouse', profileId: 'me1+p2', price: 29000, createdAt: '2026-09-29T09:00:00.000Z', kind: 'reading', status: 'paid' },
    { orderId: 'ODEMO3', productId: 'newyear', profileId: 'me1', price: 29000, createdAt: '2026-09-28T09:00:00.000Z', kind: 'reading', status: 'paid' },
    { orderId: 'ODEMO4', productId: 't_wealth', profileId: 'me1', price: 14900, createdAt: T0, kind: 'talisman', status: 'paid' },
  ],
  talismans: [{ id: 'tm1', talismanId: 't_wealth', orderId: 'ODEMO4', name: '김순자', birth: '양력 1964년 5월 21일', wish: '올해 안에 내 집 마련하기', issuedAt: '2026-09-30' }],
  account: { provider: 'mock', id: 'g-1', name: 'Google 계정(테스트)' },
};
const today = new Date().toISOString().slice(0, 10);
const S = {
  intro: null,
  sample: { ...base, introSeen: true, profiles: [], mainId: null },
  me: { ...base, introSeen: true, profiles: [ME, SPOUSE], mainId: 'me1' },
  bought: { ...base, introSeen: true, profiles: [ME, SPOUSE], mainId: 'me1', ...BOUGHT },
  // 보상형 광고를 이미 본 상태(결과가 열린 화면 캡처용)
  opened: { ...base, introSeen: true, profiles: [ME, SPOUSE], mainId: 'me1', ...BOUGHT, unlocked: { 'blood:A': today, 'mbti:ISFJ': today, 'zodiac:dragon': today, [`today:me1:${today.replace(/-/g, '')}`]: today } },
  premium: { ...base, introSeen: true, profiles: [ME, SPOUSE], mainId: 'me1', ...BOUGHT, plan: 'yearly', planUntil: '2027-09-30' },
};

const SETS = {
  v2: {
    out: 'docs/briefing/2026-09-30-v2',
    shots: [
      { file: '01_홈', title: '홈', path: '/', state: 'me', full: true, maxH: 4200 },
      { file: '02_오늘의운세', title: '오늘의 운세', path: '/today', state: 'me', full: true },
      { file: '03_나만의운명', title: '나만의 운명 (천궁도사)', path: '/fate', state: 'me', full: true },
      { file: '04_상품상세_재물운', title: '상품 상세 · 재물운', path: '/product/wealth', state: 'me', full: true },
      { file: '05_나만의인연', title: '나만의 인연 (월하선녀)', path: '/love?g=두 사람의 인연', state: 'me', full: true },
      { file: '06_결과_운명서', title: '결과 · 나의 운명서', path: '/reading/ODEMO1', state: 'bought', full: true, wait: 4500 },
      { file: '07_나만의부적', title: '나만의 부적', path: '/talisman', state: 'me', full: true },
      { file: '08_부적상세_재물운', title: '부적 상세 · 재물운 부적', path: '/talisman/t_wealth', state: 'me', full: true },
      { file: '09_부적완성', title: '부적 완성', path: '/talisman/t_wealth/make?order=ODEMO4', state: 'bought', full: true },
      { file: '10_나의운세함', title: '나의 운세함', path: '/box', state: 'bought', full: true },
      { file: '11_프리미엄', title: '프리미엄', path: '/premium', state: 'me', full: true },
    ],
    montages: [
      { out: '전체화면_합본.png', pick: 'all', cols: 4, heading: '나만의 운세 · 2차 시안 (디자인 v2)' },
      { out: '운명인연흐름_합본.png', pick: ['03', '04', '05', '06', '10'], cols: 5, heading: '운명·인연 — 목록 → 상세 → 결제 → 운명서·인연서 → 운세함' },
      { out: '부적흐름_합본.png', pick: ['07', '08', '09', '10'], cols: 4, heading: '부적 — 목록 → 설명서·효험·사용법 → 소원 새긴 부적 → 부적함' },
    ],
  },
  extra: {
    out: `docs/briefing/${today}-추가요청`,
    shots: [
      { file: '01_별자리', title: '별자리 운세', path: '/fun/zodiac-star', state: 'me', full: true },
      { file: '02_혈액형', title: '혈액형 운세', path: '/fun/blood', state: 'opened', full: true },
      { file: '03_타로', title: '오늘의 타로', path: '/fun/tarot', state: 'premium', full: true, act: async (p) => { await p.getByRole('button', { name: '2번째 카드 고르기' }).click(); await p.waitForTimeout(900); } },
      { file: '04_꿈해몽', title: '꿈 해몽', path: '/fun/dream', state: 'premium', full: true, act: async (p) => { await p.getByLabel('꿈 검색').fill('돼지꿈'); await p.getByRole('button', { name: '풀이' }).click(); } },
      { file: '05_팩폭사주', title: 'MZ 팩폭 사주', path: '/fun/factbomb', state: 'me', full: true },
      { file: '06_MBTI사주', title: 'MBTI 사주', path: '/fun/mbti', state: 'opened', full: true },
      { file: '07_토정비결', title: '토정비결 상세', path: '/product/tojeong', state: 'me', full: true },
      { file: '08_로그인', title: '로그인', path: '/login', state: 'me' },
      { file: '09_공유시트', title: '공유 시트', path: '/today', state: 'opened', act: async (p) => { await p.getByRole('button', { name: '결과 이미지로 공유하기' }).click(); await p.waitForTimeout(400); } },
      { file: '10_띠별', title: '띠별 운세', path: '/zodiac/dragon', state: 'opened', full: true },
    ],
    montages: [{ out: '추가요청_합본.png', pick: 'all', cols: 5, heading: '추가 요청 — 재미로 보는 운세·토정비결·로그인·공유' }],
  },
  admin: {
    out: `docs/briefing/${today}-추가요청/관리자`,
    shots: ['dashboard', 'members', 'products', 'banners', 'payments', 'push', 'ads', 'stats'].map((k, i) => ({
      file: `${String(i + 1).padStart(2, '0')}_${k}`, title: k, path: `/admin/${k}`, state: 'admin', viewport: { width: 1280, height: 860 }, full: true, maxH: 1800,
    })),
    montages: [],
  },
};
const cfg = SETS[SET];
const OUT = join(root, cfg.out);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const problems = [];
for (const s of cfg.shots) {
  const vp = s.viewport ?? { width: 390, height: 844 };
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: s.viewport ? 1 : 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  page.on('pageerror', (e) => problems.push(`${s.file}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`${s.file}: ${m.text()}`));
  const st = S[s.state];
  await page.addInitScript((x) => { if (x) localStorage.setItem('naman-unse', JSON.stringify({ state: x, version: 2 })); else if (x === null) localStorage.clear(); }, st ?? null);
  if (s.state === 'admin') await page.addInitScript(() => localStorage.setItem('naman-admin', JSON.stringify({ token: 'dev', email: 'admin@local' })));
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.act) await s.act(page);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
    for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); }
    scrollTo(0, 0);
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  await page.waitForTimeout(700);
  const file = join(OUT, `${s.file}.png`);
  if (s.full) {
    await page.addStyleTag({ content: '.tabs,.sticky{position:absolute!important}.toast{display:none!important}' });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width: vp.width, height: Math.min(h, s.maxH ?? 2600) } });
  } else {
    await page.addStyleTag({ content: '.toast{display:none!important}' });
    await page.screenshot({ path: file });
  }
  await page.close();
  console.log('✓', s.file);
}
await browser.close();

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function montage(items, cols, out, heading) {
  const TW = 700, TH = 1516, LABEL = 70, GAP = 40, HEAD = 130;
  const rows = Math.ceil(items.length / cols);
  const W = cols * TW + (cols + 1) * GAP, H = HEAD + rows * (TH + LABEL + GAP) + GAP;
  const comps = [{ input: Buffer.from(`<svg width="${W}" height="${HEAD}"><text x="${W / 2}" y="86" font-size="54" font-weight="700" text-anchor="middle" font-family="Noto Serif KR, Malgun Gothic, serif" fill="#1C1A17">${esc(heading)}</text></svg>`), left: 0, top: 0 }];
  for (const [i, s] of items.entries()) {
    const x = GAP + (i % cols) * (TW + GAP), y = HEAD + GAP + Math.floor(i / cols) * (TH + LABEL + GAP);
    const img = sharp(join(OUT, `${s.file}.png`));
    const m = await img.metadata();
    const scaled = await img.resize({ width: TW }).toBuffer();
    const sh = Math.round((m.height * TW) / m.width);
    const tile = await sharp(scaled).extract({ left: 0, top: 0, width: TW, height: Math.min(sh, TH) }).toBuffer();
    comps.push({ input: Buffer.from(`<svg width="${TW}" height="${LABEL}"><rect x="0" y="8" rx="26" ry="26" width="${TW}" height="54" fill="#1C1A17"/><text x="${TW / 2}" y="46" font-size="30" font-weight="700" text-anchor="middle" font-family="Malgun Gothic, sans-serif" fill="#E6C877">${esc(`${s.file.slice(0, 2)}. ${s.title}`)}</text></svg>`), left: x, top: y });
    comps.push({ input: await sharp({ create: { width: TW, height: TH, channels: 3, background: '#F5EFE1' } }).composite([{ input: tile, left: 0, top: 0 }]).png().toBuffer(), left: x, top: y + LABEL });
  }
  let buf = await sharp({ create: { width: W, height: H, channels: 3, background: '#D9D2C3' } }).composite(comps).png().toBuffer();
  if (W > 2400) buf = await sharp(buf).resize({ width: 2400 }).png().toBuffer();
  buf = await sharp(buf).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  writeFileSync(join(OUT, out), buf);
  const m = await sharp(buf).metadata();
  console.log('✓', out, `${m.width}×${m.height}`, `${(statSync(join(OUT, out)).size / 1048576).toFixed(1)}MB`);
}
for (const m of cfg.montages) {
  const items = m.pick === 'all' ? cfg.shots : cfg.shots.filter((s) => m.pick.includes(s.file.slice(0, 2)));
  await montage(items, m.cols, m.out, m.heading);
}
if (problems.length) { console.error('콘솔 에러:', [...new Set(problems)]); process.exit(1); }

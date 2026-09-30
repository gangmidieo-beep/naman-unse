// 17번(구조 v3) 브리핑 캡처 — 390×844. dev 서버(5391)가 떠 있어야 한다: npm run dev -w web
// 사용: node scripts/briefing-v3.mjs [출력 폴더=docs/briefing/2026-10-01-v3]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5391';
const OUT = process.argv[2] ?? 'docs/briefing/2026-10-01-v3';
mkdirSync(OUT, { recursive: true });
const ME = { id: 'me1', name: '김순자', gender: 'F', year: 1964, month: 5, day: 21, calendar: 'solar', leap: false, hour: 6, relation: '나' };
const order = (orderId, productId, price) => ({ orderId, productId, profileId: 'me1', price, createdAt: '2026-09-30T10:00:00Z', kind: 'reading', status: 'paid' });
const STATE = {
  introSeen: true, profiles: [ME], mainId: 'me1', fontScale: '100', notifyOn: false, notifyTime: '07:00', plan: null, pushConsent: true,
  purchases: [order('ord-wealth', 'wealth', 19000), order('ord-gh', 'gunghap', 19000), order('ord-tarot', 'tarot_love', 9900)],
  talismans: [{ id: 'm1', talismanId: 't_wealth', orderId: 'ord-bj', name: '김순자', birth: '1964.05.21', wish: '올해 안에 내 집 마련', issuedAt: '2026-09-30T10:00:00Z' }],
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
await ctx.addInitScript((s) => { if (!localStorage.getItem('naman-unse')) localStorage.setItem('naman-unse', JSON.stringify({ state: s, version: 2 })); }, STATE);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function go(path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager')));
  await page.waitForTimeout(400);
}
const shot = async (name, full = false) => { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('✓', name); };

await go('/');
await shot('01_홈_첫화면');
await page.locator('.banner-nav button[aria-label="다음 배너"]').click();
await page.waitForTimeout(700);
await page.locator('.banner-wrap').scrollIntoViewIfNeeded();
await shot('02_홈_롤링배너_2장째');
await go('/');
await shot('03_홈_전체', true);
await go('/unse');
await shot('04_운세탭_목록형');
await go('/unse?view=grid');
await shot('05_운세탭_그리드형');
await go('/unse?cat=love&view=grid');
await shot('06_운세탭_월하선녀_그리드');
await go('/product/wealth');
await shot('07_상품상세_재물운', true);
await go('/product/tarot_love');
await shot('08_상품상세_연애타로');
await go('/reading/ord-wealth');
await page.locator('.recom').scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await shot('09_결과_부적추천');
await go('/tarot');
await page.getByRole('button', { name: '카드 섞고 펼치기' }).click();
await page.waitForTimeout(700);
await page.getByRole('button', { name: '2번째 카드 고르기' }).click();
await page.waitForTimeout(1600);
await shot('10_타로탭_뒤집힌카드');
await go('/tarot');
await shot('11_타로탭_전체', true);
await go('/reading/ord-tarot');
await page.getByRole('button', { name: '모두 뒤집기' }).click();
await page.waitForTimeout(1000);
await page.locator('.treading').scrollIntoViewIfNeeded();
await shot('12_연애타로_결과');
await go('/talisman');
await shot('13_부적탭');
await go('/box');
await shot('14_운세함', true);
await go('/fun/small');
await shot('15_스몰사주');
await go('/fun/oneline');
await shot('16_한줄사주');
await go('/product/palm');
await shot('17_손금_상세');
await browser.close();
console.log(errors.length ? `콘솔 에러 ${errors.length}: ${errors.join(' | ')}` : '콘솔 에러 없음');

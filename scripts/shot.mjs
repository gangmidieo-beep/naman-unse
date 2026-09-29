// 화면 캡처 도구 — node scripts/shot.mjs <base> <out.png> <path> [state=sample|me|intro] [--full] [--scale=2]
// 콘솔 에러·가로 스크롤·16px 미만 글자(배지·탭 라벨 등 예외 제외)를 함께 검사해 출력한다.
import { chromium } from '@playwright/test';

const [base, out, path, state = 'sample', ...flags] = process.argv.slice(2);
const full = flags.includes('--full');
const scale = +(flags.find((f) => f.startsWith('--scale='))?.split('=')[1] ?? 2);
const ME = { id: 'me1', name: '김순자', gender: 'F', year: 1964, month: 5, day: 21, calendar: 'solar', leap: false, hour: 6 };
const STATES = {
  intro: null,
  sample: { introSeen: true, profiles: [], mainId: null },
  me: { introSeen: true, profiles: [ME], mainId: 'me1' },
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
const st = STATES[state];
await page.addInitScript((s) => {
  if (s && !localStorage.getItem('naman-unse')) localStorage.setItem('naman-unse', JSON.stringify({ state: { fontScale: '100', notifyOn: false, notifyTime: '07:00', premium: false, purchases: [], ...s }, version: 1 }));
}, st);
await page.goto(base + path, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// 지연 로딩 이미지를 모두 불러오기(가로 스크롤 포함) → 맨 위로
await page.evaluate(async () => {
  document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
  for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
  scrollTo(0, 0);
  await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
});
if (full) await page.addStyleTag({ content: '.tabs{position:absolute!important}.toast{display:none}' });
await page.waitForTimeout(900);
const report = await page.evaluate(() => {
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  const EXEMPT = '.tag,.badge-p,.sample,.lock,.tab,.pill,.sec small,.bubble .say small,.price small,.price s,.ad,.seal';
  const small = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (el.closest(EXEMPT) || el.closest('[aria-hidden="true"]')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 15.9 && el.getClientRects().length) small.push(`${el.tagName.toLowerCase()}.${el.className} ${fs}px "${el.textContent.trim().slice(0, 20)}"`);
  }
  return { overflow, small: [...new Set(small)].slice(0, 10) };
});
await page.screenshot({ path: out, fullPage: full });
console.log(JSON.stringify({ path, errors, ...report }));
await browser.close();

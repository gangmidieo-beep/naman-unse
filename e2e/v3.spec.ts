// 구조 v3: 롤링 배너(자동 넘김·스와이프) · 프리미엄 광고 0 · 앱(Capacitor)에서는 애드센스 미로드
import { test, expect, type Page } from '@playwright/test';

const seed = (page: Page, extra: Record<string, unknown> = {}) =>
  page.addInitScript((x) => localStorage.setItem('naman-unse', JSON.stringify({ state: { introSeen: true, profiles: [], purchases: [], talismans: [], notifyOn: true, ...x }, version: 2 })), extra);
const count = (page: Page) => page.locator('.banner-count');

test('롤링 배너: 4초 자동 넘김 + 손가락(마우스) 스와이프 + 무한 루프', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await expect(count(page)).toHaveText('1 / 10');
  await expect(count(page)).toHaveText('2 / 10', { timeout: 6000 });
  // 왼쪽으로 끌면 다음 장
  const box = (await page.locator('.banner-view').boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 70, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, y, { steps: 8 });
  await page.mouse.up();
  await expect(count(page)).toHaveText('3 / 10');
  // 오른쪽으로 세 번 끌면 1 → 10 (무한 루프)
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(500);
    await page.mouse.move(box.x + 70, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 70, y, { steps: 8 });
    await page.mouse.up();
  }
  await expect(count(page)).toHaveText('10 / 10');
  // 드래그 뒤 링크로 넘어가지 않음
  await expect(page).toHaveURL(/\/$/);
});

test('프리미엄 회원은 광고가 하나도 없다', async ({ page }) => {
  await seed(page, { plan: 'monthly' });
  for (const path of ['/', '/tarot', '/fun/blood', '/fun/small', '/zodiac']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('complementary', { name: '광고' })).toHaveCount(0);
    await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
  }
});

test('일반 회원은 광고 자리가 보인다(웹 = 애드센스 자리)', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: '광고' })).toHaveAttribute('data-ad-provider', /placeholder|adsense/);
});

test('앱(Capacitor) 안에서는 애드센스 스크립트를 불러오지 않고 AdMob 자리만', async ({ page }) => {
  await page.addInitScript(() => { (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' }; });
  await seed(page);
  const adsense: string[] = [];
  page.on('request', (r) => r.url().includes('googlesyndication') && adsense.push(r.url()));
  for (const path of ['/', '/tarot', '/fun/blood']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('complementary', { name: '광고' }).first()).toHaveAttribute('data-ad-provider', 'admob');
  }
  expect(await page.locator('script[src*="googlesyndication"]').count()).toBe(0);
  expect(adsense).toEqual([]);
});

test('유료 타로 결과(카드 뒤집기) · 손금 사진 흐름(동의→업로드→결과→삭제 안내) · 부적 추천', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const o = (orderId: string, productId: string) => ({ orderId, productId, profileId: 'sample', price: 9900, createdAt: '2026-09-30T10:00:00Z', kind: 'reading', status: 'paid' });
  await seed(page, { purchases: [o('ord-t1', 'tarot_love'), o('ord-p1', 'palm')] });
  await page.goto('/reading/ord-t1');
  await expect(page.getByRole('heading', { name: '오늘의 카드가 전하는 이야기' }).first()).toBeVisible();
  await page.getByRole('button', { name: '모두 뒤집기' }).click();
  await expect(page.getByText(/1\. 그 사람의 마음/)).toBeVisible();
  await expect(page.getByRole('region', { name: '추천 부적' }).getByRole('link')).toHaveCount(2);

  await page.goto('/reading/ord-p1');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '동의하고 사진 올리기' }).isDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '동의하고 사진 올리기' }).click();
  await page.locator('input[type=file]').setInputFiles('web/public/favicon.svg');
  await page.getByRole('button', { name: '풀이 시작하기' }).click();
  await expect(page.getByText(/손금을 살피고 있소/)).toBeVisible();
  await expect(page.getByText('올려 주신 사진은 풀이 직후 삭제되었어요', { exact: false })).toBeVisible({ timeout: 8000 });
  await expect(page.locator('img[alt="올린 사진 미리보기"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

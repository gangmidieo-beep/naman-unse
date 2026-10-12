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
  await page.locator('.banner-view').evaluate((el) => el.scrollIntoView({ block: 'center' })); // 하단 탭에 가리지 않게
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
  // 실전 타로 테이블: 섞기 → 펼친 카드에서 3장 고르기 → 뒤집기 → 종합 메시지
  await page.getByRole('button', { name: /카드 섞고 펼치기/ }).click();
  for (const n of [3, 8, 15]) await page.getByRole('button', { name: `${n}번째 카드 고르기`, exact: true }).dispatchEvent('click'); // 부채꼴로 겹친 카드라 해당 카드에 직접 클릭
  await page.getByRole('button', { name: /그 사람의 마음 카드 뒤집기/ }).click();
  await expect(page.getByText(/1\. 그 사람의 마음/)).toBeVisible();
  await page.getByRole('button', { name: '한 번에 모두 뒤집기' }).click();
  await expect(page.getByText(/월하선녀의 종합 메시지/)).toBeVisible();
  await expect(page.getByRole('region', { name: '추천 부적' }).getByRole('link')).toHaveCount(2);

  // 손금: 어두운 촬영 화면(동의 → 사진 찍기/앨범) → 풀이 → 7개 선 결과 → 사진 삭제 안내
  await page.goto('/reading/ord-p1');
  await expect(page.getByRole('button', { name: /앨범에서 찾기/ })).toHaveCount(0);
  await page.getByRole('checkbox').check();
  await page.locator('input[type=file]:not([capture])').setInputFiles('web/public/favicon.svg');
  await page.getByRole('button', { name: /풀이 시작하기/ }).click();
  await expect(page.getByText(/손금을 살피고 있소/)).toBeVisible();
  await expect(page.getByText('올려 주신 사진은 풀이 직후 삭제되었어요', { exact: false })).toBeVisible({ timeout: 8000 });
  for (const t of ['생명선', '두뇌선', '감정선', '운명선', '태양선', '결혼선', '재물선']) await expect(page.getByRole('heading', { name: new RegExp(t) })).toBeVisible();
  await expect(page.locator('img[alt="올린 사진 미리보기"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('프리미엄 안내 버튼 → 팝업(월 6,900 / 연 59,000, 정가 82,800) · PC 화면은 넓게(상단 메뉴·목록 4열)', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  await page.getByRole('button', { name: /프리미엄 멤버십/ }).click();
  const dlg = page.getByRole('dialog', { name: '나만의 운세 프리미엄' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText('6,900원')).toBeVisible();
  await expect(dlg.getByText('59,000원')).toBeVisible();
  await expect(dlg.getByText('82,800원')).toBeVisible();
  await dlg.getByRole('button', { name: '닫기' }).click();
  await expect(dlg).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/unse?cat=fate');
  const nav = (await page.getByRole('navigation', { name: '주 메뉴' }).boundingBox())!;
  expect(nav.y).toBeLessThan(5); // 하단 탭 → 상단 메뉴
  const cards = page.locator('.plist .row4');
  const [a, b] = [(await cards.nth(0).boundingBox())!, (await cards.nth(3).boundingBox())!];
  expect(Math.abs(a.y - b.y)).toBeLessThan(2); // 한 줄에 4개
  expect((await page.locator('.app').boundingBox())!.width).toBeGreaterThan(1000);
});

// v2 시나리오: 첫 실행 → 사주 입력(푸시 동의) → 홈 → 오늘의 운세(보상형 광고 → 상세) → 나만의 운명 → 상품 상세 → 로그인 → 결제(mock)
// → 운명서 → 부적 상세 → 결제 → 소원 → 작성 연출 → 완성 → 나의 운세함에 보관
import { test, expect } from '@playwright/test';

test('v2 무료 → 유료 → 부적 흐름이 끝까지 에러 없이 간다', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await expect(page).toHaveURL(/\/intro/);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '내 사주 정보 입력하기' }).click();

  // 대화형 입력
  await page.getByLabel('이름 또는 별명').fill('김순자');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '여성' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('생년월일 8자리').fill('19640521');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: /음력\s*평달/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: /묘시/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('radio', { name: /네, 받을게요/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('음력 1964년 5월 21일')).toBeVisible();
  await page.getByRole('button', { name: '저장하고 운세 보기' }).click();

  // 홈 → 오늘의 운세
  await expect(page.getByRole('heading', { name: /김순자님, 오늘의 운세예요/ })).toBeVisible();
  await page.getByRole('link', { name: '오늘의 운세 자세히 보기' }).click();
  await expect(page.getByLabel('오늘의 총운')).toBeVisible();
  await page.getByRole('button', { name: /상세 풀이 보기/ }).click();
  await page.getByRole('button', { name: '풀이 열기' }).click({ timeout: 8000 });
  await expect(page.getByRole('region', { name: '상세 풀이' })).toBeVisible();

  // 나만의 운명 → 재물운 상세 → 결제
  await page.getByRole('link', { name: /나만의 운명/ }).first().click();
  await page.getByRole('tab', { name: '재물과 성공' }).click();
  await page.getByRole('link', { name: /재물운/ }).first().click();
  await expect(page.getByText('운명서에 담기는 내용')).toBeVisible();
  await page.getByRole('button', { name: '천궁도사의 상세풀이 받기' }).click();
  await page.getByRole('button', { name: 'Google로 시작하기' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /결제하고 운명서 열어보기/ }).click();
  await expect(page.getByText('별을 읽고 있소…')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { name: '천궁도사가 풀어드린 나의 운명서' }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('table', { name: /원국/ })).toBeVisible();

  // 부적
  await page.goto('/talisman/t_wealth');
  await expect(page.getByText('부적 설명서')).toBeVisible();
  await page.getByRole('button', { name: /나만의 재물부적 받기/ }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /결제하고 부적 받기/ }).click();
  await page.getByLabel('나의 소원').fill('올해 안에 내 집 마련하기');
  await page.getByRole('button', { name: '소원 담아 부적 쓰기' }).click();
  await expect(page.getByText(/마음을 담아/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /완성되었습니다/ })).toBeVisible({ timeout: 15_000 });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '휴대폰에 저장하기' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);

  // 나의 운세함 보관
  await page.goto('/box');
  await expect(page.getByRole('link', { name: /재물운.*다시 열어보기/ })).toBeVisible();
  await expect(page.getByText('재물운 부적').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('재미로 보는 운세 6종이 열린다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('naman-unse', JSON.stringify({ state: { introSeen: true, profiles: [], plan: 'monthly', purchases: [], talismans: [] }, version: 2 })));
  for (const [path, text] of [['/fun/zodiac-star', '별자리'], ['/fun/blood', '혈액형'], ['/fun/tarot', '타로'], ['/fun/dream', '꿈 해몽'], ['/fun/factbomb', '팩폭'], ['/fun/mbti', 'MBTI']] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: new RegExp(text) }).first()).toBeVisible();
  }
  await page.goto('/fun/dream');
  await page.getByLabel('꿈 검색').fill('이빨 빠지는 꿈');
  await page.getByRole('button', { name: '풀이' }).click();
  await expect(page.getByText(/상황별 상세 해몽/)).toBeVisible();
  await page.goto('/fun/tarot');
  await page.getByRole('button', { name: '2번째 카드 고르기' }).click();
  await expect(page.getByText(/오늘의 카드/)).toBeVisible();
  expect(errors).toEqual([]);
});

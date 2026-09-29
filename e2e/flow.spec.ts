// 시나리오: 첫 실행 → 입력 → 홈 → 오늘의 운세 → 상담 → 상품 선택 → 결제(mock) → 대기 → 결과 → 이미지 저장 버튼
import { test, expect } from '@playwright/test';

test('무료 → 유료 흐름이 끝까지 에러 없이 간다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await expect(page).toHaveURL(/\/intro/);
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '시작하기' }).click();

  // 예시 홈
  await expect(page.getByText('예시', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: /내 정보를 입력/ }).click();

  // 대화형 입력
  await page.getByLabel('이름 또는 별명').fill('김순자');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '여성' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('생년월일 8자리').fill('19640521');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '음력' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: /묘시/ }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByText('음력 1964년 5월 21일')).toBeVisible();
  await page.getByRole('button', { name: '저장하고 운세 보기' }).click();

  // 개인화된 홈
  await expect(page.getByRole('heading', { name: /김순자님/ })).toBeVisible();
  await expect(page.getByText('예시', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '오늘의 운세 자세히 보기 ›' }).click();
  await expect(page.getByLabel('오늘의 점수')).toBeVisible();
  await page.getByRole('link', { name: '재물 자세히' }).click();
  await expect(page.getByText(/프리미엄 회원에게 열려요/)).toBeVisible();

  // 상담 → 선택 → 결제
  await page.getByRole('link', { name: '사주상담' }).click();
  await page.getByRole('button', { name: '돈·재물' }).click();
  await expect(page.getByText('돈·재물 고민이에요')).toBeVisible();
  await page.getByRole('button', { name: /결제하고 풀이 받기/ }).click();
  await expect(page).toHaveURL(/\/checkout\/saju_wealth/);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /결제하기/ }).click();

  // 대기 → 결과
  await expect(page.getByText('별을 읽고 있소…')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('navigation', { name: '목차' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('table', { name: /원국/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /이미지로 저장/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);

  // 내 정보에 구매 풀이가 남는다
  await page.goto('/me');
  await expect(page.getByRole('link', { name: /정통사주 · 재물편/ })).toBeVisible();
  expect(errors).toEqual([]);
});

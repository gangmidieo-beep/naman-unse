// v3 시나리오: 첫 실행 → 사주 입력(푸시 동의) → 홈 → 오늘의 운세(보상형 광고 → 상세) → 운세 탭 → 상품 상세 → 로그인 → 결제(mock)
// → 운명서 → 부적 상세 → 결제 → 소원 → 작성 연출 → 완성 → 나의 운세함에 보관
import { test, expect } from '@playwright/test';

test('v2 무료 → 유료 → 부적 흐름이 끝까지 에러 없이 간다', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/');
  await expect(page).toHaveURL(/\/intro/);
  // 첫 방문 인트로 영상(약 7초, 영상이 늦거나 못 틀면 바로 홈) 뒤 홈 — 들어갈 때 사주 입력 없음(대표님 요청 2026-10-12·10-15)
  await expect(page.getByLabel('나만의 운세 인트로')).toBeVisible();
  await expect(page).toHaveURL(/\/$/, { timeout: 12000 });
  await expect(page.getByText('예시', { exact: true }).first()).toBeVisible();

  // "오늘의 운세 자세히 보기"를 처음 누를 때 한 번만 사주 입력(푸시 동의 포함) → 오늘의 운세
  await page.getByRole('link', { name: '오늘의 운세 자세히 보기' }).click();
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
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByLabel('오늘의 총운')).toBeVisible();
  await expect(page.getByText(/김순자님, 오늘의 운세예요/)).toBeVisible();
  await page.getByRole('button', { name: /상세 풀이 보기/ }).click();
  // 보상형 광고 게이트(실제 플랫폼 연동 구조): 광고 보기 선택 → (시험 모드 가짜 광고 5초) → 보상 → 풀이 열림
  await page.getByRole('button', { name: '광고 보고 풀이 열기' }).click();
  await page.getByRole('button', { name: '풀이 열기' }).click({ timeout: 12000 });
  await expect(page.getByRole('region', { name: '상세 풀이' })).toBeVisible();

  // 운세 탭 → 운명·사주 → 재물운 상세(공통 템플릿) → 결제
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: /운세$/ }).first().click();
  await page.getByRole('tab', { name: /운명·사주/ }).click();
  await page.getByRole('link', { name: /재물운 나는 언제 돈이/ }).first().click();
  await expect(page.getByRole('heading', { name: '재물운이란?' })).toBeVisible();
  await expect(page.getByText('운명서에 담기는 내용')).toBeVisible();
  await expect(page.getByText('이런 분께 필요해요')).toBeVisible();
  await page.getByRole('button', { name: /내 재물운 상세풀이 보기/ }).click();
  await page.getByRole('button', { name: 'Google로 시작하기' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /결제하고 운명서 열어보기/ }).click();
  await expect(page.getByText('별을 읽고 있소…')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { name: '천궁도사가 풀어드린 나의 운명서' }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('table', { name: /원국/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /대운표/ })).toBeVisible(); // 정통 분석표(대운·세운·월운)
  await expect(page.getByRole('heading', { name: /월운표/ })).toBeVisible();
  // 결과 맨 아래 추천 부적(재물운 → 재물·사업번창)
  await expect(page.getByRole('region', { name: '추천 부적' }).getByRole('link', { name: /금전재물부적/ })).toBeVisible();

  // 부적
  await page.goto('/talisman/t_wealth');
  await expect(page.getByText('부적 설명서')).toBeVisible();
  await page.getByRole('button', { name: /나만의 금전재물부적 받기/ }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /결제하고 부적 받기/ }).click();
  await page.getByLabel('나의 소원').fill('올해 안에 내 집 마련하기');
  await page.getByRole('button', { name: '소원 담아 부적 쓰기' }).click();
  // 부적 쓰기: 조용한 진행 화면(약 5초) → 완성
  await expect(page.getByRole('heading', { name: /완성되었습니다/ })).toBeVisible({ timeout: 15_000 });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '이미지로 저장' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);

  // 나의 운세함 보관
  await page.goto('/box');
  await expect(page.getByRole('link', { name: /^재물운/ }).first()).toBeVisible();
  await expect(page.getByText('금전재물부적').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /나의 타로함/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('재미로 보는 운세 7종 + 타로 탭이 열린다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('naman-unse', JSON.stringify({ state: { introSeen: true, profiles: [], plan: 'monthly', purchases: [], talismans: [] }, version: 2 })));
  for (const [path, text] of [['/fun/zodiac-star', '별자리'], ['/fun/blood', '혈액형'], ['/fun/small', '스몰사주'], ['/fun/oneline', '한줄사주'], ['/fun/dream', '꿈 해몽'], ['/fun/factbomb', '팩폭'], ['/fun/mbti', 'MBTI']] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: new RegExp(text) }).first()).toBeVisible();
  }
  await page.goto('/fun/dream');
  await page.getByLabel('꿈 검색').fill('이빨 빠지는 꿈');
  await page.getByRole('button', { name: '풀이' }).click();
  await page.getByRole('button', { name: /상세 꿈 해몽 열기/ }).click(); // 프리미엄 상세 해몽은 하루 1회
  await expect(page.getByText(/상황별 상세 해몽/)).toBeVisible();
  await page.goto('/tarot');
  await page.getByRole('button', { name: /카드 섞고 펼치기/ }).click();
  await page.getByRole('button', { name: '2번째 카드 고르기', exact: true }).dispatchEvent('click');
  await page.getByRole('button', { name: '1번째 카드 뒤집기' }).click();
  await page.getByRole('button', { name: /카드의 이야기 듣기/ }).click();
  await expect(page.getByText('연애', { exact: true })).toBeVisible(); // 프리미엄은 광고 없이 상세 해석
  expect(errors).toEqual([]);
});

// 3차 요청(2026-10-14): 무료 운세 화면 — 띠 그림·해별 2~3줄, MBTI 별명·사주 기질 버튼(보상형 광고 뒤)
test('무료 운세 3차: 띠 그림·해별 풀이, 혈액형 오늘 기질, MBTI 사주 기질', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('naman-unse', JSON.stringify({ state: { introSeen: true, profiles: [{ id: 'p1', name: '테스트', gender: 'M', year: 1975, month: 11, day: 30, calendar: 'solar', leap: false, hour: 14 }], mainId: 'p1', purchases: [], talismans: [] }, version: 2 })));
  const openAd = async (name: RegExp) => {
    await page.getByRole('button', { name }).click();
    const gate = page.getByRole('dialog', { name: '광고 보고 풀이 열기' });
    if (await gate.isVisible()) {
      await page.getByRole('button', { name: '광고 보고 풀이 열기' }).click();
      await page.getByRole('button', { name: '풀이 열기' }).click({ timeout: 12000 });
    }
  };
  await page.goto('/zodiac');
  await expect(page.locator('.zgrid img')).toHaveCount(12);
  await page.getByRole('link', { name: '토끼띠 운세' }).first().click();
  await openAd(/토끼띠 오늘 운세 보기/);
  await expect(page.getByRole('heading', { name: '출생연도별 오늘의 운세' })).toBeVisible();
  await expect(page.locator('.zyears li')).toHaveCount(5);
  await expect(page.locator('.zyears li.me')).toContainText('1975년생');
  await expect(page.locator('.zlucky')).toContainText('행운의 방향');
  await page.goto('/fun/blood');
  await page.getByRole('button', { name: 'A형' }).click();
  await openAd(/A형 오늘 운세 보기/);
  await expect(page.getByRole('heading', { name: /A형의 오늘 기질/ })).toBeVisible();
  await expect(page.locator('.bpoints')).toContainText('오늘의 키워드');
  await page.goto('/fun/mbti');
  await expect(page.getByRole('button', { name: /ISFJ 따뜻한 수호자/ })).toBeVisible();
  await page.getByRole('button', { name: /ISFJ 따뜻한 수호자/ }).click();
  await openAd(/ISFJ 오늘 운세 보기/);
  await expect(page.getByText(/× .* 일간/)).toHaveCount(0);
  await openAd(/ISFJ의 사주 기질은/);
  await expect(page.getByRole('heading', { name: 'ISFJ의 사주 기질' })).toBeVisible();
  expect(errors).toEqual([]);
});

// 3차 남은 작업(2026-10-14): 상세 목차·분량, 풀이 받을 사람 선택·추가, 회원가입·로그인 버튼, 인간관계 타로
test('상세 결과지 목차 · 풀이 받을 사람 선택 · 로그인 버튼 3종 · 인간관계 타로', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('naman-unse', JSON.stringify({ state: { introSeen: true, profiles: [
    { id: 'p1', name: '나본인', gender: 'M', year: 1975, month: 11, day: 30, calendar: 'solar', leap: false, hour: 14, relation: '나' },
    { id: 'p2', name: '어머니', gender: 'F', year: 1950, month: 3, day: 5, calendar: 'lunar', leap: false, hour: null, relation: '부모' },
  ], mainId: 'p1', account: { provider: 'mock', id: 'm1', name: '테스트' }, purchases: [], talismans: [] }, version: 2 })));
  await page.goto('/product/wealth');
  await expect(page.getByRole('heading', { name: '결과지 목차' })).toBeVisible();
  await expect(page.locator('.toc-meta')).toContainText('A4 약 40~50쪽');
  await expect(page.locator('.toc-parts > li')).toHaveCount(6);
  await page.goto('/checkout/wealth');
  await expect(page.getByRole('radio', { name: /어머니/ })).toBeVisible();
  await page.getByRole('radio', { name: /어머니/ }).check();
  await expect(page.getByRole('link', { name: /새로운 사람 추가하기|프리미엄으로/ })).toBeVisible();
  await page.goto('/login');
  for (const t of ['카카오로 시작하기', '네이버로 시작하기', 'Google로 시작하기']) await expect(page.getByRole('button', { name: t })).toBeVisible();
  await page.goto('/product/tarot_people');
  await expect(page.getByRole('heading', { name: /인간관계 타로/ }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

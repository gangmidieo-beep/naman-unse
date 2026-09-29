import { defineConfig } from '@playwright/test';

// E2E_BASE 를 주면 그 주소(예: 정적 빌드 미리보기)로 검사하고, 없으면 dev 서버를 띄운다.
const external = process.env.E2E_BASE;
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: external ?? 'http://localhost:5391', viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' },
  webServer: external ? undefined : { command: 'npm run dev -w web', url: 'http://localhost:5391', reuseExistingServer: true, timeout: 60_000 },
});

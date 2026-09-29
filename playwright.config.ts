import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5391', viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' },
  webServer: { command: 'npm run dev -w web', url: 'http://localhost:5391', reuseExistingServer: true, timeout: 60_000 },
});

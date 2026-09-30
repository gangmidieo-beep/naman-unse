import { defineConfig } from 'vitest/config';
export default defineConfig({
  define: { __PUBLIC_WEB_ORIGIN__: '""', __KAKAO_JS_KEY__: '""', __API_ORIGIN__: '""', __MOCK_MODE__: 'true', __ADSENSE_CLIENT_ID__: '""' },
  test: { include: ['packages/*/test/**/*.test.ts', 'server/test/**/*.test.ts', 'web/src/**/*.test.ts', 'scripts/test/**/*.test.ts'] },
});

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// CSS 의 px 을 rem(16px 기준)으로 바꾼다 → html data-scale(100/115/130%) 한 곳으로 글자·여백이 같이 커진다.
// 1~2px 선 두께는 그대로 둔다.
const pxToRem = () => ({
  postcssPlugin: 'px-to-rem',
  Declaration(decl: { value: string }) {
    if (!decl.value.includes('px')) return;
    decl.value = decl.value.replace(/(-?\d*\.?\d+)px/g, (m, n) => (Math.abs(+n) <= 2 ? m : `${+(+n / 16).toFixed(4)}rem`));
  },
});
pxToRem.postcss = true;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '');
  return {
    plugins: [react()],
    envDir: '..',
    define: {
      __MOCK_MODE__: JSON.stringify(env.MOCK_MODE !== 'false'),
      __API_ORIGIN__: JSON.stringify(env.API_ORIGIN || ''),
      __PUBLIC_WEB_ORIGIN__: JSON.stringify(env.PUBLIC_WEB_ORIGIN || ''),
      __KAKAO_JS_KEY__: JSON.stringify(env.KAKAO_JS_KEY || ''),
      __ADSENSE_CLIENT_ID__: JSON.stringify(env.ADSENSE_CLIENT_ID || ''),
    },
    css: { postcss: { plugins: [pxToRem()] } },
    preview: { port: 5392 },
    server: { port: 5391, strictPort: true, fs: { allow: ['..'] } },
  };
});

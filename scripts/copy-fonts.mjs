// Gowun Batang·Song Myung(OFL) woff2 를 web/public/fonts 로 복사하고 @font-face CSS 를 만든다(CDN 없이 오프라인 동작).
// 원본: npm @fontsource/* (unicode-range 로 나뉜 조각 파일 — 브라우저는 쓰는 글자 조각만 받는다). 라이선스는 LICENSES/fonts/.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const FONTS = [
  { pkg: 'gowun-batang', css: ['400.css', '700.css'] },
  { pkg: 'song-myung', css: ['400.css'] },
];
let out = '/* scripts/copy-fonts.mjs 가 만든 파일 — 직접 고치지 말 것 */\n';
mkdirSync(join(root, 'LICENSES/fonts'), { recursive: true });
for (const f of FONTS) {
  const src = join(root, 'node_modules/@fontsource', f.pkg);
  const dest = join(root, 'web/public/fonts', f.pkg);
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(join(src, 'files'))) if (file.endsWith('.woff2')) copyFileSync(join(src, 'files', file), join(dest, file));
  for (const c of f.css) {
    out += readFileSync(join(src, c), 'utf8')
      .replace(/url\(\.\/files\/([^)]+)\.woff2\) format\('woff2'\), url\([^)]+\) format\('woff'\)/g, `url(/fonts/${f.pkg}/$1.woff2) format('woff2')`);
  }
  copyFileSync(join(src, 'LICENSE'), join(root, 'LICENSES/fonts', `${f.pkg}-OFL.txt`));
}
// pretendard npm 패키지에는 LICENSE 파일이 없어 같은 OFL 1.1 본문에 Pretendard 저작권 줄을 붙여 둔다.
const ofl = readFileSync(join(root, 'node_modules/@fontsource/gowun-batang/LICENSE'), 'utf8').split('\n').slice(1).join('\n');
const pretendardHead = 'Copyright (c) 2021, Kil Hyung-jin (https://github.com/orioncactus/pretendard), with Reserved Font Name Pretendard.\n';
writeFileSync(join(root, 'LICENSES/fonts', 'pretendard-OFL.txt'), pretendardHead + ofl);
writeFileSync(join(root, 'web/src/styles/fonts.css'), out);
console.log('fonts ok');

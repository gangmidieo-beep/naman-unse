// 문구 겹침 검사 — packages/content/data 의 문장이 reference/(이전 서비스 코드) 문장과 8글자 이상 연속으로 겹치면 실패.
// 비교는 공백·문장부호를 뺀 한글·숫자 글자열 기준. reference/ 가 없는 PC(양도 후)에서는 건너뛴다.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const REF = join(root, 'reference');
const N = 8;
// 흔한 표현이라 겹쳐도 되는 구절(공백 제거 형태)
const ALLOW = new Set(['오늘의운세를', '나만의운세']);
if (!existsSync(REF)) { console.log('reference/ 없음 — 문구 겹침 검사 건너뜀'); process.exit(0); }

const norm = (s) => s.replace(/[^가-힣0-9]/g, '');
function* files(dir, exts) {
  for (const n of readdirSync(dir)) {
    if (['node_modules', '.git', '_to_delete', 'verify-shots', 'img', 'images', 'fonts'].includes(n)) continue;
    const f = join(dir, n);
    const st = statSync(f);
    if (st.isDirectory()) yield* files(f, exts);
    else if (exts.includes(extname(n)) && st.size < 3_000_000) yield f;
  }
}
const grams = new Map();
for (const f of files(REF, ['.js', '.mjs', '.ts', '.tsx', '.json', '.html', '.md'])) {
  const txt = norm(readFileSync(f, 'utf8'));
  for (let i = 0; i + N <= txt.length; i++) { const g = txt.slice(i, i + N); if (!grams.has(g)) grams.set(g, relative(root, f)); }
}
const hits = [];
const walk = (v, where) => {
  if (typeof v === 'string') {
    const t = norm(v);
    for (let i = 0; i + N <= t.length; i++) {
      const g = t.slice(i, i + N);
      if (grams.has(g) && ![...ALLOW].some((a) => a.includes(g) || g.includes(a))) { hits.push(`${where}: "${v.slice(0, 40)}" ↔ ${grams.get(g)} [${g}]`); break; }
    }
  } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
};
for (const f of files(join(root, 'packages/content/data'), ['.json'])) {
  if (f.endsWith('rules.json')) continue;
  walk(JSON.parse(readFileSync(f, 'utf8')), relative(root, f));
}
if (hits.length) { console.error(`문구 겹침 ${hits.length}건\n` + hits.join('\n')); process.exit(1); }
console.log(`문구 겹침 검사 통과 ✓ (reference 8글자 조각 ${grams.size}개와 대조)`);

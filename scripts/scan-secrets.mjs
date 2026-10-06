// 비밀 값 간이 검사 — 키·인증서·키스토어가 저장소에 들어가지 않았는지(납품 전 필수). 걸리면 exit 1.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2] ? join(process.cwd(), process.argv[2]) : fileURLToPath(new URL('..', import.meta.url));
// 접두어는 조각으로 이어 붙임(이 파일 자체가 독립성 검사에 걸리지 않게)
const P = (...a) => a.join('');
const PATTERNS = [new RegExp(P('sk', '-an', 't-', '[A-Za-z0-9_-]{10,}')), /AIza[0-9A-Za-z_-]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, new RegExp(P('xkey', 'sib-', '[a-z0-9]{20,}'), 'i'), /"type":\s*"service_account"/];
const BAD_FILES = /\.(jks|keystore|p12|pem)$|^\.env$|^google-services\.json$|^service-account.*\.json$/;
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'reference']);
const hits = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name), rel = relative(ROOT, full);
    const st = statSync(full);
    if (st.isDirectory()) { if (!SKIP.has(name)) walk(full); continue; }
    if (BAD_FILES.test(name)) { hits.push(`${rel}  (비밀 파일)`); continue; }
    if (st.size > 2_000_000 || /\.(png|jpe?g|webp|woff2?|ttf|pdf|ico)$/i.test(name)) continue;
    const text = readFileSync(full, 'utf8');
    for (const re of PATTERNS) if (re.test(text) && !rel.endsWith('scan-secrets.mjs')) hits.push(`${rel}  [${re.source.slice(0, 12)}…]`);
  }
})(ROOT);
if (hits.length) { console.error(`비밀 값 검사 실패 — ${hits.length}곳\n${hits.join('\n')}`); process.exit(1); }
console.log('비밀 값 검사 통과 ✓');

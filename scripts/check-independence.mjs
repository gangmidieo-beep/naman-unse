// 독립성 검사 — 이전 서비스의 이름·도메인·판매자 아이디·서비스 ID·픽셀·키 흔적이 저장소에 남아 있으면 실패(exit 1).
// 금지 문자열 목록은 이 파일 자신이 걸리지 않도록 base64 로 저장한다. 목록 원본: docs/독립양도구조.md
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FORBIDDEN = Buffer.from(
  'amFqZW9uZwrsnpDsoJXsgqzso7wK7J6Q7KCVCmJpbWlsCuu5hOuwgOyLoOuLuQpiaW1pbHNpbmRhbmcKd2hpc3BlcnNhanUK6reT7IaN66eQCm55aDA5MjgKa2FtaTY2MTAKa2FtaTkyOApsc2oyMwp1cC5yYWlsd2F5LmFwcApjMWFiMWYyOQoxZTNhM2I5ZQozYTBhNmU4MgpmYnEoJ2luaXQnCnNrLWFudC0KeGtleXNpYi0=',
  'base64',
).toString('utf8').split('\n');
// 검사 제외: 작업 자료·기록 파일·외부 패키지·빌드 결과. 00_시작가이드.md·*.bat 은 초기 작업 패키지 파일(납품 전 14단계에서 삭제).
const EXCLUDE_DIRS = new Set(['reference', 'docs', '명령어', 'node_modules', '.git', 'dist', 'build', '.claude', 'test-results', 'playwright-report']);
const EXCLUDE_FILES = new Set(['CLAUDE.md', '진행상황.md', '내할일.md', '결정필요.md', '00_시작가이드.md', '1_자정사주_복사.bat', '2_클로드코드_시작.bat', ['scripts', 'check-independence.mjs'].join(sep)]);
const BINARY = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|pdf|zip|jar|keystore|jks|mp4|mp3)$/i;

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name), rel = relative(ROOT, full);
    const st = statSync(full);
    if (st.isDirectory()) { if (!EXCLUDE_DIRS.has(name)) walk(full); continue; }
    if (EXCLUDE_FILES.has(rel) || BINARY.test(name) || st.size > 5_000_000) continue;
    const lines = readFileSync(full, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const low = line.toLowerCase();
      for (const w of FORBIDDEN) if (low.includes(w.toLowerCase())) hits.push(`${rel}:${i + 1}  [${w.slice(0, 3)}…]`);
    });
  }
}
walk(ROOT);
if (hits.length) {
  console.error(`독립성 검사 실패 — ${hits.length}곳\n` + hits.join('\n'));
  process.exit(1);
}
console.log('독립성 검사 통과 ✓');

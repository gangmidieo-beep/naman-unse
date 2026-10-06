// 납품용 깨끗한 사본 만들기 — npm run export:delivery → ../naman-unse-delivery
// 작업 기록·내부 자료·참고 캡처를 빼고, 운영용 CLAUDE.md 로 바꾸고, 새 git 이력(커밋 1개)으로 시작한다.
// 끝나면 사본에서 독립성 검사(전 파일)·비밀 값 검사를 돌려 둘 다 통과해야 성공.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] ?? join(ROOT, '..', 'naman-unse-delivery');

// 빼는 것: 작업 지시·기록, 내부 범위·견적, 계약서·카톡·대표님 원본 자료, 다른 앱 참고 캡처, 시안 작업본, 브리핑 캡처, 개발 도구 설정
const DROP = [
  /^명령어\//, /^진행상황\.md$/, /^내할일\.md$/, /^결정필요\.md$/, /^CLAUDE\.md$/, /^00_시작가이드\.md$/, /\.bat$/, /^\.serena\//,
  /^docs\/(reference분석|독립양도구조|내부_범위비교|프로젝트요약|브리핑_카톡_v2|브리핑_카톡초안|화면설계|디자인가이드|이미지프롬프트)\.md$/,
  /^docs\/(대표님자료|참고화면|참고화면_v2|시안|시안v2|briefing)\//, /^docs\/v3\/대기요청_v3\.md$/,
  /^docs\/.*\.(pdf|txt)$/, /^docs\/요구사항확인서_\d\.png$/,
];

const files = execFileSync('git', ['-c', 'core.quotepath=off', 'ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const keep = files.filter((f) => !DROP.some((re) => re.test(f)));
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
for (const f of keep) {
  mkdirSync(dirname(join(OUT, f)), { recursive: true });
  cpSync(join(ROOT, f), join(OUT, f));
}
writeFileSync(join(OUT, 'CLAUDE.md'), `# 나만의 운세 — 운영·개발 규칙 (AI 코딩 도구용)

- 서비스: 나만의 운세 (Android 앱 + 웹). 설치·배포는 README.md, 계정 이전은 docs/HANDOVER.md.
- 구조: packages/engine(만세력) · packages/content(문구 DB) · server(Fastify+PostgreSQL) · web(React, 앱은 Capacitor 로 감쌈).
- 설정은 .env 와 brand.config.json 으로만. 코드에 주소·가격·키를 직접 쓰지 않는다.
- .env·키 파일·keystore·google-services.json 은 git 에 올리지 않는다.
- 무료 운세는 AI 를 쓰지 않는다(엔진 계산 + 문구 DB). 유료 풀이 AI 는 READING_AI=live 일 때만.
- 글자는 최소 16px, 디자인은 한지 아이보리 + 먹색·금(docs/디자인가이드_v2.md).
- 바꾼 뒤에는 npm test · npm run check:copy · npm run check:secrets 를 통과시킨다.
`);
console.log(`복사 ${keep.length}개 파일 (뺀 것 ${files.length - keep.length}개) → ${OUT}`);

const run = (cmd, args) => execFileSync(cmd, args, { cwd: OUT, stdio: 'inherit' });
run('node', ['scripts/check-independence.mjs', '--all']);
run('node', ['scripts/scan-secrets.mjs']);
run('git', ['init', '-q', '-b', 'main']);
run('git', ['add', '-A']);
run('git', ['-c', 'user.name=H COMPANY', '-c', 'user.email=delivery@localhost', 'commit', '-q', '-m', '나만의 운세 v1.0.0 납품본']);
console.log('납품본 준비 완료 ✓ (새 git 이력 1개 커밋)');

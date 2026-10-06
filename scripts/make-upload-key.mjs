// 스토어 업로드 키 만들기 — node scripts/make-upload-key.mjs "Jang Yongmin" "Company Name" [저장폴더]   (영문으로: 인증서에 한글이 깨져 들어감)
// 결과: <저장폴더>/naman-upload.jks + 업로드키_정보.txt(비밀번호). 둘 다 git 에 넣지 말고 대표님이 따로 보관(USB·비밀번호 관리자).
// Play 앱 서명을 켜면 이 키를 잃어도 Play Console 에서 "업로드 키 재설정" 요청으로 복구할 수 있다.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';

const [name, org, dirArg] = process.argv.slice(2);
if (!name || !org) { console.error('사용법: node scripts/make-upload-key.mjs "대표자 영문 이름" "영문 상호" [저장폴더]'); process.exit(1); }
if (/[^\x20-\x7E]/.test(name + org)) { console.error('이름·상호는 영문으로 넣어 주세요 (예: "Jang Yongmin" "Naman Unse") — 한글은 인증서에 깨져 들어가요'); process.exit(1); }
const dir = resolve(dirArg ?? '../naman-upload-key');
const file = join(dir, 'naman-upload.jks');
if (existsSync(file)) { console.error(`이미 있어요: ${file} — 덮어쓰지 않습니다(키를 바꾸면 기존 앱 업데이트 불가)`); process.exit(1); }
mkdirSync(dir, { recursive: true });
const pw = randomBytes(18).toString('base64url');
const esc = (v) => v.replace(/[,=+<>#;"\\]/g, (c) => `\\${c}`);
execFileSync('keytool', ['-genkeypair', '-v', '-keystore', file, '-storetype', 'PKCS12', '-alias', 'upload', '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
  '-storepass', pw, '-keypass', pw, '-dname', `CN=${esc(name)}, O=${esc(org)}, C=KR`], { stdio: 'inherit' });
writeFileSync(join(dir, '업로드키_정보.txt'), [
  '나만의 운세 — 앱 업로드 키 (절대 분실·공유 금지, git 에 넣지 않음)',
  `파일: naman-upload.jks`, `별칭(alias): upload`, `비밀번호(키·저장소 같음): ${pw}`, `명의: ${name} / ${org}`, `만든 날: ${new Date().toISOString().slice(0, 10)}`, '',
  '빌드할 때 환경변수:', `NAMAN_KEYSTORE=${file}`, `NAMAN_KEYSTORE_PASSWORD=${pw}`, 'NAMAN_KEY_ALIAS=upload', `NAMAN_KEY_PASSWORD=${pw}`, 'NAMAN_VERSION_CODE=1  (올릴 때마다 +1)',
].join('\n'));
console.log(`\n업로드 키 생성 완료 → ${dir}\n(파일 2개를 대표님께 전달하고 다른 사본은 지우세요)`);

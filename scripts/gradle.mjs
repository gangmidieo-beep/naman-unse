// 윈도우(gradlew.bat)·맥/리눅스(./gradlew) 어디서나 app/android 의 Gradle 실행 — node scripts/gradle.mjs assembleDebug
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('../app/android', import.meta.url));
const win = process.platform === 'win32';
const r = spawnSync(win ? 'gradlew.bat' : './gradlew', process.argv.slice(2), { cwd, stdio: 'inherit', shell: win });
process.exit(r.status ?? 1);

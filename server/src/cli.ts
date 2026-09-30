// npm run db:migrate | db:seed [-- --demo] | admin:create -- <이메일> <비밀번호> [super|operator]
import { openDb } from './db/index.ts';
import { createAdmin, seedBase, seedDemo } from './services/seed.ts';

const [cmd, ...args] = process.argv.slice(2);
const { db, close } = await openDb(); // 열 때 마이그레이션까지 적용
if (cmd === 'migrate') console.log('마이그레이션 완료');
if (cmd === 'seed') {
  await seedBase(db);
  if (args.includes('--demo')) await seedDemo(db);
  console.log('초기 데이터 완료');
}
if (cmd === 'admin') {
  const [email, password, role = 'super'] = args;
  if (!email || !password || password.length < 10) {
    console.error('사용법: npm run admin:create -- <이메일> <비밀번호(10자 이상)> [super|operator]');
    process.exit(1);
  }
  await createAdmin(db, email.toLowerCase(), password, role === 'operator' ? 'operator' : 'super');
  console.log(`관리자 ${email} (${role}) 저장 완료`);
}
await close();

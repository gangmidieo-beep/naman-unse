// 빌드 후 정적 HTML 사전 렌더(결정필요 D30) — 애드센스·검색 크롤러가 JS 없이도 읽을 글을 각 주소의 index.html 에 넣는다.
// 브라우저에서는 React 가 #root 를 그대로 덮어써서 화면은 똑같다. 서버 렌더·헤드리스 브라우저 없이 brand.config + 문구 DB 로 만든다.
// 또 ads.txt 를 ADSENSE_CLIENT_ID 로 만든다(없으면 안내 주석만). 사용: npm run build (web postbuild 에서 자동)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'web', 'dist');
const brand = JSON.parse(readFileSync(join(root, 'brand.config.json'), 'utf8'));
const detail = JSON.parse(readFileSync(join(root, 'packages/content/data/product-detail.json'), 'utf8'));
const env = Object.fromEntries((existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8') : '').split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=([^#]*)/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const ADSENSE = process.env.ADSENSE_CLIENT_ID ?? env.ADSENSE_CLIENT_ID ?? '';
const SITE = '나만의 운세';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const shell = readFileSync(join(dist, 'index.html'), 'utf8');
function page(path, title, desc, body) {
  const html = shell
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>\n    <meta name="description" content="${esc(desc)}" />\n    <meta property="og:title" content="${esc(title)}" />\n    <meta property="og:description" content="${esc(desc)}" />`)
    .replace('<div id="root"></div>', `<div id="root"><div class="prerender">${body}</div></div>`);
  const dir = join(dist, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}
const products = [...brand.fate, ...brand.love, ...brand.tarot, ...brand.photo];
const won = (n) => `${n.toLocaleString('ko-KR')}원`;
const li = (p, href) => `<li><a href="${href}">${esc(p.title)}</a> — ${esc(p.cardCopy ?? p.copy)}</li>`;

// 홈
page('', SITE, '천궁도사와 월하선녀가 풀어드리는 사주·궁합·타로·부적. 오늘의 운세는 무료로 매일 새로 봐요.',
  `<h1>${SITE}</h1><p>오늘의 운세는 무료, 깊은 풀이는 천궁도사와 월하선녀가 한 장씩 풀어드려요.</p>` +
  `<h2>재미로 보는 운세</h2><ul>${brand.fun.map((f) => li(f, f.link)).join('')}</ul>` +
  `<h2>인기 풀이</h2><ul>${products.filter((p) => p.badge).map((p) => li(p, `/product/${p.id}`)).join('')}</ul>`);
// 운세 탭 · 타로 탭 · 부적 탭
page('unse', `운세 | ${SITE}`, '천궁도사의 나만의 운명, 월하선녀의 나만의 인연, 재미로 보는 운세와 손금·관상까지.',
  `<h1>운세</h1>${brand.categories.filter((c) => c.groups).map((c) => `<h2>${esc(c.label)} · ${esc(c.sub)}</h2><ul>${(c.id === 'fate' ? brand.fate : brand.love).map((p) => li(p, `/product/${p.id}`)).join('')}</ul>`).join('')}`);
page('tarot', `타로 | ${SITE}`, '오늘의 타로 한 장은 무료. 연애·재물·일·재회 타로와 과거·현재·미래, 켈틱 크로스 스프레드.',
  `<h1>타로</h1><p>별빛 아래, 카드가 전하는 이야기</p><ul>${brand.tarot.map((p) => li(p, `/product/${p.id}`)).join('')}</ul>`);
page('talisman', `부적 | ${SITE}`, '이름과 생년월일, 간절한 소원을 담아 완성하는 나만의 부적.',
  `<h1>나만의 부적</h1><ul>${brand.talisman.map((t) => `<li><a href="/talisman/${t.id}">${esc(t.title)}</a> — ${esc(t.detail)}</li>`).join('')}</ul>`);
// 상품 상세
for (const p of products) {
  const d = detail[p.id];
  page(`product/${p.id}`, `${p.title} | ${SITE}`, p.cardCopy,
    `<h1>${esc(p.title)}</h1><p>${esc(d?.subtitle ?? p.cardCopy)}</p>` +
    (d?.target ? `<h2>이런 분께 필요해요</h2><ul>${d.target.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '') +
    (d?.why ? `<h2>지금 봐야 하는 이유</h2><p>${esc(d.why)}</p>` : '') +
    (d ? `<h2>담기는 내용</h2><ul>${d.contents.map((c) => `<li>${esc(c.title)} — ${esc(c.desc)}</li>`).join('')}</ul>` : '') +
    `<p>가격 ${won(p.price)}</p>`);
}
for (const t of brand.talisman) page(`talisman/${t.id}`, `${t.title} | ${SITE}`, t.cardCopy, `<h1>${esc(t.title)}</h1><p>${esc(t.detail)}</p><p>가격 ${won(t.price)}</p>`);
// 약관류 — 본문은 앱에서 렌더되므로 제목·요약만
page('privacy', `개인정보처리방침 | ${SITE}`, `${SITE} 개인정보처리방침`, `<h1>개인정보처리방침</h1><p>사주 정보·로그인·결제 기록의 수집 목적과 보관 기간, 광고 쿠키, 이용자 권리를 안내합니다. 손금·관상 사진은 풀이 직후 삭제합니다.</p>`);
page('terms', `이용약관 | ${SITE}`, `${SITE} 이용약관`, `<h1>이용약관</h1><p>서비스 내용, 결제와 환불, 이용자의 의무를 안내합니다.</p>`);
page('contact', `문의하기 | ${SITE}`, `${SITE} 문의`, `<h1>문의하기</h1><p>이용 중 불편한 점이나 결제·환불 문의를 받습니다.</p>`);

// ads.txt — 게시자 ID(ca-pub-XXXX → pub-XXXX)
const pub = ADSENSE.replace(/^ca-/, '');
writeFileSync(join(dist, 'ads.txt'), pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : '# 대표님 애드센스 게시자 ID(ADSENSE_CLIENT_ID)를 .env 에 넣고 다시 빌드하면 채워집니다\n');
console.log(`사전 렌더 ${4 + products.length + brand.talisman.length + 3}쪽 · ads.txt ${pub ? '작성' : '자리만'}`);

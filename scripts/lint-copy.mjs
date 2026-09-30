// 문장 검수 — 길이·금지어·말투 어미(선녀=요, 도사=오/소/구려/시게…)를 자동 검사.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const FORBIDDEN = ['사망', '죽', '이혼', '파산', '큰 병', '불치', '수술', '사고', '주식', '코인', '투자', '대출', '병원', '반드시', '무조건', '100%', '대박', '암 ', '암이', '암에'];
const SUNNYEO = /요[.!?…~]*["”’)]*$/;
const DOSA = /(오|소|구려|시게|지요|리다|겠소|라오|이오|구먼|하게|네)[.!?…~]*["”’)]*$/;
const HAMNIDA = /다[.!?…]*["”’)]*$/;
const errs = [];
const sentences = (t) => t.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
function check(text, where, { voice, maxSentence = 60, maxLen, sentence = true }) {
  if (typeof text !== 'string') return errs.push(`${where}: 문자열 아님`);
  for (const w of FORBIDDEN) if (text.includes(w)) errs.push(`${where}: 금지어 "${w}" — ${text.slice(0, 30)}`);
  if (maxLen && text.length > maxLen) errs.push(`${where}: ${text.length}자 > ${maxLen}`);
  if (!sentence) return;
  for (const s of sentences(text)) {
    if (s.length > maxSentence) errs.push(`${where}: 문장 ${s.length}자 > ${maxSentence} — ${s.slice(0, 30)}`);
    if (voice === 'wolha' && !SUNNYEO.test(s)) errs.push(`${where}: 선녀 어미 아님 — ${s.slice(-15)}`);
    if (voice === 'cheongung' && !DOSA.test(s)) errs.push(`${where}: 도사 어미 아님 — ${s.slice(-15)}`);
    if (voice === 'hamnida' && !HAMNIDA.test(s)) errs.push(`${where}: 합니다체 아님 — ${s.slice(-15)}`);
  }
}
const each = (obj, fn, path) => {
  if (typeof obj === 'string') return fn(obj, path);
  if (Array.isArray(obj)) return obj.forEach((x, i) => each(x, fn, `${path}[${i}]`));
  for (const [k, v] of Object.entries(obj)) each(v, fn, `${path}.${k}`);
};

const T = 'packages/content/data/today/';
each(load(T + 'oneline.json'), (t, p) => check(t, p, { voice: 'wolha', maxSentence: 45 }), 'oneline');
each(load(T + 'week.json'), (t, p) => check(t, p, { voice: 'wolha', maxSentence: 45 }), 'week');
each(load(T + 'month.json'), (t, p) => check(t, p, { voice: 'wolha', maxSentence: 45 }), 'month');
each(load(T + 'advice.json'), (t, p) => check(t, p, { voice: 'wolha', maxSentence: 45 }), 'advice');
const f = load(T + 'fields.json');
each(f.summary, (t, p) => check(t, p, { sentence: false, maxLen: 22 }), 'summary');
each(f.detail, (t, p) => check(t, p, { voice: 'wolha', maxSentence: 45, maxLen: 140 }), 'detail');
each(f.detailCheongung, (t, p) => check(t, p, { voice: 'cheongung', maxSentence: 45, maxLen: 140 }), 'detailCheongung');
const z = load('packages/content/data/zodiac.json');
each(z, (t, p) => check(t, p, { voice: 'wolha' }), 'zodiac');
const c = load('packages/content/data/consult.json');
for (const w of ['cheongung', 'wolha']) each(c.greet[w], (t, p) => check(t, p, { voice: w }), `consult.greet.${w}`);
for (const w of c.worries) each(w.reply, (t, p) => check(t, p, { voice: w.who }), `consult.${w.id}`);
for (const [w, t] of Object.entries(c.switchLine)) check(t, `consult.switch.${w}`, { voice: w });
for (const id of ['saju', 'gunghap', 'newyear']) {
  const r = load(`packages/content/data/sample-readings/${id}.json`);
  const v = r.character;
  check(r.intro, `${id}.intro`, { voice: v });
  r.chapters.forEach((ch, i) => {
    check(ch.say, `${id}.ch${i}.say`, { voice: v });
    check(ch.body, `${id}.ch${i}.body`, { voice: v, maxLen: 800 });
    if (!ch.body.includes(ch.highlight)) errs.push(`${id}.ch${i}: highlight 가 본문에 없음`);
  });
  check(r.closing.body, `${id}.closing`, { voice: v });
}
// v2 추가 콘텐츠
const D = 'packages/content/data/';
const ex = load(T + 'extra.json');
each(ex.summary, (t, p) => check(t, p, { sentence: false, maxLen: 22 }), 'extra.summary');
each(ex.detail, (t, p) => check(t, p, { voice: 'wolha', maxSentence: 45, maxLen: 140 }), 'extra.detail');
each(ex.brief, (t, p) => check(t, p, { voice: 'hamnida', maxLen: 100 }), 'extra.brief');
each(ex.headline, (t, p) => check(t, p, { sentence: false, maxLen: 20 }), 'extra.headline');
each(ex.word, (t, p) => check(t, p, { voice: 'cheongung', maxLen: 34 }), 'extra.word');
const cat = load('docs/상품카탈로그_v2.json');
const pd = load(D + 'product-detail.json');
for (const it of [...cat.fate, ...cat.love]) {
  const d = pd[it.id];
  if (!d) { errs.push(`product-detail: ${it.id} 없음`); continue; }
  check(d.say, `product-detail.${it.id}.say`, { voice: it.character });
  each(d.contents, (t, p) => check(t, p, { sentence: false, maxLen: 34 }), `product-detail.${it.id}.contents`);
}
const te = load(D + 'talisman-effects.json');
for (const it of cat.talisman) {
  if (!te[it.id]) { errs.push(`talisman-effects: ${it.id} 없음`); continue; }
  te[it.id].effects.forEach((e, i) => check(e.desc, `talisman.${it.id}.${i}`, { voice: 'hamnida' }));
}
each(load(D + 'mbti.json'), (t, p) => (/\.(nick)$/.test(p) ? check(t, p, { sentence: false, maxLen: 14 }) : check(t, p, { voice: 'wolha' })), 'mbti');
const star = load(D + 'star/lines.json');
each({ intro: star.intro, oneLine: star.oneLine, field: star.field }, (t, p) => check(t, p, { voice: 'wolha' }), 'star');
each(star.items, (t, p) => check(t, p, { sentence: false, maxLen: 14 }), 'star.items');
const blood = load(D + 'blood/lines.json');
each({ trait: blood.trait, oneLine: blood.oneLine, tip: blood.relationTip, caution: blood.caution }, (t, p) => check(t, p, { voice: 'wolha' }), 'blood');
blood.match.forEach((m, i) => check(m.line, `blood.match.${i}`, { voice: 'wolha' }));
const fb = load(D + 'factbomb/lines.json');
each(fb.title, (t, p) => check(t, p, { sentence: false, maxLen: 24 }), 'factbomb.title');
each({ bomb: fb.bomb, merit: fb.merit }, (t, p) => check(t, p, { voice: 'wolha' }), 'factbomb');
for (const c of load(D + 'tarot/deck.json'))
  for (const side of ['upright', 'reversed']) {
    const x = c[side];
    for (const t of [...x.message, x.love, x.money, x.work]) check(t, `tarot.${c.id}.${side}`, { voice: 'wolha' });
    check(x.title, `tarot.${c.id}.${side}.title`, { sentence: false, maxLen: 24 });
  }
for (const d of [...load(D + 'dream/part1.json'), ...load(D + 'dream/part2.json')]) {
  for (const t of [...d.basic, d.advice, ...d.details.map((x) => x.meaning)]) check(t, `dream.${d.id}`, { voice: 'wolha' });
  check(d.title, `dream.${d.id}.title`, { sentence: false, maxLen: 22 });
}

// v3: 상세 문구(대상·이유) · 타로/사진 상품 · 스몰사주 · 한줄사주 · 손금/관상 예시
const brandCfg = load('brand.config.json');
for (const it of [...cat.fate, ...cat.love, ...brandCfg.tarot, ...brandCfg.photo]) {
  const d = pd[it.id];
  if (!d) { errs.push(`product-detail: ${it.id} 없음`); continue; }
  if (!Array.isArray(d.target) || d.target.length !== 3) errs.push(`product-detail.${it.id}.target 3줄 아님`);
  each(d.target ?? [], (t, p) => check(t, p, { sentence: false, maxLen: 22 }), `product-detail.${it.id}.target`);
  check(d.why ?? '', `product-detail.${it.id}.why`, { voice: 'wolha', maxSentence: 45 });
  if (!it.id.startsWith('tarot') && it.kind === 'photo') check(d.say, `product-detail.${it.id}.say`, { voice: 'cheongung' });
  if (it.id.startsWith('tarot')) check(d.say, `product-detail.${it.id}.say`, { voice: 'wolha' });
}
const small = load(D + 'smallsaju.json');
each({ lines: Object.values(small.dayMaster).map((x) => x.lines), strong: small.strong, weak: small.weak, tip: small.luckyTip }, (t, p) => check(t, p, { voice: 'wolha' }), 'smallsaju');
each(load(D + 'onelinesaju.json'), (t, p) => check(t, p, { voice: 'wolha', maxLen: 32 }), 'onelinesaju');
const ph = load(D + 'photo-sample.json');
for (const k of ['palm', 'face']) each({ intro: ph[k].intro, body: ph[k].sections.map((x) => x.body), closing: ph[k].closing }, (t, p) => check(t, p, { voice: 'cheongung' }), `photo.${k}`);
each(ph.guide, (t, p) => check(t, p, { voice: 'wolha' }), 'photo.guide');
each(ph.consent, (t, p) => check(t, p, { voice: 'hamnida' }), 'photo.consent');

// 중복 문장
const seen = new Map();
each({ a: load(T + 'oneline.json'), b: f.summary, c: f.detail, d: load(T + 'advice.json') }, (t, p) => { if (seen.has(t)) errs.push(`중복: ${p} = ${seen.get(t)}`); seen.set(t, p); }, '');
if (errs.length) { console.error(`문장 검수 실패 ${errs.length}건\n` + errs.slice(0, 80).join('\n')); process.exit(1); }
console.log('문장 검수 통과 ✓');

// 문장 검수 — 길이·금지어·말투 어미(선녀=요, 도령=오/소/구려/시게…)를 자동 검사.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (p) => JSON.parse(readFileSync(root + p, 'utf8'));
const FORBIDDEN = ['사망', '죽', '이혼', '파산', '큰 병', '불치', '수술', '사고', '주식', '코인', '투자', '대출', '병원', '반드시', '무조건', '100%', '대박', '암 ', '암이', '암에'];
const SUNNYEO = /요[.!?…~]*["”’)]*$/;
const DOSA = /(오|소|구려|시게|지요|리다|겠소|라오|이오|구먼|하게|네)[.!?…~]*["”’)]*$/;
const errs = [];
const sentences = (t) => t.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
function check(text, where, { voice, maxSentence = 60, maxLen, sentence = true }) {
  if (typeof text !== 'string') return errs.push(`${where}: 문자열 아님`);
  for (const w of FORBIDDEN) if (text.includes(w)) errs.push(`${where}: 금지어 "${w}" — ${text.slice(0, 30)}`);
  if (maxLen && text.length > maxLen) errs.push(`${where}: ${text.length}자 > ${maxLen}`);
  if (!sentence) return;
  for (const s of sentences(text)) {
    if (s.length > maxSentence) errs.push(`${where}: 문장 ${s.length}자 > ${maxSentence} — ${s.slice(0, 30)}`);
    if (voice === 'sunnyeo' && !SUNNYEO.test(s)) errs.push(`${where}: 선녀 어미 아님 — ${s.slice(-15)}`);
    if (voice === 'dosa' && !DOSA.test(s)) errs.push(`${where}: 도령 어미 아님 — ${s.slice(-15)}`);
  }
}
const each = (obj, fn, path) => {
  if (typeof obj === 'string') return fn(obj, path);
  if (Array.isArray(obj)) return obj.forEach((x, i) => each(x, fn, `${path}[${i}]`));
  for (const [k, v] of Object.entries(obj)) each(v, fn, `${path}.${k}`);
};

const T = 'packages/content/data/today/';
each(load(T + 'oneline.json'), (t, p) => check(t, p, { voice: 'sunnyeo', maxSentence: 45 }), 'oneline');
each(load(T + 'week.json'), (t, p) => check(t, p, { voice: 'sunnyeo', maxSentence: 45 }), 'week');
each(load(T + 'month.json'), (t, p) => check(t, p, { voice: 'sunnyeo', maxSentence: 45 }), 'month');
each(load(T + 'advice.json'), (t, p) => check(t, p, { voice: 'sunnyeo', maxSentence: 45 }), 'advice');
const f = load(T + 'fields.json');
each(f.summary, (t, p) => check(t, p, { sentence: false, maxLen: 22 }), 'summary');
each(f.detail, (t, p) => check(t, p, { voice: 'sunnyeo', maxSentence: 45, maxLen: 140 }), 'detail');
each(f.detailDosa, (t, p) => check(t, p, { voice: 'dosa', maxSentence: 45, maxLen: 140 }), 'detailDosa');
const z = load('packages/content/data/zodiac.json');
each(z, (t, p) => check(t, p, { voice: 'sunnyeo' }), 'zodiac');
const c = load('packages/content/data/consult.json');
for (const w of ['dosa', 'sunnyeo']) each(c.greet[w], (t, p) => check(t, p, { voice: w }), `consult.greet.${w}`);
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
// 중복 문장
const seen = new Map();
each({ a: load(T + 'oneline.json'), b: f.summary, c: f.detail, d: load(T + 'advice.json') }, (t, p) => { if (seen.has(t)) errs.push(`중복: ${p} = ${seen.get(t)}`); seen.set(t, p); }, '');
if (errs.length) { console.error(`문장 검수 실패 ${errs.length}건\n` + errs.slice(0, 80).join('\n')); process.exit(1); }
console.log('문장 검수 통과 ✓');

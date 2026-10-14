// 정통 감정서 A4 PDF — 서버에서 HTML 을 만들고 Chromium 으로 인쇄(한글 글꼴은 이미지에 설치된 Noto Serif/Sans CJK KR).
// 표지 → 사주 정보 → 정통 분석표(원국 상세·오행·십성·신강약·용신·합충·신살·대운·세운·월운) → 목차 → 부·장 본문 → 마무리.
import type { LongContent } from './long.ts';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const EL: Record<string, string> = { 목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water' };
const CHAR = { cheongung: { name: '천궁도사', hanja: '天宮道士', doc: '운명서' }, wolha: { name: '월하선녀', hanja: '月下仙女', doc: '인연서' } };
// 표지 제목을 의미 단위 두 줄로: "천궁도사가 풀어드린 / 나의 운명서"
export const titleLines = (t: string) => {
  const w = String(t ?? '').trim().split(/\s+/);
  if (w.length < 3) return esc(t);
  let best = 1, diff = Infinity;
  for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } }
  return `<span>${esc(w.slice(0, best).join(' '))}</span> <span>${esc(w.slice(best).join(' '))}</span>`;
};
const paras = (t: string) => String(t ?? '').split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join('');

function reportHtml(c: LongContent, k: number) {
  const r: any = c.reports[k];
  const who = c.people[k];
  const cols = r.rows as any[];
  const cell = (x: any, part: 'stem' | 'branch') => x.empty ? '<td class="hz none">?</td>' : `<td class="hz el-${EL[x[part].element]}">${esc(x[part].hanja)}<small>${esc(x[part].char)}·${esc(x[part].element)}</small></td>`;
  const counts = Object.entries(r.elements.counts as Record<string, number>).sort((a, b) => '목화토금수'.indexOf(a[0]) - '목화토금수'.indexOf(b[0]));
  const max = Math.max(1, ...counts.map(([, n]) => n));
  const tg = Object.entries(r.tenGodCounts as Record<string, number>);
  return `
  <section class="rep">
    <h2 class="sec">${esc(who.name)} 님의 사주 원국 <small>${esc(who.birth)}</small></h2>
    <table class="won">
      <thead><tr><th></th>${cols.map((x) => `<th${x.key === 'day' ? ' class="me"' : ''}>${esc(x.label)}${x.key === 'day' ? ' (나)' : ''}</th>`).join('')}</tr></thead>
      <tbody>
        <tr><th>십성</th>${cols.map((x) => `<td class="ss">${x.empty ? '-' : esc(x.stem.sipsin)}</td>`).join('')}</tr>
        <tr><th>천간</th>${cols.map((x) => cell(x, 'stem')).join('')}</tr>
        <tr><th>지지</th>${cols.map((x) => cell(x, 'branch')).join('')}</tr>
        <tr><th>십성</th>${cols.map((x) => `<td class="ss">${x.empty ? '-' : esc(x.branch.sipsin)}</td>`).join('')}</tr>
        <tr><th>지장간</th>${cols.map((x) => `<td class="sm">${x.empty ? '-' : x.hidden.map((h: string) => `<span class="nb">${esc(h)}</span>`).join(' ')}</td>`).join('')}</tr>
        <tr><th>12운성</th>${cols.map((x) => `<td>${x.empty ? '-' : esc(x.stage)}</td>`).join('')}</tr>
        <tr><th>신살</th>${cols.map((x) => `<td class="sm">${x.empty ? '-' : x.shinsal.map((h: string) => `<span class="nb">${esc(h)}</span>`).join(' ') || '-'}</td>`).join('')}</tr>
      </tbody>
    </table>
    <div class="grid2">
      <div class="box"><h3>오행 분포</h3>${counts.map(([e, n]) => `<div class="bar"><span class="lb"><i class="el-${EL[e]}"></i>${esc(e)}</span><span class="tr"><b class="el-${EL[e]}" style="width:${Math.round((n / max) * 100)}%"></b></span><span class="n">${n}</span></div>`).join('')}
        <p class="sm">가장 강한 기운 <b>${esc(r.elements.strongest)}</b> · 가장 약한 기운 <b>${esc(r.elements.weakest)}</b>${r.elements.missing.length ? ` · 없는 기운 <b>${esc(r.elements.missing.join('·'))}</b>` : ''}</p></div>
      <div class="box"><h3>십성 분포</h3><div class="tg">${tg.map(([n, v]) => `<span class="${v ? '' : 'z'}">${esc(n)} <b>${v}</b></span>`).join('')}</div><p class="sm">월지(사회 무대)의 십성 <b>${esc(r.monthSipsin)}</b></p></div>
    </div>
    <div class="grid2">
      <div class="box"><h3>신강·신약</h3><p class="big">${esc(r.strength.label)}</p><div class="tr wide"><b style="width:${r.strength.score}%"></b></div><p class="sm">일간을 돕는 힘 ${r.strength.score}% (월지 가중, 억부 기준)</p></div>
      <div class="box"><h3>용신 (억부 참고)</h3><p class="chips"><span class="el-${EL[r.yongsin.yong]}">용신 ${esc(r.yongsin.yong)}</span><span class="el-${EL[r.yongsin.hee]}">희신 ${esc(r.yongsin.hee)}</span><span class="gi">기신 ${esc(r.yongsin.gi)}</span></p>
        <p class="sm">행운의 색 ${esc(r.yongsin.luck.color)} · 방향 ${esc(r.yongsin.luck.dir)} · 숫자 ${esc(r.yongsin.luck.num)} · 계절 ${esc(r.yongsin.luck.season)}</p></div>
    </div>
    <div class="box"><h3>원국의 합·충·형·파·해</h3><p class="sm">${r.relations.length ? r.relations.map((h: string) => `<span class="nb">${esc(h)}</span>`).join(' · ') : '두드러진 합·충이 없는 안정된 원국'}${r.special.length ? ` · ${r.special.map((h: string) => `<span class="nb">${esc(h)}</span>`).join(' · ')}` : ''}</p></div>
  </section>
  <section class="rep">
    <h2 class="sec">대운표 <small>${r.daewoonStart ?? ''}세부터 10년마다 · ${r.daewoonDirection === 'forward' ? '순행' : '역행'}</small></h2>
    <table class="dw"><tr>${r.daewoon.map((d: any) => `<td class="${d.current ? 'cur' : ''}"><small>${d.fromAge}~${d.toAge}세</small><b>${esc(d.hanja[0])}<br>${esc(d.hanja[1])}</b><small>${esc(d.stemSipsin)}<br>${esc(d.branchSipsin)}</small><small>${esc(d.stage)}</small>${d.current ? '<em>지금</em>' : ''}</td>`).join('')}</tr></table>
    <h2 class="sec">세운표 <small>앞으로 10년</small></h2>
    <table class="list"><thead><tr><th>해</th><th>나이</th><th>간지</th><th>천간 십성</th><th>지지 십성</th><th>12운성</th><th>일지와</th><th>대운</th></tr></thead>
      <tbody>${r.seun.map((y: any) => `<tr><td>${y.year}</td><td>${y.age}</td><td><b>${esc(y.text)}</b> ${esc(y.hanja)}</td><td>${esc(y.stemSipsin)}</td><td>${esc(y.branchSipsin)}</td><td>${esc(y.stage)}</td><td>${esc(y.withDay.join('·') || '-')}</td><td>${esc(y.daewoon ?? '-')}</td></tr>`).join('')}</tbody></table>
    <h2 class="sec">${r.targetYear}년 월운표</h2>
    <table class="list"><thead><tr><th>달</th><th>간지</th><th>천간 십성</th><th>지지 십성</th><th>12운성</th><th>일지와</th></tr></thead>
      <tbody>${r.months.map((m: any) => `<tr><td>${esc(m.label)}</td><td><b>${esc(m.text)}</b> ${esc(m.hanja)}</td><td>${esc(m.stemSipsin)}</td><td>${esc(m.branchSipsin)}</td><td>${esc(m.stage)}</td><td>${esc(m.withDay.join('·') || '-')}</td></tr>`).join('')}</tbody></table>
  </section>`;
}

export function readingHtml(c: LongContent, opts: { productTitle: string; resultTitle: string }) {
  const ch = CHAR[c.character] ?? CHAR.cheongung;
  let n = 0;
  const byPart = c.parts.map((p, i) => ({ ...p, chapters: c.chapters.filter((x) => x.part === i) })).filter((p) => p.chapters.length);
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replaceAll('-', '. ');
  let tn = 0;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(opts.resultTitle)}</title><style>
  @page { size: A4; margin: 20mm 0 18mm; } /* 좌우 여백은 body 안쪽 여백으로 — 한지 바탕이 종이 끝까지 */
  /* 아이보리 한지 바탕: 연한 아이보리 + 한지 결(가로로 긴 섬유) + 고운 잡티 */
  html { background-color: #f8f0de; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='360'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.006 .09' numOctaves='3' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .55 0 0 0 0 .45 0 0 0 0 .28 0 0 0 -.55 .3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f)'/%3E%3C/svg%3E"), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .45 0 0 0 0 .38 0 0 0 0 .25 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 17mm; font-family: 'Noto Serif CJK KR', 'Noto Serif KR', serif; font-size: 11pt; line-height: 1.8; color: #241d14;
    word-break: keep-all; overflow-wrap: break-word; line-break: strict; }
  /* 줄바꿈: 한글은 낱말(어절) 단위로만 끊고, 제목은 줄 길이를 고르게, 본문은 마지막 줄에 한두 글자만 남지 않게 */
  h1, h2, h3, .pt, .say, .hl, .who, .part h2 { text-wrap: balance; }
  p, li { text-wrap: pretty; }
  .nb { white-space: nowrap; }
  .sans, table, .box, .sm, small { font-family: 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; }
  .cover { height: 257mm; border: 2.5px solid #a8823e; outline: 1px solid #a8823e; outline-offset: -8px; background: transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; padding: 20mm; }
  .cover .hj { letter-spacing: .5em; color: #a8823e; font-size: 13pt; }
  .cover h1 { font-size: 30pt; line-height: 1.38; margin: 14mm 0 6mm; font-weight: 900; max-width: 150mm; }
  .cover h1 span { display: inline-block; }
  .cover .pt { font-size: 15pt; color: #8a6a2c; font-weight: 700; }
  .cover .who { margin-top: 18mm; font-size: 12pt; line-height: 1.9; }
  .cover .seal { margin-top: 16mm; width: 18mm; height: 18mm; border: 2px solid #c8312a; color: #c8312a; font-size: 18pt; font-weight: 900; display: flex; align-items: center; justify-content: center; border-radius: 3px; }
  .cover .dt { margin-top: 10mm; font-size: 10pt; color: #8a7a60; }
  h2.sec { font-size: 14pt; margin: 0 0 3mm; padding-bottom: 1.5mm; border-bottom: 1.5px solid #a8823e; }
  h2.sec small { font-size: 9pt; color: #8a7a60; font-weight: 400; margin-left: 2mm; }
  .rep { page-break-after: always; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 5mm; }
  th, td { border: 1px solid #dccfb4; padding: 1.4mm 1mm; text-align: center; vertical-align: middle; }
  thead th { background: #f3ead6; }
  .won th { background: #f3ead6; width: 16mm; }
  .won th.me { color: #c8312a; }
  .won td.hz { font-family: 'Noto Serif CJK KR', serif; font-size: 22pt; line-height: 1.15; font-weight: 700; padding: 1.5mm 0 .5mm; }
  .won td.hz small { display: block; font-size: 7.5pt; font-weight: 400; }
  .won td.ss { font-weight: 700; color: #6b4f1a; }
  td.sm, .sm { font-size: 8.5pt; }
  .el-wood { background: #3e8e57; color: #fff; } .el-fire { background: #d9372b; color: #fff; } .el-earth { background: #f2c230; color: #2a1e08; }
  .el-metal { background: #fff; color: #222; } .el-water { background: #161616; color: #fff; } td.none { color: #aaa; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 4mm; }
  .box { border: 1px solid #dccfb4; border-radius: 2mm; padding: 3mm 4mm; background: #fffdf7; margin-bottom: 4mm; }
  .box h3 { font-size: 10pt; margin: 0 0 2mm; color: #6b4f1a; }
  .bar { display: flex; align-items: center; gap: 2mm; font-size: 9pt; margin: 1mm 0; }
  .bar .lb { width: 10mm; display: flex; align-items: center; gap: 1mm; } .bar .lb i { width: 3mm; height: 3mm; display: inline-block; border: 1px solid #ccc; }
  .tr { flex: 1; height: 3mm; background: #efe7d4; border-radius: 2mm; overflow: hidden; display: block; } .tr b { display: block; height: 100%; background: #a8823e; } .tr b.el-wood { background: #3e8e57; } .tr b.el-fire { background: #d9372b; } .tr b.el-earth { background: #f2c230; } .tr b.el-metal { background: #d8d2c4; } .tr b.el-water { background: #161616; }
  .tr.wide { margin: 2mm 0; }
  .bar .n { width: 5mm; text-align: right; }
  .tg { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5mm; font-size: 8.5pt; } .tg span { border: 1px solid #e6dcc6; border-radius: 1.5mm; text-align: center; padding: 1mm 0; } .tg span.z { color: #aaa; }
  .big { font-size: 16pt; font-weight: 900; margin: 0; }
  .chips span { display: inline-block; padding: .6mm 2.5mm; border-radius: 3mm; margin-right: 1.5mm; font-size: 9pt; border: 1px solid #ccc; } .chips .gi { background: #eee; }
  .dw td { width: 12.5%; font-size: 8pt; padding: 1.5mm .5mm; } .dw b { display: block; font-family: 'Noto Serif CJK KR', serif; font-size: 13pt; line-height: 1.2; margin: .6mm 0; } .dw { margin-bottom: 4mm; }
  .dw small { display: block; } .dw td.cur { background: #fbf0d4; outline: 2px solid #c8312a; } .dw em { display: block; font-style: normal; color: #c8312a; font-weight: 700; }
  .list td, .list th { font-size: 8pt; padding: .7mm .8mm; line-height: 1.45; }
  .toc h2 { font-size: 16pt; margin: 0 0 2mm; } .toc .cols { columns: 2; column-gap: 8mm; } .toc .pt { break-after: avoid; }
  .toc .pt { font-weight: 900; margin: 3mm 0 1mm; font-size: 10.5pt; color: #6b4f1a; }
  .toc ol { margin: 0; padding-left: 0; list-style: none; columns: 1; font-size: 9.5pt; line-height: 1.6; } .toc li { padding-left: 9mm; text-indent: -9mm; break-inside: avoid; } .toc li span { color: #a8823e; display: inline-block; width: 9mm; text-indent: 0; }
  .intro { margin-top: 6mm; font-size: 11pt; background: #faf5ea; border-left: 3px solid #a8823e; padding: 4mm 5mm; margin-bottom: 6mm; }
  .part { page-break-before: always; text-align: center; padding: 18mm 0 10mm; margin-bottom: 8mm; border-bottom: 1px solid #dccfb4; }
  .part small { letter-spacing: .4em; color: #a8823e; } .part h2 { font-size: 22pt; margin: 4mm 0; }
  .chap { margin-bottom: 7mm; }
  .chap .no { font-size: 9pt; color: #a8823e; letter-spacing: .2em; font-family: 'Noto Sans CJK KR', sans-serif; }
  .chap h3 { font-size: 14pt; margin: .5mm 0 2mm; break-after: avoid; }
  .chap .say { font-size: 10.6pt; font-weight: 700; color: #241d14; background: #f7eed8; border: 1px solid #e3d2a8; padding: 2.4mm 3.5mm; border-radius: 1.8mm; margin: 0 0 3.5mm; break-inside: avoid; }
  .chap .say b, .chap .pts b, .chap .ca b { display: block; font-family: 'Noto Sans CJK KR', sans-serif; font-size: 8pt; font-weight: 800; color: #8a6526; letter-spacing: .05em; margin-bottom: .8mm; }
  .chap .pts { margin: 1mm 0 3mm; break-inside: avoid; } .chap .pts ul { margin: 0; padding-left: 5mm; } .chap .pts li { margin: .6mm 0; }
  .chap .ca { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin: 0 0 3mm; break-inside: avoid; }
  .chap .ca > div { border-radius: 1.8mm; padding: 2.4mm 3mm; font-size: 10pt; line-height: 1.7; }
  .chap .ca .c { background: #fbeeea; border: 1px solid #efcfc6; } .chap .ca .c b { color: #a23a2a; }
  .chap .ca .a { background: #eef4ec; border: 1px solid #cfe0c9; } .chap .ca .a b { color: #3e7a4e; }
  .hl span { display: inline-block; margin-right: 2mm; font-family: 'Noto Sans CJK KR', sans-serif; font-size: 7.5pt; font-weight: 800; color: #fff; background: #b8913f; border-radius: 3mm; padding: .2mm 2mm; }
  .chap p, .intro p, .closing p { margin: 0 0 2.6mm; text-align: left; orphans: 2; widows: 2; }
  .hl { border-top: 1px dashed #d8c49a; padding-top: 2mm; font-weight: 700; color: #6b4f1a; font-size: 10pt; }
  .closing { page-break-before: always; border: 1.5px solid #a8823e; padding: 6mm 7mm; background: #fffdf7; }
  .closing ul { padding-left: 5mm; } .closing li { margin: 1.5mm 0; font-weight: 700; }
  .end { text-align: right; margin-top: 8mm; font-weight: 900; } .end span { display: inline-block; border: 2px solid #c8312a; color: #c8312a; padding: 0 1.5mm; margin-left: 2mm; }
  .note { font-size: 8pt; color: #8a7a60; margin-top: 6mm; }
  </style></head><body>
  <section class="cover">
    <div class="hj">${esc(ch.hanja)}</div>
    <h1>${titleLines(opts.resultTitle)}</h1>
    <div class="pt">${esc(opts.productTitle)}</div>
    <div class="who">${c.people.map((p) => `<span class="nb">${esc(p.name)} 님</span> · <span class="nb">${esc(p.birth)}</span>`).join('<br>')}</div>
    <div class="seal">運</div>
    <div class="dt">${today} · 나만의 운세</div>
  </section>
  ${c.reports.map((_, k) => reportHtml(c, k)).join('')}
  ${c.tojeong ? `<section class="box"><h3>${c.tojeong.year}년 토정비결 괘</h3><p>괘 번호 <b>${c.tojeong.number}</b> · 상괘 ${c.tojeong.upper} · 중괘 ${c.tojeong.middle} · 하괘 ${c.tojeong.lower}</p></section>` : ''}
  <section class="toc"><h2 class="sec">목차</h2><div class="cols">${byPart.map((p) => `<div class="pt">${esc(p.title)}</div><ol>${p.chapters.map((x) => `<li><span>${++tn}</span>${esc(x.title)}</li>`).join('')}</ol>`).join('')}<div class="pt">${esc(c.closing.title)}</div></div></section>
  ${c.intro ? `<div class="intro">${paras(c.intro)}</div>` : ''}
  ${byPart.map((p) => `<section class="part"><small>${esc(ch.doc === '인연서' ? '因緣鑑定' : '運命鑑定')}</small><h2>${esc(p.title)}</h2></section>${p.chapters.map((x) => `<section class="chap"><div class="no">제 ${++n} 장</div><h3>${esc(x.title)}</h3>${x.say ? `<div class="say"><b>핵심 요약</b>${esc(x.say)}</div>` : ''}${paras(x.body)}${x.points?.length ? `<div class="pts"><b>장점·포인트</b><ul>${x.points.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}${x.caution || x.advice ? `<div class="ca">${x.caution ? `<div class="c"><b>주의할 점</b>${esc(x.caution)}</div>` : ''}${x.advice ? `<div class="a"><b>이렇게 해 보세요</b>${esc(x.advice)}</div>` : ''}</div>` : ''}${x.highlight ? `<p class="hl"><span>한 줄 정리</span>${esc(x.highlight)}</p>` : ''}</section>`).join('')}`).join('')}
  <section class="closing"><h2 class="sec">${esc(c.closing.title)}</h2>${paras(c.closing.body)}${c.closing.tips?.length ? `<ul>${c.closing.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}<div class="end">나만의 운세 감정실<span>運</span></div>
    <p class="note">이 감정서는 명리학의 원리로 타고난 기운과 흐름을 풀이한 참고 자료이며, 의료·법률·투자 판단을 대신하지 않습니다.</p></section>
  </body></html>`;
}

/* ---------- Chromium 인쇄(한 번 띄운 브라우저 재사용, 2분 쉬면 닫음, 동시 1건) ---------- */
let browser: any = null, idle: NodeJS.Timeout | null = null, queue: Promise<unknown> = Promise.resolve();
async function getBrowser() {
  if (browser?.isConnected?.()) return browser;
  const { chromium } = await import('playwright-core');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] });
  return browser;
}
const EDGE = 'width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#f8f0de;';
export function renderPdf(html: string, footer: string): Promise<Buffer> {
  const job = queue.then(async () => {
    if (idle) clearTimeout(idle);
    const b = await getBrowser();
    const page = await b.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
      return await page.pdf({
        // 위·아래 여백 칸도 한지 바탕색으로 채워 종이 전체가 아이보리 한지처럼 보이게(대표님 10/14)
        format: 'A4', printBackground: true, displayHeaderFooter: true,
        headerTemplate: `<style>html,body{margin:0!important;padding:0!important}</style><div style="${EDGE}height:21.4mm;margin-top:-6mm"></div>`,
        footerTemplate: `<style>html,body{margin:0!important;padding:0!important}</style><div style="${EDGE}height:18.6mm;position:relative;top:5.4mm;display:flex;align-items:center;justify-content:center;font-size:8px;color:#9a8a6a;font-family:'Noto Sans CJK KR',sans-serif">${esc(footer)} · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
        margin: { top: '20mm', bottom: '18mm', left: '0', right: '0' },
      });
    } finally {
      await page.close().catch(() => {});
      idle = setTimeout(() => { browser?.close().catch(() => {}); browser = null; }, 120_000);
      idle.unref?.();
    }
  });
  queue = job.catch(() => {});
  return job as Promise<Buffer>;
}

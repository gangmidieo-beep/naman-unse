// 상품 상세 「결과지 목차」 — 3차 요청(2026-10-14): 결과지에 무엇이 들어가는지 목차 + 항목별 짧은 설명 + 분량 미리 보기
// 목차는 실제 감정서를 만드는 목차(reading-outline-long.json)를 그대로 써서 상세와 결과지가 어긋나지 않게 한다.
import longOutline from '@naman/content/data/reading-outline-long.json';
import outline from '@naman/content/data/reading-outline.json';
import desc from '@naman/content/data/toc-desc.json';
import { Icon } from './Icon';

type Sec = { id: string; title: string; each?: 'daewoon' | 'seun' | 'month' };
type Part = { title: string; base?: boolean; pairBase?: number; sections?: Sec[] };
const L = longOutline as unknown as { base: Sec[]; pairBase: Sec[]; groups: Record<string, Part[]> };
const P = (outline as unknown as { products: Record<string, string> }).products;
const D = desc as unknown as { part: Record<string, string[]>; section: Record<string, string> };
// 펼쳐지는 장(대운·세운·월운)은 보통 개수로 한 줄 요약
const EACH: Record<string, { n: number; line: (t: string) => string }> = {
  daewoon: { n: 8, line: (t) => `1~8번째 대운 · 10년씩 ${t}` },
  seun: { n: 10, line: (t) => `앞으로 10년 · 해마다 ${t}` },
  month: { n: 12, line: (t) => `1월~12월 · 달마다 ${t}` },
};

export const tocGroupOf = (productId: string) => P[productId];

export function ReadingToc({ productId, title }: { productId: string; title: string }) {
  const group = P[productId];
  if (!group || !L.groups[group]) return null;
  const now = new Date();
  const year = now.getFullYear() + (now.getMonth() >= 10 ? 1 : 0);
  const theme = title.replace(/\s/g, ' ').replace(/운세$|운$/, '') + '운';
  const fill = (t: string, extra: Record<string, string> = {}) =>
    t.replace(/\{(\w+)\}/g, (_, k: string) => ({ theme, year: String(year), dm: '', name1: '나', name2: '상대', name: extra.name ?? '', ...extra } as Record<string, string>)[k] ?? '')
      .replace(/\s*\(\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  let total = 0;
  const parts = L.groups[group].map((p, pi) => {
    const items: { t: string; d: string }[] = [];
    if (p.base) for (const s of L.base) { items.push({ t: fill(s.title), d: D.section[s.id] ?? '' }); total++; }
    if (p.pairBase != null) for (const s of L.pairBase) { items.push({ t: fill(s.title, { name: p.pairBase === 0 ? '나' : '상대' }).replace(/^(나|상대) 님의/, '$1의'), d: D.section[s.id] ?? '' }); total++; }
    for (const s of p.sections ?? []) {
      if (s.each) {
        const e = EACH[s.each];
        const what = group === 'theme' ? `${theme}의 흐름` : group === 'love' ? '인연의 흐름' : s.each === 'month' ? '운과 할 일' : '운의 흐름';
        items.push({ t: e.line(what), d: `${e.n}개 장으로 하나씩 풀어 드려요` });
        total += e.n;
      } else { items.push({ t: fill(s.title), d: D.section[s.id] ?? '' }); total++; }
    }
    return { title: fill(p.title), d: D.part[group]?.[pi] ?? '', items };
  });
  return (
    <section className="pd-sec pd-toc">
      <h2><i aria-hidden>❖</i>결과지 목차</h2>
      <div className="toc-meta">
        <span><i className="mi"><Icon name="file-text" size={20} /></i><b>A4 약 40~50쪽</b>분량</span>
        <span><i className="mi"><Icon name="layers" size={20} /></i><b>{parts.length}부 {total}장</b>구성</span>
        <span><i className="mi"><Icon name="scroll-text" size={20} /></i><b>화면 + PDF</b>저장</span>
      </div>
      <p className="toc-lead">장마다 <b>핵심 요약 → 상세 해석 → 장점·포인트 → 주의할 점 → 이렇게 해 보세요 → 한 줄 정리</b> 순서로 담겨요. 사주 원국표·오행 분포·대운표·세운표도 함께 들어가요.</p>
      <ol className="toc-parts">
        {parts.map((p, i) => (
          <li key={p.title}>
            <details open={i === 0}>
              <summary><b>{p.title}</b><small>{p.items.length > 1 ? `${p.items.length}개 항목` : ''}</small></summary>
              {p.d && <p className="toc-pd">{p.d}</p>}
              <ul>{p.items.map((x) => <li key={x.t}><b>{x.t}</b>{x.d && <span>{x.d}</span>}</li>)}</ul>
            </details>
          </li>
        ))}
      </ol>
      <p className="toc-note">대운·해마다의 장 수는 태어난 해와 나이에 따라 조금 달라질 수 있어요.</p>
    </section>
  );
}

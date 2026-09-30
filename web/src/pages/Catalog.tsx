// 운세 탭 /unse — 분류 칩(전체·천궁도사·월하선녀·재미로 보는·사진으로 보는) + 세부 분류 + 목록형/그리드형 전환(기본 목록형).
// 주소: /unse?cat=fate&g=재물과 성공&view=grid  (옛 /fate · /love 는 여기로 리다이렉트)
import { useSearchParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { CategoryTabs, ProductCard, toCardItem, type CardItem } from '../components/ui';
import { BRAND, FATE, LOVE, PHOTOS, type Product } from '../lib/catalog';
import { THUMBS } from '../assets/thumbs';
import { useApp } from '../store/app';

type Cat = 'all' | 'fate' | 'love' | 'fun' | 'photo';
const CATS = BRAND.categories as { id: Cat; label: string; sub?: string; groups?: string[] }[];
const FUN: CardItem[] = BRAND.fun.map((f) => ({ id: f.id, title: f.title, copy: f.copy, link: f.link, hanja: f.hanja, img: THUMBS[`fun_${f.id}`], by: '재미로 보는 · 무료', free: true }));
const sorted = (l: Product[], g?: string) => l.filter((p) => p.visible !== false && (!g || p.group === g)).sort((a, b) => a.sort - b.sort);

export function UnseTab() {
  const [sp, setSp] = useSearchParams();
  const cat = (CATS.some((c) => c.id === sp.get('cat')) ? sp.get('cat') : 'all') as Cat;
  const info = CATS.find((c) => c.id === cat)!;
  const g = info.groups?.includes(sp.get('g') ?? '') ? sp.get('g')! : null;
  const view = sp.get('view') === 'grid' ? 'grid' : 'list';
  const purchases = useApp((s) => s.purchases);
  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp);
    if (v == null) n.delete(k); else n.set(k, v);
    if (k === 'cat') n.delete('g');
    setSp(n, { replace: true });
  };
  const card = (p: Product) => toCardItem(p, purchases.some((x) => x.productId === p.id));
  const sections: { title: string; items: CardItem[] }[] =
    cat === 'fate' ? [{ title: '', items: sorted(FATE, g ?? undefined).map(card) }]
    : cat === 'love' ? [{ title: '', items: sorted(LOVE, g ?? undefined).map(card) }]
    : cat === 'fun' ? [{ title: '', items: FUN }]
    : cat === 'photo' ? [{ title: '', items: sorted(PHOTOS).map(card) }]
    : [
      { title: '천궁도사 · 나만의 운명', items: sorted(FATE).map(card) },
      { title: '월하선녀 · 나만의 인연', items: sorted(LOVE).map(card) },
      { title: '재미로 보는 운세', items: FUN },
      { title: '사진으로 보는 운세', items: sorted(PHOTOS).map(card) },
    ];
  return (
    <>
      <SubHeader title="운세" sub="천궁도사 · 월하선녀가 풀어드리는 모든 운세" back={false} />
      <main className="screen">
        <div className="chips-x" role="tablist" aria-label="운세 분류">
          {CATS.map((c) => (
            <button key={c.id} role="tab" aria-selected={c.id === cat} className={`chip${c.id === cat ? ' on' : ''}`} onClick={() => set('cat', c.id)}>{c.label}</button>
          ))}
        </div>
        {info.groups && <CategoryTabs tabs={['전체', ...info.groups]} value={g ?? '전체'} onChange={(v) => set('g', v === '전체' ? null : v)} />}
        <div className="viewbar">
          <span>{info.sub ?? '전체 운세'}</span>
          <div className="vt" role="group" aria-label="보기 방식">
            <button className={view === 'list' ? 'on' : ''} onClick={() => set('view', null)} aria-pressed={view === 'list'}>☰ 목록</button>
            <button className={view === 'grid' ? 'on' : ''} onClick={() => set('view', 'grid')} aria-pressed={view === 'grid'}>▦ 그리드</button>
          </div>
        </div>
        {sections.map((s) => (
          <section key={s.title || cat}>
            {s.title && <h2 className="unse-h">{s.title}</h2>}
            <div className={view === 'grid' ? 'pgrid' : ''}>{s.items.map((c) => <ProductCard key={c.id} c={c} mode={view} />)}</div>
          </section>
        ))}
      </main>
    </>
  );
}

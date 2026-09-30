// 나만의 운명(천궁도사 14) / 나만의 인연(월하선녀 12) — 분류 탭 + 도사 컨텐츠 형식 목록
import { useSearchParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { CategoryTabs, ProductRow } from '../components/ui';
import { BRAND, FATE, LOVE, type Reading } from '../lib/catalog';
import { useApp } from '../store/app';

function List({ title, sub, groups, items, lead }: { title: string; sub: string; groups: string[]; items: Reading[]; lead: string }) {
  const [sp, setSp] = useSearchParams();
  const g = sp.get('g') && groups.includes(sp.get('g')!) ? sp.get('g')! : groups[0];
  const purchases = useApp((s) => s.purchases);
  const shown = items.filter((p) => p.group === g && p.visible !== false).sort((a, b) => a.sort - b.sort);
  return (
    <>
      <SubHeader title={title} sub={sub} back={false} />
      <main className="screen">
        <CategoryTabs tabs={groups} value={g} onChange={(v) => setSp({ g: v }, { replace: true })} />
        <p className="listhead">{lead}</p>
        {shown.map((p) => <ProductRow key={p.id} p={p} owned={purchases.some((x) => x.productId === p.id)} />)}
      </main>
    </>
  );
}

export function FateList() {
  return <List title="나만의 운명" sub="천궁도사가 풀어드리는 운명서" groups={BRAND.groups.fate} items={FATE} lead="타고난 사주부터 재물과 성공, 앞으로 펼쳐질 운의 흐름까지 살펴보세요." />;
}
export function LoveList() {
  return <List title="나만의 인연" sub="월하선녀가 풀어드리는 인연서" groups={BRAND.groups.love} items={LOVE} lead="사랑과 인연 속에 숨겨진 이야기, 나에게 찾아올 인연의 흐름을 살펴보세요." />;
}

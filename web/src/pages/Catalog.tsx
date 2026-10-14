// 운세 탭 /unse v4 (대표님 2차 수정) — 아이콘 + 이름 라운드 탭 4개(전체·운명·사주·연애·궁합·사진운세), 유료 상품만.
// 목록: 넓은 그림 썸네일 + 이름·한 줄·할인가·회원가 (캐릭터 반복 표시 없음). 2027 신년운세·토정비결이 맨 위. PC 에서는 3~4열 카드.
// 주소: /unse?cat=fate  (옛 /fate · /love 는 여기로, ?cat=fun 은 /fun 으로)
import { PremiumButton } from '../components/PremiumPopup';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { ProductCard, toCardItem } from '../components/ui';
import { BRAND, FATE, LOVE, PHOTOS, type Product } from '../lib/catalog';
import { THUMBS } from '../assets/thumbs';
import { useApp } from '../store/app';
import { v4, v4png } from '../assets/images';

type Cat = 'all' | 'fate' | 'love' | 'photo';
const CATS = BRAND.categories as { id: Cat; label: string; sub?: string; icon: string }[];
const sorted = (l: Product[]) => l.filter((p) => p.visible !== false).sort((a, b) => a.sort - b.sort);
const LIST: Record<Exclude<Cat, 'all'>, Product[]> = { fate: FATE, love: LOVE, photo: PHOTOS };

export function CatTabs({ value, onChange }: { value: Cat; onChange: (c: Cat) => void }) {
  return (
    <div className="rtabs" role="tablist" aria-label="운세 분류">
      {CATS.map((c) => (
        <button key={c.id} role="tab" aria-selected={c.id === value} className={c.id === value ? 'on' : ''} onClick={() => onChange(c.id)}>
          <img src={v4png(c.icon)} alt="" /><span>{c.label}</span>
        </button>
      ))}
    </div>
  );
}

function CatSection({ cat, more }: { cat: Exclude<Cat, 'all'>; more?: () => void }) {
  const purchases = useApp((s) => s.purchases);
  const info = CATS.find((c) => c.id === cat)!;
  const items = sorted(LIST[cat]);
  return (
    <section className={`catsec c-${cat}`}>
      <div className="cathead" style={cat === 'photo' ? { backgroundImage: `url(${v4('photo_header')})` } : undefined}>
        <h2>{info.label}<i aria-hidden /></h2>
        <p>{info.sub}</p>
        {more && <button className="sec-more" onClick={more}>전체 보기 ›</button>}
      </div>
      <div className="plist">
        {items.map((p) => <ProductCard key={p.id} c={toCardItem(p, purchases.some((x) => x.productId === p.id))} mode="list" />)}
      </div>
    </section>
  );
}

export function UnseTab() {
  const [sp, setSp] = useSearchParams();
  if (sp.get('cat') === 'fun') return <Navigate to="/fun" replace />;
  const cat = (CATS.some((c) => c.id === sp.get('cat')) ? sp.get('cat') : 'all') as Cat;
  const set = (c: Cat) => { setSp(c === 'all' ? {} : { cat: c }, { replace: true }); scrollTo(0, 0); };
  return (
    <>
      <SubHeader title="운 세" sub="사주와 인연, 사진으로 보는 나만의 운세" back={false} big />
      <main className="screen unse4">
        <PremiumButton />
        <CatTabs value={cat} onChange={set} />
        {cat === 'all'
          ? (['fate', 'love', 'photo'] as const).map((c) => <CatSection key={c} cat={c} more={() => set(c)} />)
          : <CatSection cat={cat} />}
      </main>
    </>
  );
}

// 재미로 보는 운세 전체 (무료) — 홈 "전체 보기"
export function FunList() {
  return (
    <>
      <SubHeader title="재미로 보는 운세" sub="가볍게 즐기고, 새롭게 발견하는 나의 이야기" />
      <main className="screen">
        <PremiumButton />
        <div className="funcards mt14">
          {BRAND.fun.map((x) => (
            <Link key={x.id} to={x.link} className="funcard">
              <div className="im">{THUMBS[`fun_${x.id}`] && <img src={THUMBS[`fun_${x.id}`]} alt="" loading="lazy" width={480} height={240} />}</div>
              <div className="tx"><b>{x.title}</b><span className="fb">무료</span><p>{x.copy}</p></div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

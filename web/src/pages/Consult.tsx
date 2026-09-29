// S6 사주상담 — 시안 ③. 캐릭터 인사 → 고민 칩 → 캐릭터 답 + 추천 상품 강조 → 금색 결제 버튼.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import consult from '@naman/content/data/consult.json';
import { hash } from '@naman/content';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, ChipGroup, RareListItem } from '../components/ui';
import { Img } from '../components/Img';
import { useApp } from '../store/app';
import { BRAND, discounted, productById, won, type Product } from '../lib/brand';
import { newYearTarget } from '../lib/dates';
import { track } from '../lib/track';

type Who = 'dosa' | 'sunnyeo';
type WorryId = (typeof consult.worries)[number]['id'];
const HERO: Record<Who, { tag: string; line: [string, string] }> = {
  dosa: { tag: '천궁도령 · 정통사주 · 재물 · 직장', line: ['별을 읽어', '그대의 길을 보여드리지요'] },
  sunnyeo: { tag: '월하선녀 · 궁합 · 애정', line: ['붉은 실을 따라', '두 사람의 인연을 살펴요'] },
};
const MAIN_PRODUCTS = ['saju', 'gunghap', 'newyear'];
const day = new Date().toISOString().slice(0, 10);

export function productTitle(p: Product) {
  return p.id === 'newyear' ? `${newYearTarget().year} 신년운세` : p.name;
}
export function productThumb(p: Product): { img?: 'dosaFace' | 'sunnyeoFace'; th?: string } {
  if (p.id === 'newyear') return { th: newYearTarget().pillar.hanja[0] };
  return { img: p.character === 'dosa' ? 'dosaFace' : 'sunnyeoFace' };
}
export function PriceTag({ p, premium }: { p: Product; premium: boolean }) {
  return premium ? (
    <>{won(discounted(p.price))}<del>{won(p.price)}</del>{p.isSample && <small>예시 가격</small>}</>
  ) : (
    <>{won(p.price)}{p.isSample && <small>예시 가격</small>}</>
  );
}

export default function Consult() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const premium = useApp((s) => s.premium);
  const initialProduct = sp.get('product');
  const initialWorry = consult.worries.find((w) => w.product === initialProduct)?.id ?? null;
  const [who, setWho] = useState<Who>((sp.get('who') as Who) || (initialWorry ? (consult.worries.find((w) => w.id === initialWorry)!.who as Who) : 'dosa'));
  const [worry, setWorry] = useState<WorryId | null>(initialWorry);
  const [selected, setSelected] = useState<string | null>(initialProduct && productById(initialProduct) ? initialProduct : null);
  const [switched, setSwitched] = useState(false);
  const w = consult.worries.find((x) => x.id === worry);

  const products = useMemo(() => {
    const rec = w?.product ?? selected;
    const list = [rec, ...MAIN_PRODUCTS.filter((id) => id !== rec && !(rec && rec.startsWith(id + '_')))].filter(Boolean) as string[];
    return list.map((id) => productById(id)!).filter(Boolean);
  }, [w, selected]);
  const sel = selected ? productById(selected) : null;
  useEffect(() => { if (sel) track('product_view', { product: sel.id }); }, [sel]);

  const chooseWorry = (id: WorryId) => {
    const x = consult.worries.find((q) => q.id === id)!;
    setWorry(id);
    setWho(x.who as Who);
    setSelected(x.product);
  };
  const greet = consult.greet[who][hash(day + who) % consult.greet[who].length];
  const reply = w ? w.reply[hash(day + w.id) % w.reply.length] : null;
  const price = sel ? (premium ? discounted(sel.price) : sel.price) : 0;

  return (
    <>
      <SubHeader title="사주상담" back={false} />
      <main className="screen">
        <div className="hero">
          <Img k={who === 'dosa' ? 'dosaBanner' : 'sunnyeoBanner'} eager alt={who === 'dosa' ? '천궁도령' : '월하선녀'} />
          <div className="shade" />
          <div className="switch" role="group" aria-label="상담 캐릭터">
            {(['dosa', 'sunnyeo'] as Who[]).map((x) => (
              <button key={x} className={who === x ? 'on' : ''} aria-pressed={who === x} onClick={() => { setWho(x); setSwitched(true); }}>
                {x === 'dosa' ? '천궁도령' : '월하선녀'}
              </button>
            ))}
          </div>
          <div className="txt"><small>{HERO[who].tag}</small><b>{HERO[who].line[0]}<br />{HERO[who].line[1]}</b></div>
        </div>

        <CharacterBubble who={who}>{switched && !worry ? consult.switchLine[who] : greet}</CharacterBubble>
        <ChipGroup value={worry} onChange={chooseWorry} options={consult.worries.map((x) => ({ value: x.id as WorryId, label: x.label }))} />
        {w && (
          <>
            <CharacterBubble who="me">{w.label} 고민이에요</CharacterBubble>
            <CharacterBubble who={w.who as Who}>{reply}</CharacterBubble>
          </>
        )}

        {products.map((p) => (
          <RareListItem key={p.id} {...productThumb(p)} title={productTitle(p)} desc={p.desc} sel={p.id === selected}
            price={<PriceTag p={p} premium={premium} />} onClick={() => setSelected(p.id)} />
        ))}

        <Button kind="gold" disabled={!sel} onClick={() => sel && nav(`/checkout/${sel.id}`)}>
          {sel ? (premium ? `✦ 프리미엄 할인가 ${won(price)}로 풀이 받기` : `✦ ${won(price)} 결제하고 풀이 받기`) : '풀이를 골라 주세요'}
        </Button>
        <p className="note">
          {premium ? `프리미엄 회원 ${Math.round(BRAND.subscription.discountRate * 100)}% 할인 적용` : '프리미엄 회원은 할인돼요'}
          {sel?.isSample && ' · 가격은 확정 전 예시예요'}
        </p>
      </main>
    </>
  );
}

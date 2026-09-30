// 상품 상세 — 히어로 → 금 상품명 → 명조 부제 → "운명서/인연서에 담기는 내용"(一二三四) → 캐릭터 한마디 → 이용 방법 → 하단 고정 결제 바
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import detailDb from '@naman/content/data/product-detail.json';
import { StepList, StickyBuyBar } from '../components/ui';
import { Img } from '../components/Img';
import { CHAR, buyLabel, charOf, displayTitle, isTalisman, memberPrice, productById, thumbOf, isTwoPerson } from '../lib/catalog';
import { usePremium } from '../store/app';
import { track } from '../lib/track';
import { useEffect } from 'react';

type Detail = { subtitle: string; contents: { title: string; desc: string }[]; say: string };

export default function ProductDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const premium = usePremium();
  const p = productById(id);
  useEffect(() => { if (p) track('product_view', { product: p.id }); }, [p]);
  if (!p) return <Navigate to="/fate" replace />;
  if (isTalisman(p)) return <Navigate to={`/talisman/${p.id}`} replace />;
  const who = charOf(p);
  const c = CHAR[who];
  const d = (detailDb as Record<string, Detail>)[p.id];
  const t = thumbOf(p);
  return (
    <>
      <main className="screen no-tab sticky-pad">
        <div className="dhero">
          <button className="back" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="뒤로">‹</button>
          <Img k={c.banner} eager alt={c.name} />
          <div className={`hz${t.hanja.length > 1 ? ' two' : ''}`} style={{ opacity: .28 }} aria-hidden>{t.hanja}</div>
          <div className="shade" />
        </div>
        <div className="dtitle">
          <small>{c.name} · {p.group}{isTwoPerson(p.id) ? ' · 두 사람 입력' : ''}</small>
          <h2>{displayTitle(p)}</h2>
          <p>{d?.subtitle ?? p.cardCopy}</p>
        </div>
        {d && <StepList label={`${c.book}에 담기는 내용`} steps={d.contents} hanjaNums />}
        {d && (
          <div className="saybox">
            <Img k={c.face} alt="" />
            <div className="b"><small>{c.name}</small><p>{d.say}</p></div>
          </div>
        )}
        <StepList label="이용 방법" steps={[
          { title: who === 'cheongung' ? '상세풀이 받기' : '인연서 열기', desc: isTwoPerson(p.id) ? '두 사람의 생년월일을 확인하고 결제해 주세요' : '아래 버튼을 눌러 결제해 주세요' },
          { title: `${c.book} 완성`, desc: `${c.name}가 사주를 읽고 풀이를 씁니다 (약 1분)` },
          { title: '나의 운세함에 보관', desc: '언제든 다시 열어보고 저장·공유할 수 있어요' },
        ]} />
      </main>
      <StickyBuyBar price={p.price} member={memberPrice(p)} premium={premium} label={buyLabel(p)} onBuy={() => nav(`/checkout/${p.id}`)} />
    </>
  );
}

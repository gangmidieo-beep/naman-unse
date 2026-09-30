// 상품 상세 v3 (긴 글 금지) — 히어로 → 상품명·한 줄 → 이런 분께 필요해요(체크 3) → 지금 봐야 하는 이유(2문장) → 담기는 내용(아이콘 카드 4) → 이용 방법 1·2·3 → 하단 고정바
// 문구: packages/content/data/product-detail.json (상품 id별 subtitle·target·why·contents·say)
import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import detailDb from '@naman/content/data/product-detail.json';
import { StepList, StickyBuyBar } from '../components/ui';
import { Img } from '../components/Img';
import { CHAR, buyLabel, charOf, displayTitle, isPhoto, isTalisman, isTarot, isTwoPerson, productById, thumbOf } from '../lib/catalog';
import { usePremium } from '../store/app';
import { track } from '../lib/track';

type Detail = { subtitle: string; contents: { title: string; desc: string; icon?: string }[]; say: string; target?: string[]; why?: string };

export default function ProductDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const premium = usePremium();
  const p = productById(id);
  useEffect(() => { if (p) track('product_view', { product: p.id }); }, [p]);
  if (!p) return <Navigate to="/unse" replace />;
  if (isTalisman(p)) return <Navigate to={`/talisman/${p.id}`} replace />;
  const who = charOf(p);
  const c = CHAR[who];
  const d = ((p as any).detailCopy ?? (detailDb as Record<string, Detail>)[p.id]) as Detail | undefined; // 관리자 값 우선
  const t = thumbOf(p);
  const book = isTarot(p) ? '타로 리딩' : isPhoto(p) ? `${p.title.replace(' 풀이', '')} 풀이` : c.book;
  const steps = isPhoto(p)
    ? [
      { title: '결제하기', desc: '아래 버튼을 눌러 결제해 주세요' },
      { title: '사진 올리기', desc: '안내에 맞춰 찍은 사진 한 장을 올려요 (풀이 직후 삭제)' },
      { title: '풀이 받기', desc: `${c.name}가 읽어 드린 풀이는 운세함에 보관돼요` },
    ]
    : isTarot(p)
      ? [
        { title: '결제하기', desc: '아래 버튼을 눌러 결제해 주세요' },
        { title: '카드 뒤집기', desc: `카드 ${(p as any).cards}장을 한 장씩 뒤집어요` },
        { title: '운세함에 보관', desc: '뽑은 카드와 풀이는 언제든 다시 볼 수 있어요' },
      ]
      : [
        { title: who === 'cheongung' ? '상세풀이 받기' : '인연서 열기', desc: isTwoPerson(p.id) ? '두 사람의 생년월일을 확인하고 결제해 주세요' : '아래 버튼을 눌러 결제해 주세요' },
        { title: `${c.book} 완성`, desc: `${c.name}가 사주를 읽고 풀이를 씁니다 (약 1분)` },
        { title: '나의 운세함에 보관', desc: '언제든 다시 열어보고 저장·공유할 수 있어요' },
      ];
  return (
    <>
      <main className={`screen no-tab sticky-pad${isTarot(p) ? ' tarot-detail' : ''}`}>
        <div className="dhero">
          <button className="back" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="뒤로">‹</button>
          {t.src ? <img src={t.src} alt="" className="dthumb" /> : <Img k={c.banner} eager alt={c.name} />}
          {!t.src && <div className={`hz${t.hanja.length > 1 ? ' two' : ''}`} style={{ opacity: .28 }} aria-hidden>{t.hanja}</div>}
          <div className="shade" />
        </div>
        <div className="dtitle">
          <small>{c.name} · {p.group}{isTwoPerson(p.id) ? ' · 두 사람 입력' : ''}</small>
          <h2>{displayTitle(p)}</h2>
          <p>{d?.subtitle ?? p.cardCopy}</p>
        </div>
        {d?.target && (
          <section className="dblock">
            <h3>이런 분께 필요해요</h3>
            <ul className="checks">{d.target.map((x) => <li key={x}>{x}</li>)}</ul>
          </section>
        )}
        {d?.why && (
          <section className="dblock">
            <h3>지금 봐야 하는 이유</h3>
            <p>{d.why}</p>
          </section>
        )}
        {d && (
          <section className="dblock">
            <h3>{book}에 담기는 내용</h3>
            <div className="icards">
              {d.contents.map((x, i) => (
                <div key={x.title} className="icard"><i aria-hidden>{x.icon ?? '一二三四'[i]}</i><b>{x.title}</b><span>{x.desc}</span></div>
              ))}
            </div>
          </section>
        )}
        {d && (
          <div className="saybox">
            <Img k={c.face} alt="" />
            <div className="b"><small>{c.name}</small><p>{d.say}</p></div>
          </div>
        )}
        <StepList label="이용 방법" steps={steps} />
      </main>
      <StickyBuyBar p={p} premium={premium} label={buyLabel(p)} onBuy={() => nav(`/checkout/${p.id}`)} />
    </>
  );
}

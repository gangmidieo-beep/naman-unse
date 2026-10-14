// 상품 상세 공통 템플릿 v4 (대표님 2차 수정 — 정통운세 시안 기준, 26종 + 타로 6 + 사진 3 모두 이 틀 하나)
// 대표 그림 → 상품명·한 줄 → OO란? → 이런 분께 필요해요 → 지금 봐야 하는 이유 → 운명서(인연서·타로)에 담기는 내용(아이콘)
// → 천궁도사/월하선녀 한마디 → 이용 방법(상품별 입력: 사주 / 두 사람 / 사진) → 가격 + "내 OOO 상세풀이 보기"(하단 고정)
// 타로는 같은 틀을 어두운 밤하늘 색으로(.dk). 문구: packages/content/data/product-detail.json (관리자 상세 문구가 있으면 우선)
import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import detailDb from '@naman/content/data/product-detail.json';
import { Img } from '../components/Img';
import { Icon } from '../components/Icon';
import { CHAR, charOf, displayTitle, isPhoto, isTalisman, isTarot, isTwoPerson, memberPrice, productById, thumbOf, won, type Product } from '../lib/catalog';
import { usePremium } from '../store/app';
import { track } from '../lib/track';
import { optionalImg, v4 } from '../assets/images';

type Detail = { subtitle: string; about?: string; contents: { title: string; desc: string; icon?: string }[]; say: string; target?: string[]; why?: string };

function stepsOf(p: Product): { icon: string; title: string; desc: string }[] {
  const two = isTwoPerson(p.id);
  if (p.id === 'baby') return [
    { icon: 'credit-card', title: '결제하기', desc: '원하는 상품을 결제해 주세요. 프리미엄 회원은 프리미엄 회원가로 결제돼요.' },
    { icon: 'camera', title: '두 사람 사진 올리기', desc: '정면 얼굴 사진 두 장을 올려 주세요.' },
    { icon: 'baby', title: '아들·딸 얼굴 확인', desc: 'AI가 그린 두 아이의 얼굴을 확인하세요.' },
  ];
  if (isPhoto(p)) return [
    { icon: 'credit-card', title: '결제하기', desc: '원하는 상품을 결제해 주세요. 프리미엄 회원은 프리미엄 회원가로 결제돼요.' },
    { icon: 'camera', title: '사진 올리기', desc: `${p.id === 'palm' ? '손바닥' : '얼굴'} 사진 한 장을 찍거나 골라 주세요.` },
    { icon: 'scroll-text', title: '상세풀이 확인', desc: '풀이는 운세함에 보관돼요. 사진은 저장하지 않아요.' },
  ];
  if (isTarot(p)) return [
    { icon: 'credit-card', title: '상세풀이 받기', desc: '아래 버튼을 눌러 결제를 진행해 주세요.' },
    { icon: 'layers', title: '카드를 뽑고 해석하기', desc: `질문을 떠올리며 타로 카드를 펼쳐요. (${(p as any).cards}장)` },
    { icon: 'book-open', title: '나의 타로 확인하기', desc: '상세한 해석과 조언을 언제든 다시 볼 수 있어요.' },
  ];
  const c = CHAR[charOf(p)];
  return [
    { icon: 'pencil', title: '정보 입력', desc: two ? '두 사람의 생년월일·태어난 시·성별을 입력해 주세요.' : '생년월일, 태어난 시, 성별을 입력해 주세요.' },
    { icon: 'credit-card', title: '결제하기', desc: `${p.title}을(를) 결제해 주세요. 프리미엄 회원은 프리미엄 회원가로 결제돼요.` },
    { icon: 'scroll-text', title: '상세풀이 확인', desc: `${c.name}의 ${p.title} 상세풀이를 확인하세요.` },
  ];
}

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
  const about = d?.about ?? (detailDb as Record<string, Detail>)[p.id]?.about;
  const t = thumbOf(p);
  const title = displayTitle(p);
  const tarot = isTarot(p);
  const book = tarot ? '타로' : isPhoto(p) ? '풀이' : c.book;
  const hero = optionalImg(`detail_${p.id}`)?.src ?? (tarot && p.id === 'tarot_love' ? v4('tarot_detail_hero') : t.src);
  const m = memberPrice(p);
  const pay = premium ? m : p.price;
  const dark = tarot ? ' dk' : '';
  return (
    <>
      <main className={`screen no-tab sticky-pad pd4${dark}`}>
        <div className="pd-hero">
          {hero && <img className="bg" src={hero} alt="" aria-hidden />}
          {hero ? <img className="fg" src={hero} alt={title} /> : <span className="hz" aria-hidden>{t.hanja}</span>}
          <button className="back" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="뒤로">‹</button>
          <div className="shade" />
        </div>
        <div className="pd-title">
          {tarot && <small className="en">✦ TAROT ✦</small>}
          <h1>{title}</h1>
          <p>{d?.subtitle ?? p.cardCopy}</p>
        </div>

        {about && (
          <section className="pd-about">
            {t.src && <img src={t.src} alt="" />}
            <div><h2><Icon name="heart" size={18} />{title}{iran(title)}</h2><p>{about}</p></div>
          </section>
        )}

        {d?.target && (
          <section className="pd-sec">
            <h2><i aria-hidden>❖</i>이런 분께 필요해요</h2>
            <ul className="pd-checks">{d.target.map((x) => <li key={x}><span aria-hidden>✓</span>{x}</li>)}</ul>
          </section>
        )}

        {d?.why && (
          <section className="pd-sec pd-why">
            <h2><i aria-hidden>❖</i>지금 봐야 하는 이유</h2>
            <p>{d.why}</p>
          </section>
        )}

        {d && (
          <section className="pd-sec">
            <h2><i aria-hidden>❖</i>{tarot ? `${p.title.replace(/\s/g, ' ')}에 담기는 내용` : `${book}에 담기는 내용`}</h2>
            <div className="pd-contents">
              {d.contents.map((x) => (
                <div key={x.title} className="pc"><span className="ic"><Icon name={x.icon && /^[a-z-]+$/.test(x.icon) ? x.icon : 'sparkles'} size={26} /></span><b>{x.title}</b><span className="ds">{x.desc}</span></div>
              ))}
            </div>
          </section>
        )}

        {d && (
          <section className="pd-say">
            <Img k={c.face} alt="" />
            <div><b>{c.name}{tarot ? '의 한마디' : ''}</b><p>“{d.say}”</p></div>
          </section>
        )}

        <section className="pd-sec">
          <h2><i aria-hidden>❖</i>이용 방법</h2>
          <ol className="pd-steps">
            {stepsOf(p).map((s, i) => (
              <li key={s.title}><span className="n">{i + 1}</span><span className="ic"><Icon name={s.icon} size={24} /></span><b>{s.title}</b><span className="ds">{s.desc}</span></li>
            ))}
          </ol>
        </section>
      </main>
      <div className={`buy4${dark}`}>
        <div className="pp">
          {premium
            ? <><s>{won(p.price)}</s><span className="rate">10%</span><b>{won(m)}</b><em>프리미엄 회원가</em></>
            : <><span className="lbl">정가</span><b className="list">{won(p.price)}</b><span className="mem"><strong>{won(m)}</strong> 프리미엄 회원가</span></>}
        </div>
        <button className="go" onClick={() => nav(`/checkout/${p.id}`)}>내 {title} 상세풀이 보기 ›</button>
        <span className="sr-only">결제 금액 {won(pay)}</span>
      </div>
    </>
  );
}

// "OO란?" 맞춤법 — 마지막 글자에 받침이 있으면 "이란?", 없으면 "란?" (정통궁합이란? · 연애 타로란?)
export function iran(word: string) {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '이란?';
  return code % 28 ? '이란?' : '란?';
}

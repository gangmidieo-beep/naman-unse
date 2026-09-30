// 결제 — 주문 요약 → (두 사람 상품은 상대 선택) → 결제수단(앱=Google Play, 웹=PG) → 약관 동의 → 결제. 지금은 mock 결제.
// 유료 결제 직전에 간편 로그인(Google·카카오·네이버)을 요구한다(화면설계_v2 10장).
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, ProductThumb, useToast } from '../components/ui';
import { LoginButtons } from './Login';
import { useApp, usePremium } from '../store/app';
import { CHAR, charOf, displayTitle, isTalisman, isTwoPerson, payPrice, productById, won } from '../lib/catalog';
import { getPayments, isNativeApp } from '../platform/payments';
import { track } from '../lib/track';
import { birthLabel } from './ProfileNew';

export default function Checkout() {
  const { product = '' } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { profiles, mainId, account, addPurchase } = useApp();
  const premium = usePremium();
  const p = productById(product);
  const pay = getPayments();
  const native = isNativeApp();
  const methods = native ? [{ id: 'google', label: 'Google Play 결제' }] : pay.methods();
  const [method, setMethod] = useState(methods[0].id);
  const [target, setTarget] = useState(mainId ?? profiles[0]?.id ?? '');
  const [partner, setPartner] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (p) track('checkout_open', { product: p.id }); }, [p]);
  if (!p) return <Navigate to="/unse" replace />;
  const price = payPrice(p, premium);
  const two = isTwoPerson(p.id);
  const partnerId = partner && partner !== target ? partner : profiles.find((x) => x.id !== target)?.id ?? '';
  const back = encodeURIComponent(loc.pathname);
  const who = CHAR[charOf(p)];

  const submit = async () => {
    setErr('');
    setBusy(true);
    track('pay_start', { product: p.id, method, price });
    const r = await pay.purchase(p.id, target, { method, amount: price });
    setBusy(false);
    if (r.status === 'paid') {
      track('pay_success', { product: p.id, orderId: r.orderId, price });
      addPurchase({ orderId: r.orderId, productId: p.id, profileId: two ? `${target}+${partnerId}` : target, price, createdAt: new Date().toISOString(), kind: isTalisman(p) ? 'talisman' : 'reading', status: 'paid' });
      nav(isTalisman(p) ? `/talisman/${p.id}/make?order=${r.orderId}` : `/reading/${r.orderId}`, { replace: true });
    } else if (r.status === 'cancelled') {
      track('pay_cancel', { product: p.id });
      toast('결제를 취소했어요');
    } else {
      track('pay_fail', { product: p.id, message: r.message });
      setErr(r.message ?? '결제에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (!profiles.length)
    return (
      <>
        <SubHeader title="결제" />
        <main className="screen no-tab">
          <div className="mt14" />
          <CharacterBubble who={charOf(p)}>{charOf(p) === 'cheongung' ? '풀이를 쓰려면 먼저 태어난 날을 알려 주셔야 하오.' : '풀이를 받으려면 먼저 태어난 날을 알려 주셔야 해요.'}</CharacterBubble>
          <div className="pad"><Button kind="gold" to={`/profile/new?back=${back}`}>내 정보 입력하기</Button></div>
        </main>
      </>
    );

  if (!account)
    return (
      <>
        <SubHeader title="간편 로그인" sub="결제한 풀이를 안전하게 보관해요" />
        <main className="screen no-tab">
          <div className="mt14" />
          <CharacterBubble who={charOf(p)}>{charOf(p) === 'cheongung' ? '풀이를 운세함에 잘 간직하려면 로그인이 필요하오.' : '풀이를 운세함에 잘 간직하려면 로그인이 필요해요.'}</CharacterBubble>
          <LoginButtons after={() => toast('로그인했어요')} />
          <p className="note" style={{ margin: '14px 18px 0' }}>무료 운세는 로그인 없이 계속 볼 수 있어요</p>
        </main>
      </>
    );

  return (
    <>
      <SubHeader title="결제" sub={displayTitle(p)} />
      <main className="screen no-tab">
        <section className="panel mt14" aria-label="주문 내용">
          <h2 className="h2">주문 내용</h2>
          <div className="orderrow">
            <ProductThumb p={p} size={64} />
            <div><b>{displayTitle(p)}</b><span className="muted">{p.cardCopy}</span></div>
          </div>
          {!isTalisman(p) && (
            <div className="field mt14">
              <label htmlFor="tg">{two ? '나' : '풀이 받을 사람'}</label>
              <select id="tg" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
                {profiles.map((x) => <option key={x.id} value={x.id}>{x.name} · {birthLabel(x)}</option>)}
              </select>
            </div>
          )}
          {two && (
            <div className="field">
              <label htmlFor="pt">상대</label>
              {profiles.filter((x) => x.id !== target).length ? (
                <select id="pt" className="input" value={partnerId} onChange={(e) => setPartner(e.target.value)}>
                  {profiles.filter((x) => x.id !== target).map((x) => <option key={x.id} value={x.id}>{x.name} · {birthLabel(x)}</option>)}
                </select>
              ) : (
                <Link to={`/profile/new?back=${back}&rel=상대`} className="btn line">+ 상대 정보 추가하기</Link>
              )}
            </div>
          )}
          <dl className="summary mt14">
            <dt>금액</dt>
            <dd className="price-big">{won(price)}{premium && <del>{won(p.price)}</del>}</dd>
          </dl>
          {premium && <p className="muted">프리미엄 회원가 적용</p>}
        </section>

        <section className="panel">
          <h2 className="h2">결제 수단</h2>
          <div className="methods" role="radiogroup">
            {methods.map((m) => (
              <label key={m.id} className={`method${method === m.id ? ' on' : ''}`}>
                <input type="radio" name="m" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} />{m.label}
              </label>
            ))}
          </div>
          {!native && <p className="muted mt8">앱에서는 Google Play 로 결제돼요.</p>}
        </section>

        <label className="check agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>주문 내용을 확인했고, <Link to="/box#terms" className="u">이용약관</Link>·<Link to="/box#terms" className="u">개인정보 처리</Link>와 디지털 콘텐츠 특성상 풀이를 연 뒤에는 환불이 어려운 점에 동의해요.</span>
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="pad mt14">
          <Button kind="gold" disabled={!agree || busy || (two && !partnerId)} onClick={submit}>
            {busy ? '결제 진행 중…' : `✦ ${won(price)} 결제하고 ${isTalisman(p) ? '부적 받기' : `${who.book} 열어보기`}`}
          </Button>
          <p className="note">지금은 시안이라 실제 돈이 나가지 않아요 (테스트 결제)</p>
        </div>
      </main>
      {busy && <div className="modal-bg"><div className="paying" role="status">결제를 확인하고 있어요…</div></div>}
    </>
  );
}

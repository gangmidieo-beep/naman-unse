// S7 결제 — 주문 요약 → 결제수단(앱=Google Play, 웹=PG) → 약관 동의 → 결제. 지금은 mock 결제.
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, useToast } from '../components/ui';
import { useApp } from '../store/app';
import { discounted, productById, won } from '../lib/brand';
import { getPayments, isNativeApp } from '../platform/payments';
import { track } from '../lib/track';
import { productThumb, productTitle } from './Consult';
import { Img } from '../components/Img';
import { birthLabel } from './ProfileNew';

export default function Checkout() {
  const { product = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { profiles, mainId, premium, addPurchase } = useApp();
  const p = productById(product);
  const pay = getPayments();
  const native = isNativeApp();
  const methods = native ? [{ id: 'google', label: 'Google Play 결제' }] : pay.methods();
  const [method, setMethod] = useState(methods[0].id);
  const [target, setTarget] = useState(mainId ?? profiles[0]?.id ?? '');
  const [partner, setPartner] = useState(profiles.find((x) => x.id !== target)?.id ?? '');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (p) track('checkout_open', { product: p.id }); }, [p]);
  if (!p) return <Navigate to="/consult" replace />;
  const price = premium ? discounted(p.price) : p.price;
  const isGunghap = p.id === 'gunghap';
  const partnerId = partner && partner !== target ? partner : profiles.find((x) => x.id !== target)?.id ?? '';
  const back = encodeURIComponent(`/checkout/${p.id}`);

  const submit = async () => {
    setErr('');
    setBusy(true);
    track('pay_start', { product: p.id, method, price });
    const r = await pay.purchase(p.id, target, { method, amount: price });
    setBusy(false);
    if (r.status === 'paid') {
      track('pay_success', { product: p.id, orderId: r.orderId, price });
      addPurchase({ orderId: r.orderId, productId: p.id, profileId: isGunghap ? `${target}+${partnerId}` : target, price, createdAt: new Date().toISOString() });
      nav(`/reading/${r.orderId}`, { replace: true });
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
          <CharacterBubble who={p.character as 'dosa' | 'sunnyeo'}>풀이를 받으려면 먼저 태어난 날을 알려 주셔야 해요.</CharacterBubble>
          <Button to={`/profile/new?back=${back}`}>내 정보 입력하기</Button>
        </main>
      </>
    );

  return (
    <>
      <SubHeader title="결제" />
      <main className="screen no-tab">
        <section className="panel order">
          <h2 className="h2">주문 내용</h2>
          <div className="orderrow">
            {productThumb(p).img ? <Img k={productThumb(p).img!} className="thumb" alt="" /> : <div className="thumb th">{productThumb(p).th}</div>}
            <div><b>{productTitle(p)}</b><span className="muted">{p.desc}</span></div>
          </div>
          <div className="field mt14">
            <label htmlFor="tg">{isGunghap ? '나' : '풀이 받을 사람'}</label>
            <select id="tg" className="input sel" value={target} onChange={(e) => setTarget(e.target.value)}>
              {profiles.map((x) => <option key={x.id} value={x.id}>{x.name} · {birthLabel(x)}</option>)}
            </select>
          </div>
          {isGunghap && (
            <div className="field">
              <label htmlFor="pt">상대</label>
              {profiles.filter((x) => x.id !== target).length ? (
                <select id="pt" className="input sel" value={partnerId} onChange={(e) => setPartner(e.target.value)}>
                  {profiles.filter((x) => x.id !== target).map((x) => <option key={x.id} value={x.id}>{x.name} · {birthLabel(x)}</option>)}
                </select>
              ) : (
                <Link to={`/profile/new?back=${back}`} className="btn line" style={{ marginTop: 0 }}>+ 상대 정보 추가하기</Link>
              )}
            </div>
          )}
          <dl className="summary mt14">
            <dt>금액</dt>
            <dd className="price-big">{won(price)}{premium && <del>{won(p.price)}</del>}{p.isSample && <small> 예시 가격</small>}</dd>
          </dl>
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
          <span>주문 내용을 확인했고, <Link to="/me#terms" className="u">이용약관</Link>·<Link to="/me#terms" className="u">개인정보 처리</Link>와 디지털 콘텐츠 특성상 풀이를 연 뒤에는 환불이 어려운 점에 동의해요.</span>
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <Button kind="gold" disabled={!agree || busy || (isGunghap && !partnerId)} onClick={submit}>
          {busy ? '결제 진행 중…' : `✦ ${won(price)} 결제하기`}
        </Button>
        <p className="note">지금은 시안이라 실제 돈이 나가지 않아요 (테스트 결제)</p>
      </main>
      {busy && <div className="sheet-bg center" style={{ alignItems: 'center' }}><div className="paying" role="status">결제를 확인하고 있어요…</div></div>}
    </>
  );
}

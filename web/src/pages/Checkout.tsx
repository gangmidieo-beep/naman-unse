// 결제 — 주문 요약 → (두 사람 상품은 상대 선택) → 결제수단(앱=Google Play, 웹=PayApp) → 약관 동의 → 결제. MOCK 이면 테스트 결제.
// 유료 결제 직전에 간편 로그인(Google·카카오·네이버)을 요구한다(화면설계_v2 10장).
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, ProductThumb, useToast } from '../components/ui';
import { LoginButtons } from './Login';
import { useApp, usePremium, useProfileLimit } from '../store/app';
import { CHAR, charOf, displayTitle, isTalisman, isTwoPerson, payPrice, productById, won } from '../lib/catalog';
import { getPayments, isNativeApp, phoneOk, savedPhone, savePhone, type PayResult } from '../platform/payments';
import { MOCK_MODE } from '../lib/api';
import { track } from '../lib/track';
import { birthLabel } from './ProfileNew';
import type { Profile } from '../store/app';

function PersonPicker({ label, hint, list, value, onPick, addTo, addLabel = '+ 새로운 사람 추가하기' }: { label: string; hint?: string; list: Profile[]; value: string; onPick: (id: string) => void; addTo: string; addLabel?: string }) {
  const { canAdd } = useProfileLimit(); // 일반 회원 저장 개수를 넘으면 프리미엄 안내
  return (
    <fieldset className="who-pick mt14">
      <legend>{label}{hint && <small>{hint}</small>}</legend>
      <div role="radiogroup" aria-label={label}>
        {list.map((x) => (
          <label key={x.id} className={x.id === value ? 'on' : ''}>
            <input type="radio" name={label} value={x.id} checked={x.id === value} onChange={() => onPick(x.id)} />
            <span className="nm">{x.name}{x.relation && <em>{x.relation}</em>}</span>
            <span className="bd">{birthLabel(x)}</span>
          </label>
        ))}
      </div>
      {canAdd ? <Link to={addTo} className="who-add">{addLabel}</Link> : <Link to="/premium" className="who-add">✦ 프리미엄으로 더 많은 사람 저장하기</Link>}
    </fieldset>
  );
}

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
  // 3차 요청: 풀이 받을 사람 선택 + 새 사람 추가 — 추가하고 돌아오면(?pick=me|partner) 방금 넣은 사람을 골라 둔다
  const pick = new URLSearchParams(loc.search).get('pick');
  const last = profiles[profiles.length - 1]?.id ?? '';
  const [target, setTarget] = useState(pick === 'me' && last ? last : mainId ?? profiles[0]?.id ?? '');
  const [partner, setPartner] = useState(pick === 'partner' ? last : '');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [phone, setPhone] = useState(savedPhone());
  useEffect(() => { if (p) track('checkout_open', { product: p.id }); }, [p]);
  // 결제창에서 '뒤로'로 돌아오면(아이폰은 이전 화면을 그대로 되살림) '결제를 확인하고 있어요'가 계속 떠 있던 문제
  useEffect(() => { const on = (e: PageTransitionEvent) => { if (e.persisted) setBusy(false); }; window.addEventListener('pageshow', on); return () => window.removeEventListener('pageshow', on); }, []);
  // 실결제 모드에서 간편 로그인 키가 하나도 없으면(대표님 등록 전) 로그인 없이 휴대폰 번호로 결제
  const [needLogin, setNeedLogin] = useState(MOCK_MODE);
  useEffect(() => {
    if (MOCK_MODE) return;
    fetch(`${__API_ORIGIN__}/auth/providers`).then((r) => r.json()).then((j) => setNeedLogin((j.providers ?? []).length > 0)).catch(() => setNeedLogin(false));
  }, []);
  if (!p) return <Navigate to="/unse" replace />;
  const price = payPrice(p, premium && (pay.memberPriceOk?.(p.id) ?? true)); // 앱에서 회원가 상품이 없으면 정가로 안내
  const two = isTwoPerson(p.id);
  const partnerId = partner && partner !== target ? partner : profiles.find((x) => x.id !== target)?.id ?? '';
  const back = encodeURIComponent(loc.pathname);
  const who = CHAR[charOf(p)];

  const submit = async () => {
    setErr('');
    setBusy(true);
    track('pay_start', { product: p.id, method, price });
    if (pay.needsPhone) savePhone(phone);
    const r = await pay.purchase(p.id, two ? `${target}+${partnerId}` : target, { method, amount: price, phone }).catch((): PayResult => ({ status: 'failed', orderId: '' }));
    if (r.status === 'redirect') return; // PayApp 결제창으로 이동 중
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

  if (!account && needLogin)
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
            <PersonPicker label={two ? '나' : '풀이 받을 사람'} hint={two ? undefined : '가족이나 지인의 사주도 볼 수 있어요'}
              list={profiles} value={target} onPick={setTarget} addTo={`/profile/new?back=${encodeURIComponent(`${loc.pathname}?pick=me`)}`} />
          )}
          {two && (
            <PersonPicker label="상대" list={profiles.filter((x) => x.id !== target)} value={partnerId} onPick={setPartner}
              addTo={`/profile/new?back=${encodeURIComponent(`${loc.pathname}?pick=partner`)}&rel=상대`} addLabel="+ 상대 정보 추가하기" />
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
          {pay.needsPhone && (
            <div className="field mt14">
              <label htmlFor="ph">결제 알림 받을 휴대폰 번호</label>
              <input id="ph" className="input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="010-1234-5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="muted">결제 확인 문자가 이 번호로 가요</p>
            </div>
          )}
        </section>

        <label className="check agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>주문 내용을 확인했고, <Link to="/box#terms" className="u">이용약관</Link>·<Link to="/box#terms" className="u">개인정보 처리</Link>와 디지털 콘텐츠 특성상 풀이를 연 뒤에는 환불이 어려운 점에 동의해요.</span>
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="pad mt14">
          <Button kind="gold" disabled={!agree || busy || (two && !partnerId) || (pay.needsPhone && !phoneOk(phone))} onClick={submit}>
            {busy ? '결제 진행 중…' : `✦ ${won(price)} 결제하고 ${isTalisman(p) ? '부적 받기' : `${who.book} 열어보기`}`}
          </Button>
          {MOCK_MODE && <p className="note">지금은 시안이라 실제 돈이 나가지 않아요 (테스트 결제)</p>}
        </div>
      </main>
      {busy && <div className="modal-bg"><div className="paying" role="status">결제를 확인하고 있어요…</div></div>}
    </>
  );
}

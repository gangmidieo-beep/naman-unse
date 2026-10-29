// PayApp 결제창에서 돌아오는 곳 — /pay/return?order=…  결제 통보가 몇 초 늦을 수 있어 2초 간격으로 최대 30초 확인
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { Button } from '../components/ui';
import { useApp } from '../store/app';
import { apiAuth, PENDING, syncEntitlements, type Pending } from '../platform/payments';
import { track } from '../lib/track';

type Order = { id: string; status: string; productId: string; profileId: string | null; kind: string; amount: number };

export default function PayReturn() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { addPurchase, setPlan, purchases } = useApp();
  const id = sp.get('order') ?? '';
  const [state, setState] = useState<'wait' | 'fail' | 'slow' | 'other'>('wait');
  const [tick, setTick] = useState(0); // [결제 다시 확인]
  const pending = (() => { try { return JSON.parse(localStorage.getItem(PENDING) || 'null') as Pending | null; } catch { return null; } })();
  // 다시 결제: 결제를 시작한 상품 화면으로(예전 '뒤로 2칸'은 결제사 화면이나 사이트 밖으로 나가기도 했다)
  const retryTo = pending ? (pending.kind === 'talisman' ? `/talisman/${pending.productId}` : pending.kind === 'subscription' ? '/premium' : `/product/${pending.productId}`) : '/';

  useEffect(() => {
    let stop = false;
    setState('wait');
    (async () => {
      let notMine = 0;
      for (let i = 0; i < 15 && !stop; i++) {
        const o = await apiAuth<Order>(`/orders/${encodeURIComponent(id)}`).catch((e: any) => { if (e?.status === 404) notMine++; return null; });
        // 이 브라우저에서 시작한 결제가 아니면(카카오톡 안에서 결제 → 다른 브라우저로 돌아옴) 주문을 볼 수 없다 → 안내
        if (!o && notMine >= 3 && !pending) { setState('other'); return; }
        if (o?.status === 'paid') {
          try { localStorage.removeItem(PENDING); } catch { /* */ }
          track('pay_success', { product: o.productId, orderId: o.id, price: o.amount });
          if (o.kind === 'subscription') {
            setPlan(o.productId.includes('yearly') ? 'yearly' : 'monthly', !o.productId.includes('yearly')); // 웹: 월=자동결제, 연=1년 이용권
            await syncEntitlements(); // 서버 기준 기간(연장분 포함)·자동결제 여부로 맞춤
            nav('/premium', { replace: true });
            return;
          }
          if (!purchases.some((x) => x.orderId === o.id)) {
            addPurchase({ orderId: o.id, productId: o.productId, profileId: o.profileId ?? pending?.profileId ?? '', price: o.amount, createdAt: new Date().toISOString(), kind: o.kind === 'talisman' ? 'talisman' : 'reading', status: 'paid' });
          }
          nav(o.kind === 'talisman' ? `/talisman/${o.productId}/make?order=${o.id}` : `/reading/${o.id}`, { replace: true });
          return;
        }
        if (o && ['failed', 'cancelled', 'refunded'].includes(o.status)) { track('pay_fail', { orderId: id, status: o.status }); setState('fail'); return; }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!stop) setState('slow');
    })();
    return () => { stop = true; };
  }, [id, tick]);

  return (
    <>
      <SubHeader title="결제 확인" back={false} />
      <main className="screen no-tab">
        {state === 'wait' && <div className="panel center mt24" role="status"><b>결제를 확인하고 있어요…</b><p className="muted">잠시만 기다려 주세요. 창을 닫지 마세요.</p></div>}
        {state === 'fail' && (
          <div className="panel center mt24" role="alert">
            <b>결제가 완료되지 않았어요</b>
            <p className="muted">결제창을 닫았거나 승인이 되지 않았어요. 돈은 빠져나가지 않았어요.</p>
            <div className="pad mt14"><Button kind="gold" onClick={() => nav(retryTo, { replace: true })}>다시 시도하기</Button></div>
          </div>
        )}
        {state === 'slow' && (
          <div className="panel center mt24">
            <b>결제 확인이 늦어지고 있어요</b>
            <p className="muted">결제가 되었다면 몇 분 안에 <b>나의 운세함</b>에 들어와요. 문자로 결제 완료를 받으셨는데 계속 보이지 않으면 문의해 주세요. (주문번호 {id})</p>
            <div className="pad mt14"><Button kind="gold" onClick={() => setTick((n) => n + 1)}>결제 다시 확인</Button></div>
            <div className="pad mt14"><Button kind="line" to="/box">나의 운세함으로</Button></div>
          </div>
        )}
        {state === 'other' && (
          <div className="panel center mt24">
            <b>결제를 시작한 화면에서 확인해 주세요</b>
            <p className="muted">결제는 다른 화면(예: 카카오톡 안의 브라우저)에서 시작되었어요. 그 화면으로 돌아가 <b>나의 운세함</b>을 열면 풀이가 보여요. 로그인하고 결제하셨다면 이 화면에서도 같은 계정으로 로그인하면 보여요. (주문번호 {id})</p>
            <div className="pad mt14"><Button kind="gold" to={`/login?back=${encodeURIComponent('/box')}`}>로그인하기</Button></div>
            <div className="pad mt14"><Button kind="line" to="/box">나의 운세함으로</Button></div>
          </div>
        )}
      </main>
    </>
  );
}

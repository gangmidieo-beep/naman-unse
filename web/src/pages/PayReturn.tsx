// PayApp 결제창에서 돌아오는 곳 — /pay/return?order=…  결제 통보가 몇 초 늦을 수 있어 2초 간격으로 최대 30초 확인
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { Button } from '../components/ui';
import { useApp } from '../store/app';
import { apiAuth, PENDING, type Pending } from '../platform/payments';
import { track } from '../lib/track';

type Order = { id: string; status: string; productId: string; profileId: string | null; kind: string; amount: number };

export default function PayReturn() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { addPurchase, setPlan, purchases } = useApp();
  const id = sp.get('order') ?? '';
  const [state, setState] = useState<'wait' | 'fail' | 'slow'>('wait');

  useEffect(() => {
    let stop = false;
    const pending = (() => { try { return JSON.parse(localStorage.getItem(PENDING) || 'null') as Pending | null; } catch { return null; } })();
    (async () => {
      for (let i = 0; i < 15 && !stop; i++) {
        const o = await apiAuth<Order>(`/orders/${encodeURIComponent(id)}`).catch(() => null);
        if (o?.status === 'paid') {
          try { localStorage.removeItem(PENDING); } catch { /* */ }
          track('pay_success', { product: o.productId, orderId: o.id, price: o.amount });
          if (o.kind === 'subscription') {
            setPlan(o.productId.includes('yearly') ? 'yearly' : 'monthly');
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
  }, [id]);

  return (
    <>
      <SubHeader title="결제 확인" back={false} />
      <main className="screen no-tab">
        {state === 'wait' && <div className="panel center mt24" role="status"><b>결제를 확인하고 있어요…</b><p className="muted">잠시만 기다려 주세요. 창을 닫지 마세요.</p></div>}
        {state === 'fail' && (
          <div className="panel center mt24" role="alert">
            <b>결제가 완료되지 않았어요</b>
            <p className="muted">결제창을 닫았거나 승인이 되지 않았어요. 돈은 빠져나가지 않았어요.</p>
            <div className="pad mt14"><Button kind="gold" onClick={() => nav(-2)}>다시 시도하기</Button></div>
          </div>
        )}
        {state === 'slow' && (
          <div className="panel center mt24">
            <b>결제 확인이 늦어지고 있어요</b>
            <p className="muted">결제가 되었다면 몇 분 안에 <b>나의 운세함</b>에 들어와요. 문자로 결제 완료를 받으셨는데 계속 보이지 않으면 문의해 주세요. (주문번호 {id})</p>
            <div className="pad mt14"><Button kind="gold" to="/box">나의 운세함으로</Button></div>
          </div>
        )}
      </main>
    </>
  );
}

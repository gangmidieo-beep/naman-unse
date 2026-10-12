// 프리미엄 멤버십 — 홈 안내 버튼 + 혜택·요금제 팝업(대표님 시안 2026-10-12). 결제 흐름은 useSubscribe 하나로 팝업·/premium 이 같이 쓴다.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp, usePremium, type Plan } from '../store/app';
import { BRAND, won } from '../lib/catalog';
import { getPayments, isNativeApp, phoneOk, savedPhone, savePhone } from '../platform/payments';
import { track } from '../lib/track';
import { useToast } from './ui';
import { v4 } from '../assets/images';

export type PlanId = Exclude<Plan, null>;
const SUB = BRAND.subscription as typeof BRAND.subscription & { yearly: { listPrice?: number } };
export const YEAR_LIST = SUB.yearly.listPrice ?? SUB.monthly.price * 12; // 6,900 × 12 = 82,800
export const YEAR_RATE = Math.round((1 - SUB.yearly.price / YEAR_LIST) * 100); // 29
export const perMonth = (y: number) => Math.round(y / 12);
// 자동결제 여부 — 앱(Google Play)은 월·연 모두 자동 갱신. 웹(PayApp)은 월 = 매월 자동결제(정기결제), 연 = 1년 이용권
// (PayApp 정기결제는 월·주·일 주기만 있어 연 단위 자동결제가 없음 → 만료 7일·1일 전 알림 + 화면 연장 안내)
export const autoRenewOf = (plan: PlanId) => plan === 'monthly' || isNativeApp() || getPayments().id === 'mock';

export const FEATURES = [
  { img: 'premium_f1', t: '오늘의 타로', s: '상세 해석', d: '지금 필요한 조언과 메시지를 담은 타로 카드 해석을 더 깊이 있게 만나보세요.' },
  { img: 'premium_f2', t: '꿈 해몽', s: '상세 해석', d: '꿈에 담긴 메시지를 상황별로 자세히 풀어 당신에게 맞는 해석을 드립니다.' },
  { img: 'premium_f3', t: '주간운세', s: '상세 운세', d: '매주 새로 열리는 한 주의 흐름과 중요한 조언을 확인하고 준비하세요.' },
  { img: 'premium_f4', t: '월간운세', s: '상세 운세', d: '매달 새로 열리는 한 달의 운세와 방향으로 더 나은 계획을 세울 수 있어요.' },
];
export const BENEFITS = [
  { img: 'premium_b1', t: <>모든 유료 콘텐츠 <em>10% 할인</em></>, d: '사주·궁합·타로·부적 등 모든 유료 상품을 회원가로 이용할 수 있어요.' },
  { img: 'premium_b2', t: <>사주 저장 <em>무제한</em></>, d: '가족·지인의 사주 정보를 제한 없이 저장하고 다시 볼 수 있어요.' },
  { img: 'premium_b3', t: <>운세함 저장 <em>무제한</em></>, d: '구매한 운세 결과지를 제한 없이 보관하고 언제든 다시 열어볼 수 있어요.' },
  { img: 'premium_b4', t: <>광고 없이 더 쾌적하게</>, d: '광고 없이 더 집중해서 운세를 즐길 수 있어요.' },
];

export function useSubscribe() {
  const setPlan = useApp((s) => s.setPlan);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState(savedPhone());
  const pay = getPayments();
  const subscribe = async (pick: PlanId) => {
    const cur = pick === 'monthly' ? SUB.monthly : SUB.yearly;
    setBusy(true);
    track('pay_start', { product: cur.id });
    if (pay.needsPhone) savePhone(phone);
    const r = await pay.subscribe(cur.id, { phone });
    if (r.status === 'redirect') return true; // PayApp 결제창으로 이동 중
    setBusy(false);
    if (r.status === 'paid') { setPlan(pick, autoRenewOf(pick)); track('pay_success', { product: cur.id, price: cur.price }); toast('프리미엄 회원이 되셨어요 ✦'); return true; }
    if (r.status === 'failed') { track('pay_fail', { product: cur.id, message: r.message }); toast(r.message ?? '결제에 실패했어요'); }
    else { track('pay_cancel', { product: cur.id }); toast('구독을 취소했어요'); }
    return false;
  };
  return { subscribe, busy, phone, setPhone, needsPhone: pay.needsPhone, phoneReady: !pay.needsPhone || phoneOk(phone) };
}

export function PlanPicker({ pick, setPick, only }: { pick: PlanId; setPick: (p: PlanId) => void; only?: PlanId }) {
  return (
    <div className="pplans" role="radiogroup" aria-label="요금제">
      {only !== 'yearly' && <button role="radio" aria-checked={pick === 'monthly'} className={`pplan${pick === 'monthly' ? ' on' : ''}`} onClick={() => setPick('monthly')}>
        <i aria-hidden />
        <b>월간 구독</b>
        <span className="pr"><strong>{won(SUB.monthly.price)}</strong><small>매월 자동결제 · 언제든 해지</small></span>
      </button>}
      {only !== 'monthly' && <button role="radio" aria-checked={pick === 'yearly'} className={`pplan${pick === 'yearly' ? ' on' : ''}`} onClick={() => setPick('yearly')}>
        <i aria-hidden />
        <b>연간 구독</b>
        <span className="pr"><s>{won(YEAR_LIST)}</s><strong>{won(SUB.yearly.price)}</strong><small>{autoRenewOf('yearly') && only !== 'yearly' ? '매년 자동결제' : '1년 이용권'} · 월 {won(perMonth(SUB.yearly.price))}</small></span>
        <em className="off">약 {YEAR_RATE}% 할인</em>
      </button>}
    </div>
  );
}

export function PremiumPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pick, setPick] = useState<PlanId>('monthly');
  const s = useSubscribe();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    track('page_view', { path: '#premium-popup' });
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    box.current?.focus();
    const y = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', k); document.body.style.overflow = y; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ppop-bg" onClick={onClose}>
      <div className="ppop" role="dialog" aria-modal="true" aria-label="나만의 운세 프리미엄" tabIndex={-1} ref={box} onClick={(e) => e.stopPropagation()}>
        <div className="ph">
          <img src={v4('premium_head')} alt="나만의 운세 PREMIUM — 더 깊고 특별한 운세를 매일 만나보세요." />
          <button className="x" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="pf4">
          {FEATURES.map((f) => <div key={f.t} className="pf"><img src={v4(f.img)} alt="" /><b>{f.t}</b><span>{f.s}</span></div>)}
        </div>
        <ul className="pb4">
          {BENEFITS.map((b, i) => <li key={i}><img src={v4(b.img)} alt="" /><span>{b.t}</span><i aria-hidden>✓</i></li>)}
        </ul>
        <PlanPicker pick={pick} setPick={setPick} />
        {s.needsPhone && (
          <div className="field pphone">
            <label htmlFor="pph">결제 알림 받을 휴대폰 번호</label>
            <input id="pph" className="input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="010-1234-5678" value={s.phone} onChange={(e) => s.setPhone(e.target.value)} />
          </div>
        )}
        <button className="pstart" disabled={s.busy || !s.phoneReady} onClick={async () => { if (await s.subscribe(pick)) onClose(); }}>
          {s.busy ? '진행 중…' : '프리미엄 시작하기 ›'}
        </button>
        <Link to="/premium" className="pmore" onClick={onClose}>상세 혜택 보기 ›</Link>
        <p className="plegal"><Link to="/terms" onClick={onClose}>이용약관</Link><span>|</span><Link to="/privacy" onClick={onClose}>개인정보처리방침</Link><span>|</span><Link to="/premium#cancel" onClick={onClose}>구독·해지 안내</Link></p>
      </div>
    </div>
  );
}

// 홈 안내 버튼 — 누르면 팝업
export function PremiumButton() {
  const [open, setOpen] = useState(false);
  const premium = usePremium();
  if (premium) return null;
  return (
    <>
      <button className="pbtn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="pc">PREMIUM</span>
        <span className="pt"><b>프리미엄 멤버십</b><small>광고 없이 · 주간·월간 운세 · 전 상품 10% 할인</small></span>
        <span className="pp">월 {won(SUB.monthly.price)} ›</span>
      </button>
      <PremiumPopup open={open} onClose={() => setOpen(false)} />
    </>
  );
}

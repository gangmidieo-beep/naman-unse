// 프리미엄 — 화면설계_v2 8장 비교표 + 월 9,900 / 연 79,000(33.5% 할인) 선택 + 해지 안내 + 구매 복원
import { useState } from 'react';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, useToast } from '../components/ui';
import { Img } from '../components/Img';
import { optionalImg } from '../assets/images';
import { useApp, usePremium, type Plan } from '../store/app';
import { BRAND, won } from '../lib/catalog';
import { getPayments, isNativeApp, phoneOk, savedPhone, savePhone } from '../platform/payments';
import { track } from '../lib/track';

const ROWS: [string, string, string][] = [
  ['오늘의 운세', '기본', '+ 주간 + 월간'],
  ['띠별·별자리·혈액형', '✓', '✓'],
  ['오늘의 타로', '1장 기본', '상세 해석 추가 카드'],
  ['오늘의 행운', '✓', '✓'],
  ['꿈 해몽', '기본 검색', '상세 해몽'],
  ['천궁도사 유료운세', '정상가', '회원가 10% 할인'],
  ['월하선녀 유료운세', '정상가', '회원가 10% 할인'],
  ['나만의 부적', '정상가', '회원가 10% 할인'],
  ['저장 가능 사주', `${BRAND.profileLimit.free}개`, '무제한'],
  ['광고', '있음', '제거'],
  ['운세 보관', '✓', '✓'],
];
const BENEFITS = ['프리미엄 오늘의 운세 — 주간·월간 운세', '프리미엄 타로 · 상세 꿈 해몽', '모든 광고 제거', '운명서·인연서 회원 특별가 (10% 할인)', '소원부적 회원 특별가 (10% 할인)', '사주 결과 무제한 저장'];

export default function Premium() {
  const { plan, planUntil, setPlan } = useApp();
  const premium = usePremium();
  const toast = useToast();
  const [pick, setPick] = useState<Exclude<Plan, null>>('yearly');
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState(savedPhone());
  const pay = getPayments();
  const sub = BRAND.subscription;
  const cur = pick === 'monthly' ? sub.monthly : sub.yearly;
  const subscribe = async () => {
    setBusy(true);
    track('pay_start', { product: cur.id });
    if (pay.needsPhone) savePhone(phone);
    const r = await pay.subscribe(cur.id, { phone });
    if (r.status === 'redirect') return; // PayApp 결제창으로 이동 중
    setBusy(false);
    if (r.status === 'paid') { setPlan(pick); track('pay_success', { product: cur.id, price: cur.price }); toast('프리미엄 회원이 되셨어요 ✦'); }
    else if (r.status === 'failed') { track('pay_fail', { product: cur.id, message: r.message }); toast(r.message ?? '결제에 실패했어요'); }
    else { track('pay_cancel', { product: cur.id }); toast('구독을 취소했어요'); }
  };
  const restore = async () => {
    const owned = await getPayments().restore();
    toast(owned.length ? '구매 내역을 되살렸어요' : '되살릴 구매 내역이 없어요');
  };
  const hero = optionalImg('banner_premium');
  return (
    <>
      <SubHeader title="프리미엄" sub="나만의 운세 프리미엄 혜택" />
      <main className="screen no-tab">
        <div className="duo mt14">
          <div className="duo-in">
            {hero ? <img src={hero.src} alt="천궁도사와 월하선녀" style={{ gridColumn: '1 / -1' }} /> : (<><Img k="cheongungCard" eager alt="천궁도사" /><Img k="wolhaCard" eager alt="월하선녀" /></>)}
            <div className="shade" />
            <div className="txt"><span className="pb" style={{ position: 'static' }}>✦ PREMIUM</span><b>도사와 선녀가<br />매일 곁에서 챙겨드려요</b></div>
          </div>
        </div>
        <CharacterBubble who="wolha">광고 없이, 주간·월간 운세와 상세 풀이까지 모두 열어 드려요.</CharacterBubble>
        <table className="compare">
          <thead><tr><th>기능</th><th>일반</th><th className="gold">프리미엄</th></tr></thead>
          <tbody>{ROWS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td className="gold">{c}</td></tr>)}</tbody>
        </table>
        <ul className="benefits">{BENEFITS.map((b) => <li key={b}>{b}</li>)}</ul>
        {premium ? (
          <>
            <div className="panel center mt14"><b className="gold-text" style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 21 }}>✦ 프리미엄({plan === 'yearly' ? '연간' : '월간'}) 이용 중</b><p className="muted">{planUntil}까지 · 모든 혜택이 열려 있어요</p></div>
            {import.meta.env.DEV && <div className="pad"><Button kind="line" onClick={() => setPlan(null)}>(시안용) 일반 회원으로 되돌리기</Button></div>}
          </>
        ) : (
          <>
            <div className="plans" role="radiogroup" aria-label="요금제">
              <button role="radio" aria-checked={pick === 'monthly'} className={`plan${pick === 'monthly' ? ' on' : ''}`} onClick={() => setPick('monthly')}>
                <b>월간</b><div className="p">{won(sub.monthly.price)}<small> /월</small></div>
              </button>
              <button role="radio" aria-checked={pick === 'yearly'} className={`plan${pick === 'yearly' ? ' on' : ''}`} onClick={() => setPick('yearly')}>
                <span className="tag">{sub.yearly.note}</span>
                <b>연간</b><div className="p">{won(sub.yearly.price)}<small> /년</small></div>
              </button>
            </div>
            {pay.needsPhone && (
              <div className="field pad mt14">
                <label htmlFor="ph">결제 알림 받을 휴대폰 번호</label>
                <input id="ph" className="input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="010-1234-5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            )}
            <div className="pad mt14"><Button kind="gold" disabled={busy || (pay.needsPhone && !phoneOk(phone))} onClick={subscribe}>{busy ? '진행 중…' : `✦ ${pick === 'monthly' ? '월' : '연'} ${won(cur.price)}로 시작하기`}</Button></div>
          </>
        )}
        {isNativeApp() || pay.id === 'mock'
          ? <p className="note pad">언제든 구글 플레이에서 해지할 수 있어요. 해지해도 남은 기간까지는 계속 이용할 수 있어요.</p>
          : <p className="note pad">웹에서는 <b>{pick === 'monthly' ? '30일' : '1년'} 이용권</b>으로 결제돼요. 자동으로 다시 결제되지 않고, 기간이 끝나면 다시 구매하시면 돼요. 남은 기간에 이어서 늘어나요.</p>}
        <div className="center"><button className="textlink" onClick={restore}>구매 복원</button></div>
      </main>
    </>
  );
}

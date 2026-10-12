// 프리미엄 상세 — 대표님 시안(2026-10-12): 전용 콘텐츠 4 → 추가 특별 혜택 4 → 요금제(월 6,900 / 연 59,000) → 일반·프리미엄 비교표 → 구독·해지 안내 → 구매 복원
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { Button, useToast } from '../components/ui';
import { BENEFITS, FEATURES, PlanPicker, useSubscribe, type PlanId } from '../components/PremiumPopup';
import { useApp, usePremium } from '../store/app';
import { BRAND, won } from '../lib/catalog';
import { cancelAutoRenew, getPayments, isNativeApp } from '../platform/payments';
import { v4 } from '../assets/images';

// 대표님 표(2026-10-12) 그대로
const ROWS: [string, string, string][] = [
  ['오늘의 운세', '기본', '오늘의 운세 + 주간운세 + 월간운세\n(주간 매주 1회 · 월간 매월 1회 생성, 자유 열람)'],
  ['띠별·별자리·혈액형', '✓', '✓'],
  ['오늘의 타로', '1장 기본', '상세 해석 (하루 1회)'],
  ['오늘의 행운', '✓', '✓'],
  ['꿈 해몽', '기본 검색', '상세 꿈 해몽 (하루 1회)'],
  ['운세 상품', '정상가', '회원 할인가 (10%)'],
  ['타로 상품', '정상가', '회원 할인가 (10%)'],
  ['나만의 부적', '정상가', '회원 할인가 (10%)'],
  ['저장 가능 사주', `${BRAND.profileLimit.free}개`, '무제한'],
  ['광고', '있음', '제거'],
  ['운세 보관', '✓', '✓'],
];

export default function Premium() {
  const { plan, planUntil, planAuto, setPlan } = useApp();
  const native = isNativeApp();
  const [ask, setAsk] = useState(false); // 해지 확인 단계
  const [stopping, setStopping] = useState(false);
  const stop = async () => {
    setStopping(true);
    const r = await cancelAutoRenew();
    setStopping(false); setAsk(false);
    toast(r.ok ? `자동결제를 해지했어요. ${useApp.getState().planUntil ?? ''}까지는 프리미엄 혜택을 그대로 이용하실 수 있어요.` : r.message ?? '잠시 후 다시 시도해 주세요');
  };
  const premium = usePremium();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [pick, setPick] = useState<PlanId>(sp.get('plan') === 'yearly' ? 'yearly' : 'monthly');
  const s = useSubscribe();
  const restore = async () => {
    const owned = await getPayments().restore();
    toast(owned.length ? '구매 내역을 되살렸어요' : '되살릴 구매 내역이 없어요');
  };
  return (
    <>
      <SubHeader title="프리미엄" sub="나만의 운세 프리미엄 혜택" />
      <main className="screen no-tab prem4">
        <div className="phero">
          <img src={v4('premium_head_page')} alt="나만의 운세 PREMIUM — 더 깊고 특별한 운세를 경험하세요." />
          <p>프리미엄 회원만을 위한 다양한 운세 콘텐츠로<br />일상의 중요한 순간을 더욱 풍성하게 만들어 드립니다.</p>
        </div>

        <h2 className="pband">프리미엄 전용 운세 콘텐츠</h2>
        <div className="pf4 big">
          {FEATURES.map((f) => <div key={f.t} className="pf"><img src={v4(f.img)} alt="" /><b>{f.t}</b><span>{f.s}</span><p>{f.d}</p></div>)}
        </div>

        <h2 className="pband">추가 특별 혜택</h2>
        <div className="pb4g">
          {BENEFITS.map((b, i) => <div key={i} className="pbg"><img src={v4(b.img)} alt="" /><b>{b.t}</b><p>{b.d}</p></div>)}
        </div>

        {premium ? (
          <>
            <div className="panel center mt14 psub">
              <b className="gold-text" style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 21 }}>✦ 프리미엄({plan === 'yearly' ? '연간' : '월간'}) 이용 중</b>
              {planAuto ? (
                <>
                  <p className="muted">{native ? 'Google Play 에서 자동으로 갱신돼요' : plan === 'yearly' ? `매년 자동결제 · ${won(BRAND.subscription.yearly.price)}` : `매월 자동결제 · ${won(BRAND.subscription.monthly.price)}`} · 현재 기간 {planUntil}까지</p>
                  {native ? <p className="muted small">해지: Google Play › 결제 및 구독 › 나만의 운세</p> : !ask ? (
                    <button className="textlink" onClick={() => setAsk(true)}>자동결제 해지</button>
                  ) : (
                    <div className="pask">
                      <p>해지하시면 다음 달부터 결제되지 않아요.<br /><b>{planUntil}까지</b>는 혜택을 그대로 이용하실 수 있어요.</p>
                      <div className="row2"><Button kind="line" onClick={() => setAsk(false)}>계속 이용하기</Button><Button disabled={stopping} onClick={stop}>{stopping ? '해지 중…' : '자동결제 해지'}</Button></div>
                    </div>
                  )}
                </>
              ) : (
                <p className="muted"><b>{planUntil}</b>까지 이용 · 자동결제 아님<br />기간이 끝나면 일반 회원으로 돌아가요</p>
              )}
              {import.meta.env.DEV && <div className="pad mt14"><Button kind="line" onClick={() => setPlan(null)}>(시안용) 일반 회원으로 되돌리기</Button></div>}
            </div>
            {!planAuto && !native && (
              <>
                <h2 className="pband">기간 연장하기</h2>
                <p className="center muted small">연간 이용권으로 연장하면 남은 기간 뒤에 1년이 이어서 늘어나요.<br />월 자동결제는 지금 기간이 끝난 뒤 다시 시작할 수 있어요.</p>
                <div className="pad"><PlanPicker pick="yearly" setPick={() => {}} only="yearly" /></div>
                {s.needsPhone && (
                  <div className="field pad mt14">
                    <label htmlFor="ph2">결제 알림 받을 휴대폰 번호</label>
                    <input id="ph2" className="input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="010-1234-5678" value={s.phone} onChange={(e) => s.setPhone(e.target.value)} />
                  </div>
                )}
                <div className="pad"><button className="pstart" disabled={s.busy || !s.phoneReady} onClick={() => s.subscribe('yearly')}>{s.busy ? '진행 중…' : `연간 이용권으로 연장 · ${won(BRAND.subscription.yearly.price)} ›`}</button></div>
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="pband">프리미엄 요금제</h2>
            <div className="pad"><PlanPicker pick={pick} setPick={setPick} /></div>
            {s.needsPhone && (
              <div className="field pad mt14">
                <label htmlFor="ph">결제 알림 받을 휴대폰 번호</label>
                <input id="ph" className="input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="010-1234-5678" value={s.phone} onChange={(e) => s.setPhone(e.target.value)} />
              </div>
            )}
            <div className="pad"><button className="pstart" disabled={s.busy || !s.phoneReady} onClick={() => s.subscribe(pick)}>{s.busy ? '진행 중…' : `프리미엄 시작하기 · ${won(pick === 'monthly' ? BRAND.subscription.monthly.price : BRAND.subscription.yearly.price)} ›`}</button></div>
          </>
        )}

        <h2 className="pband">일반 / 프리미엄 비교</h2>
        <table className="compare">
          <thead><tr><th>기능</th><th>일반회원</th><th className="gold">프리미엄 회원</th></tr></thead>
          <tbody>{ROWS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td className="gold" style={{ whiteSpace: 'pre-line' }}>{c}</td></tr>)}</tbody>
        </table>

        <section className="pcancel" id="cancel">
          <h3>구독·해지 안내</h3>
          {native ? (
            <ul>
              <li>앱에서는 Google Play 정기 결제로 {pick === 'monthly' ? '매월' : '매년'} 자동으로 결제돼요.</li>
              <li>언제든 Google Play › 결제 및 구독에서 해지할 수 있어요.</li>
              <li>해지해도 남은 기간까지는 모든 혜택을 그대로 이용할 수 있어요.</li>
            </ul>
          ) : (
            <ul>
              <li><b>월간 구독</b>은 처음 결제한 날짜에 매월 {won(BRAND.subscription.monthly.price)}이 같은 카드로 자동결제돼요. (29~31일에 가입하시면 매월 말일)</li>
              <li>이 화면(운세함 › 구독)에서 언제든 <b>자동결제 해지</b>를 누르면 다음 달부터 결제되지 않아요. 이미 결제한 기간까지는 혜택이 그대로 유지돼요.</li>
              <li><b>연간 구독</b>은 1년 이용권으로 한 번 결제돼요. 자동으로 다시 결제되지 않고, 끝나기 7일 전·1일 전에 알려 드려요. 연장하면 남은 기간 뒤에 이어서 늘어나요.</li>
              <li>카드 정보는 결제대행사(PayApp) 결제창에서만 입력되며, 나만의 운세는 카드 번호를 받거나 저장하지 않아요.</li>
            </ul>
          )}
        </section>
        <div className="center"><button className="textlink" onClick={restore}>구매 복원</button></div>
      </main>
    </>
  );
}

// S9 프리미엄 — 혜택 비교표(docs/화면설계.md 3장) + 월 구독(금색) + 해지 안내 + 구매 복원.
import { useState } from 'react';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, useToast } from '../components/ui';
import { Img } from '../components/Img';
import { useApp } from '../store/app';
import { BRAND, won } from '../lib/brand';
import { getPayments, isNativeApp } from '../platform/payments';
import { track } from '../lib/track';

const ROWS: [string, string, string][] = [
  ['오늘의 운세 총운·점수·한 줄', '✓', '✓'],
  ['분야 4개 요약', '✓', '✓'],
  ['분야별 심화 풀이 + 오늘의 조언 3개', '첫 문단만', '✓ 전체'],
  ['이번 주 운세', '✓', '✓'],
  ['이번 달 운세', '🔒', '✓'],
  ['띠별 운세', '✓', '✓'],
  ['MBTI 기본 풀이', '✓', '✓'],
  ['MBTI × 사주 연결 풀이', '🔒', '✓'],
  ['광고', '있음', '없음'],
  ['정통사주·궁합·신년운세', '정가', `${Math.round(BRAND.subscription.discountRate * 100)}% 할인`],
];

export default function Premium() {
  const { premium, setPremium } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const sub = BRAND.subscription;
  const subscribe = async () => {
    setBusy(true);
    track('pay_start', { product: sub.id });
    const r = await getPayments().subscribe(sub.id);
    setBusy(false);
    if (r.status === 'paid') {
      setPremium(true);
      track('pay_success', { product: sub.id });
      toast('프리미엄 회원이 되셨어요 ✦');
    } else {
      track('pay_cancel', { product: sub.id });
      toast('구독을 취소했어요');
    }
  };
  const restore = async () => {
    const owned = await getPayments().restore();
    toast(owned.length ? '구매 내역을 되살렸어요' : '되살릴 구매 내역이 없어요');
  };
  return (
    <>
      <SubHeader title="프리미엄" />
      <main className="screen">
        <div className="duo">
          <div className="duo-in">
            <Img k="dosaCard" eager alt="천궁도령" />
            <Img k="sunnyeoCard" eager alt="월하선녀" />
            <div className="shade" />
            <div className="txt">
              <span className="badge-p" style={{ position: 'static' }}>✦ 프리미엄</span>
              <b>도령과 선녀가<br />매일 곁에서 챙겨드려요</b>
            </div>
          </div>
        </div>
        <CharacterBubble who="sunnyeo">광고 없이, 이번 달 흐름과 분야별 깊은 풀이까지 모두 열어 드려요.</CharacterBubble>
        <table className="compare">
          <thead><tr><th>혜택</th><th>무료</th><th className="gold">프리미엄</th></tr></thead>
          <tbody>{ROWS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td className="gold">{c}</td></tr>)}</tbody>
        </table>
        {premium ? (
          <>
            <div className="panel center mt14"><b className="big-b">✦ 프리미엄 회원이에요</b><p className="muted">모든 혜택이 열려 있어요.</p></div>
            {import.meta.env.DEV && <Button kind="line" onClick={() => setPremium(false)}>(시안용) 무료 회원으로 되돌리기</Button>}
          </>
        ) : (
          <Button kind="gold" disabled={busy} onClick={subscribe}>{busy ? '진행 중…' : `✦ 월 ${won(sub.price)}로 시작하기`}</Button>
        )}
        {sub.isSample && <p className="note">예시 가격이에요 · 가격은 확정 후 바뀔 수 있어요</p>}
        <p className="note">언제든 구글 플레이에서 해지할 수 있어요.{!isNativeApp() && ' 웹 결제는 내 정보에서 해지해요.'} 해지해도 남은 기간까지는 계속 이용할 수 있어요.</p>
        <div className="center"><button className="textlink" onClick={restore}>구매 복원</button></div>
      </main>
    </>
  );
}

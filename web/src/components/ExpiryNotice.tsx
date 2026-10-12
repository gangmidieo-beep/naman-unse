// 이용권 만료 안내 — 자동결제가 아닌 프리미엄(웹 연간 이용권·자동결제를 해지한 월 구독)이 7일 이내로 남으면 홈·운세함에 띄운다.
// 웹은 앱 푸시를 못 받으니 화면이 알림 역할을 한다. 앱은 서버가 7일·1일 전 오전 10시에 푸시도 보낸다.
import { Link } from 'react-router-dom';
import { useApp, usePremium } from '../store/app';

export function daysLeft(until: string | null, now = new Date()): number | null {
  if (!until) return null;
  const today = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  return Math.round((Date.parse(`${until}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function ExpiryNotice() {
  const premium = usePremium();
  const { planUntil, planAuto } = useApp();
  const left = daysLeft(planUntil);
  if (!premium || planAuto || left === null || left > 7 || left < 0) return null;
  return (
    <Link className="xnote" to="/premium">
      <span>✦ 프리미엄 이용 기간이 <b>{left === 0 ? '오늘까지' : `${left}일 남았어요`}</b><br /><small className="small">연장하면 남은 기간 뒤에 이어서 늘어나요</small></span>
      <em>연장하기 ›</em>
    </Link>
  );
}

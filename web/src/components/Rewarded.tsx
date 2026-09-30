// 보상형 전면 광고 — 웹/MOCK 은 3초 모달, 앱은 10 단계에서 AdMob 보상형으로 교체.
// 규칙(brand.config ads.rewardedResult): 프리미엄은 광고 없음, 하루 최대 횟수·최소 간격을 넘으면 광고 없이 바로 연다.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import brand from '../../../brand.config.json';
import { useApp, usePremium } from '../store/app';
import { track } from '../lib/track';

const cfg = brand.ads.rewardedResult;
export function useRewarded() {
  const premium = usePremium();
  const { adViews, noteAdView } = useApp();
  const [pending, setPending] = useState<null | (() => void)>(null);
  const run = useCallback(
    (onGranted: () => void, where: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const count = adViews.date === today ? adViews.count : 0;
      const tooSoon = Date.now() - adViews.last < cfg.minIntervalSec * 1000;
      if (premium || !cfg.enabled || count >= cfg.maxPerDay || tooSoon) return onGranted();
      track('page_view', { ad: 'rewarded', where });
      setPending(() => onGranted);
    },
    [premium, adViews],
  );
  const modal: ReactNode = pending ? (
    <RewardedModal
      onDone={() => { noteAdView(); const f = pending; setPending(null); f(); }}
      onClose={() => setPending(null)}
    />
  ) : null;
  return { run, modal };
}

function RewardedModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [left, setLeft] = useState(3);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label="광고">
      <div className="modal"><div className="in">
        <b>잠시 광고를 보고 풀이를 열어요</b>
        <div className="adbox">광고 영역 (AdMob 보상형 전면)</div>
        {left > 0 ? <div className="count" aria-live="polite">{left}</div> : <button className="btn gold" onClick={onDone}>풀이 열기</button>}
        <button className="textlink" style={{ color: 'var(--on-ink-2)' }} onClick={onClose}>닫기</button>
        <p className="note" style={{ color: 'var(--on-ink-2)' }}>프리미엄 회원은 광고 없이 바로 볼 수 있어요</p>
      </div></div>
    </div>
  );
}

// 보상형 전면 광고 게이트 — 2026-10-21 대표님 요청: 실제 광고 플랫폼(앱 AdMob · 웹 Google Ad Manager) 연동 구조.
// 광고를 끝까지 봐서 플랫폼이 '보상' 신호를 보낼 때만 무료 상세 풀이가 열린다. 재생 시간은 플랫폼의 광고 길이 그대로.
// 규칙(brand.config ads.rewardedResult): 프리미엄은 광고 없음, 하루 최대 횟수·최소 간격을 넘으면 광고 없이 바로 연다.
// 광고를 못 불러오면(연동 전·광고 없음·네트워크) whenUnavailable: "open"(기본, 바로 열어 줌) | "block"(다시 시도 안내)
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import brand from '../../../brand.config.json';
import { useApp, usePremium } from '../store/app';
import { track } from '../lib/track';
import { MOCK_AD_SECONDS, rewardProvider, showRewarded, type RewardResult } from '../platform/ads';
import { adSlots } from '../lib/ads';

type Cfg = { enabled: boolean; maxPerDay: number; minIntervalSec: number; whenUnavailable?: 'open' | 'block' };
const base = brand.ads.rewardedResult as Cfg;
// 관리자 › 광고 관리의 '결과 보상형 전면' ON/OFF·하루 최대 횟수·최소 간격이 우선(예전엔 저장만 되고 화면은 brand.config 값을 썼다)
let live: Cfg = base;
void adSlots().then((m) => { const r = (m as any).rewarded; if (r) live = { ...base, ...(r.config ?? {}), enabled: !!r.enabled }; });
export function useRewarded() {
  const premium = usePremium();
  const { adViews, noteAdView } = useApp();
  const [pending, setPending] = useState<null | { grant: () => void; where: string }>(null);
  const run = useCallback(
    (onGranted: () => void, where: string) => {
      const cfg = live;
      const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // 한국 날짜(가게의 '오늘'과 같게)
      const count = adViews.date === today ? adViews.count : 0;
      const tooSoon = Date.now() - adViews.last < cfg.minIntervalSec * 1000;
      if (premium || !cfg.enabled || count >= cfg.maxPerDay || tooSoon) return onGranted();
      track('page_view', { ad: 'rewarded', where });
      setPending({ grant: onGranted, where });
    },
    [premium, adViews],
  );
  const modal: ReactNode = pending ? (
    <RewardGate
      where={pending.where}
      onGranted={(counted) => { if (counted) noteAdView(); const f = pending.grant; setPending(null); f(); }}
      onClose={() => setPending(null)}
    />
  ) : null;
  return { run, modal };
}

type Phase = 'ask' | 'loading' | 'playing' | 'dismissed' | 'failed';
function RewardGate({ where, onGranted, onClose }: { where: string; onGranted: (counted: boolean) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('ask');
  const provider = rewardProvider();
  const start = async () => {
    setPhase('loading');
    const r: RewardResult = await showRewarded((s) => setPhase(s));
    track('ad_rewarded', { where, provider, result: r });
    if (r === 'rewarded') return onGranted(true);
    if (r === 'dismissed') return setPhase('dismissed');
    // 광고 없음·연동 전: 기본은 사용자를 막지 않고 바로 열어 준다(하루 횟수에는 세지 않음)
    if ((live.whenUnavailable ?? 'open') === 'open') return onGranted(false);
    setPhase('failed');
  };
  return (
    <div className="rg" role="dialog" aria-modal="true" aria-label="광고 보고 풀이 열기">
      {phase === 'ask' && (
        <div className="rg-in">
          <small>FREE · AD</small>
          <b>광고를 끝까지 보면<br />상세 풀이가 열려요</b>
          <p>광고 한 편을 보고 오늘의 자세한 풀이를 무료로 만나 보세요.</p>
          <button className="btn gold big" onClick={start}>광고 보고 풀이 열기 ›</button>
          <button className="rg-x" onClick={onClose}>다음에 볼게요</button>
          <span className="rg-note">프리미엄 회원은 광고 없이 바로 볼 수 있어요</span>
        </div>
      )}
      {phase === 'loading' && (
        <div className="rg-in"><span className="rg-spin" aria-hidden /><b>광고를 불러오는 중…</b><p>잠시만 기다려 주세요</p></div>
      )}
      {phase === 'playing' && (provider === 'mock' ? <MockAd /> : <div className="rg-in"><b>광고 재생 중</b><p>광고가 끝나면 풀이가 열려요</p></div>)}
      {phase === 'dismissed' && (
        <div className="rg-in">
          <b>광고를 끝까지 봐야<br />풀이가 열려요</b>
          <p>중간에 닫으면 풀이가 열리지 않아요. 다시 보시겠어요?</p>
          <button className="btn gold big" onClick={start}>다시 광고 보기 ›</button>
          <button className="rg-x" onClick={onClose}>닫기</button>
        </div>
      )}
      {phase === 'failed' && (
        <div className="rg-in">
          <b>지금은 보여 드릴 광고가 없어요</b>
          <p>잠시 후 다시 시도해 주세요.</p>
          <button className="btn gold big" onClick={start}>다시 시도 ›</button>
          <button className="rg-x" onClick={onClose}>닫기</button>
        </div>
      )}
    </div>
  );
}

// 시험 모드(MOCK_MODE=true)에서만 쓰는 가짜 광고 화면 — 운영 빌드에서는 실제 플랫폼 광고가 이 자리를 덮는다
function MockAd() {
  const [left, setLeft] = useState(MOCK_AD_SECONDS);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const end = (detail: 'rewarded' | 'dismissed') => window.dispatchEvent(new CustomEvent('naman:mock-ad', { detail }));
  return (
    <div className="rg-mock">
      <span className="rg-tag">시험용 가짜 광고 · 운영에서는 실제 광고가 나와요</span>
      <div className="rg-mockbox">광고 영역<br /><small>앱: AdMob 보상형 · 웹: Google Ad Manager 보상형</small></div>
      {left > 0 ? <div className="rg-count" aria-live="polite">{left}초 뒤 보상</div> : <button className="btn gold big" onClick={() => end('rewarded')}>풀이 열기 ›</button>}
      <button className="rg-x" onClick={() => end('dismissed')}>건너뛰기(보상 없음)</button>
    </div>
  );
}

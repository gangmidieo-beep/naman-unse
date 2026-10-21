// 보상형 광고(실제 광고 플랫폼 연동) — 2026-10-21 대표님 요청: 임시 3초 화면 대신 실제 광고를 끝까지 봐야 무료 상세 풀이가 열린다.
// 재생 시간은 우리가 정하지 않고 광고 플랫폼이 준 광고 길이 그대로(플랫폼이 "보상 지급" 신호를 보낼 때만 연다).
//
//  앱(Android)  → AdMob 보상형(Rewarded)   : VITE_ADMOB_REWARDED_ID   (없으면 구글 공식 테스트 ID)
//  웹(브라우저) → Google Ad Manager 보상형 : VITE_GAM_REWARDED_UNIT   (예: /1234567/naman_rewarded — 애드센스에는 웹 보상형 형식이 없어 Ad Manager 광고 단위가 필요)
//  시험 모드    → 가짜 광고(5초, '시험용' 표시)  — 운영 빌드에서는 절대 쓰이지 않음(MOCK_MODE=true 일 때만)
//
// 결과: rewarded(끝까지 봄) | dismissed(중간에 닫음) | unavailable(광고 없음·불러오기 실패·연동 안 됨)
import { isNativeApp } from './payments';

export type RewardResult = 'rewarded' | 'dismissed' | 'unavailable';
export type RewardProvider = 'admob' | 'gam' | 'mock' | 'none';

const TEST_REWARDED = 'ca-app-pub-3940256099942544/5224354917'; // 구글 공식 테스트 보상형 ID
const ADMOB_ID = (import.meta.env.VITE_ADMOB_REWARDED_ID as string | undefined) || TEST_REWARDED;
const GAM_UNIT = (import.meta.env.VITE_GAM_REWARDED_UNIT as string | undefined) || '';
const LOAD_TIMEOUT_MS = 12_000; // 이 안에 광고가 안 오면 '광고 없음'

export function rewardProvider(): RewardProvider {
  if (isNativeApp()) return 'admob';
  if (GAM_UNIT) return 'gam';
  if (__MOCK_MODE__) return 'mock';
  return 'none';
}

/** 광고를 띄우고 플랫폼의 보상 신호를 기다린다. onStage 로 '불러오는 중 → 재생 중' 단계를 화면에 알린다. */
export async function showRewarded(onStage?: (s: 'loading' | 'playing') => void): Promise<RewardResult> {
  const p = rewardProvider();
  try {
    if (p === 'admob') return await admobRewarded(onStage);
    if (p === 'gam') return await gamRewarded(onStage);
    if (p === 'mock') return await mockRewarded(onStage);
  } catch { /* 플러그인·스크립트 오류 → 광고 없음 */ }
  return 'unavailable';
}

/* ---------- 앱: AdMob 보상형 ---------- */
async function admobRewarded(onStage?: (s: 'loading' | 'playing') => void): Promise<RewardResult> {
  const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
  onStage?.('loading');
  let rewarded = false;
  const subs = await Promise.all([
    AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; }),
    AdMob.addListener(RewardAdPluginEvents.Showed, () => onStage?.('playing')),
  ]);
  try {
    await withTimeout(AdMob.prepareRewardVideoAd({ adId: ADMOB_ID, isTesting: ADMOB_ID === TEST_REWARDED }), LOAD_TIMEOUT_MS);
    // showRewardVideoAd 는 광고가 닫힐 때 끝난다(보상은 Rewarded 이벤트로)
    await AdMob.showRewardVideoAd();
    return rewarded ? 'rewarded' : 'dismissed';
  } catch { return 'unavailable'; } finally { subs.forEach((s) => s.remove()); }
}

/* ---------- 웹: Google Ad Manager(GPT) 보상형 ---------- */
let gptLoading: Promise<void> | null = null;
function loadGpt() {
  if (gptLoading) return gptLoading;
  gptLoading = new Promise<void>((res, rej) => {
    const w = window as any;
    w.googletag = w.googletag || { cmd: [] };
    if (document.querySelector('script[data-gpt]')) return res();
    const s = document.createElement('script');
    s.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
    s.async = true; s.dataset.gpt = '1';
    s.onload = () => res(); s.onerror = () => rej(new Error('gpt'));
    document.head.appendChild(s);
  });
  return gptLoading;
}
async function gamRewarded(onStage?: (s: 'loading' | 'playing') => void): Promise<RewardResult> {
  onStage?.('loading');
  await withTimeout(loadGpt(), LOAD_TIMEOUT_MS);
  const gt = (window as any).googletag;
  return new Promise<RewardResult>((resolve) => {
    let done = false, granted = false, slot: any = null;
    const finish = (r: RewardResult) => { if (done) return; done = true; clearTimeout(timer); try { if (slot) gt.destroySlots([slot]); } catch { /* */ } resolve(r); };
    const timer = setTimeout(() => finish('unavailable'), LOAD_TIMEOUT_MS);
    gt.cmd.push(() => {
      slot = gt.defineOutOfPageSlot(GAM_UNIT, gt.enums.OutOfPageFormat.REWARDED);
      if (!slot) return finish('unavailable'); // 이 브라우저·화면에서 보상형을 못 띄움
      slot.addService(gt.pubads());
      const pa = gt.pubads();
      pa.addEventListener('rewardedSlotReady', (ev: any) => { if (ev.slot !== slot) return; clearTimeout(timer); onStage?.('playing'); ev.makeRewardedVisible(); });
      pa.addEventListener('rewardedSlotGranted', (ev: any) => { if (ev.slot === slot) granted = true; });
      pa.addEventListener('rewardedSlotClosed', (ev: any) => { if (ev.slot === slot) finish(granted ? 'rewarded' : 'dismissed'); });
      pa.addEventListener('slotRenderEnded', (ev: any) => { if (ev.slot === slot && ev.isEmpty) finish('unavailable'); });
      gt.enableServices();
      gt.display(slot);
    });
  });
}

/* ---------- 시험 모드: 가짜 광고(운영에서는 안 쓰임) ---------- */
export const MOCK_AD_SECONDS = 5;
async function mockRewarded(onStage?: (s: 'loading' | 'playing') => void): Promise<RewardResult> {
  onStage?.('loading');
  await new Promise((r) => setTimeout(r, 600));
  onStage?.('playing');
  return new Promise<RewardResult>((resolve) => {
    const onEnd = (e: Event) => { window.removeEventListener('naman:mock-ad', onEnd); resolve((e as CustomEvent).detail === 'rewarded' ? 'rewarded' : 'dismissed'); };
    window.addEventListener('naman:mock-ad', onEnd);
  });
}

function withTimeout<T>(p: Promise<T>, ms: number) {
  return new Promise<T>((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); }); });
}

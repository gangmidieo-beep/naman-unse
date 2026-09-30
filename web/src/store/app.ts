// 앱 상태 — MOCK_MODE 에서는 localStorage 에 저장(zustand persist). 서버 연결 시(08) 로그인 계정 기준으로 동기화.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import brand from '../../../brand.config.json';

export type Profile = {
  id: string;
  name: string;
  gender: 'M' | 'F';
  year: number;
  month: number;
  day: number;
  calendar: 'solar' | 'lunar';
  leap: boolean;
  hour: number | null; // 0~23, 모르면 null (12지시 버튼은 대표 시각 0,2,4…22 로 저장)
  relation?: string; // 나·배우자·연인·자녀·부모 등
  bloodType?: 'A' | 'B' | 'O' | 'AB';
  mbti?: string;
};
export type Purchase = { orderId: string; productId: string; profileId: string; price: number; createdAt: string; kind: 'reading' | 'talisman' | 'subscription'; status: 'paid' | 'refunded' };
export type MyTalisman = { id: string; talismanId: string; orderId: string; name: string; birth: string; wish: string; issuedAt: string };
export type Account = { provider: 'google' | 'kakao' | 'naver' | 'mock'; id: string; name: string; token?: string };
export type Plan = 'monthly' | 'yearly' | null;

// 정보 입력 전 보여주는 예시 인물
export const SAMPLE_PROFILE: Profile = { id: 'sample', name: '홍길동', gender: 'M', year: 1968, month: 3, day: 15, calendar: 'solar', leap: false, hour: 7 };

type State = {
  introSeen: boolean;
  profiles: Profile[];
  mainId: string | null;
  fontScale: '100' | '115' | '130';
  pushConsent: boolean | null; // 첫 실행에서 묻는 푸시 수신 동의
  notifyOn: boolean;
  notifyTime: string;
  eventNotify: boolean;
  plan: Plan; // 프리미엄 구독(월간/연간)
  planUntil: string | null;
  purchases: Purchase[];
  talismans: MyTalisman[];
  account: Account | null;
  adViews: { date: string; count: number; last: number };
  unlocked: Record<string, string>; // 보상형 광고로 연 콘텐츠: key → 날짜
  setIntroSeen: () => void;
  saveProfile: (p: Profile, makeMain?: boolean) => void;
  removeProfile: (id: string) => void;
  setMain: (id: string) => void;
  patchProfile: (id: string, patch: Partial<Profile>) => void;
  setFontScale: (s: State['fontScale']) => void;
  setPushConsent: (on: boolean) => void;
  setNotify: (on: boolean, time?: string) => void;
  setEventNotify: (on: boolean) => void;
  setPlan: (plan: Plan) => void;
  addPurchase: (p: Purchase) => void;
  addTalisman: (t: MyTalisman) => void;
  setAccount: (a: Account | null) => void;
  noteAdView: () => void;
  unlock: (key: string) => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export const useApp = create<State>()(
  persist(
    (set) => ({
      introSeen: false,
      profiles: [],
      mainId: null,
      fontScale: '100',
      pushConsent: null,
      notifyOn: false,
      notifyTime: '07:00',
      eventNotify: true,
      plan: null,
      planUntil: null,
      purchases: [],
      talismans: [],
      account: null,
      adViews: { date: '', count: 0, last: 0 },
      unlocked: {},
      setIntroSeen: () => set({ introSeen: true }),
      saveProfile: (p, makeMain) =>
        set((s) => {
          const profiles = s.profiles.some((x) => x.id === p.id) ? s.profiles.map((x) => (x.id === p.id ? p : x)) : [...s.profiles, p];
          return { profiles, mainId: makeMain || !s.mainId ? p.id : s.mainId };
        }),
      removeProfile: (id) =>
        set((s) => {
          const profiles = s.profiles.filter((x) => x.id !== id);
          return { profiles, mainId: s.mainId === id ? profiles[0]?.id ?? null : s.mainId };
        }),
      setMain: (id) => set({ mainId: id }),
      patchProfile: (id, patch) => set((s) => ({ profiles: s.profiles.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      setFontScale: (fontScale) => set({ fontScale }),
      setPushConsent: (on) => set({ pushConsent: on, notifyOn: on }),
      setNotify: (notifyOn, notifyTime) => set((s) => ({ notifyOn, notifyTime: notifyTime ?? s.notifyTime })),
      setEventNotify: (eventNotify) => set({ eventNotify }),
      setPlan: (plan) =>
        set({ plan, planUntil: plan ? new Date(Date.now() + (plan === 'yearly' ? 365 : 30) * 86400000).toISOString().slice(0, 10) : null }),
      addPurchase: (p) => set((s) => ({ purchases: [p, ...s.purchases] })),
      addTalisman: (t) => set((s) => ({ talismans: [t, ...s.talismans] })),
      setAccount: (account) => set({ account }),
      noteAdView: () =>
        set((s) => ({ adViews: { date: today(), count: (s.adViews.date === today() ? s.adViews.count : 0) + 1, last: Date.now() } })),
      unlock: (key) => set((s) => ({ unlocked: { ...s.unlocked, [key]: today() } })),
    }),
    { name: 'naman-unse', version: 2, migrate: (old: any) => ({ ...old, plan: old?.premium ? 'monthly' : null, purchases: (old?.purchases ?? []).map((p: any) => ({ kind: 'reading', status: 'paid', ...p })) }) },
  ),
);

export const usePremium = () => useApp((s) => !!s.plan);
// 대표 프로필(없으면 예시 인물)
export function useMainProfile(): { profile: Profile; isSample: boolean } {
  const { profiles, mainId } = useApp();
  const p = profiles.find((x) => x.id === mainId) ?? profiles[0];
  return p ? { profile: p, isSample: false } : { profile: SAMPLE_PROFILE, isSample: true };
}
// 저장 가능한 사주 수: 일반 2 / 프리미엄 무제한 (brand.config profileLimit)
export function useProfileLimit() {
  const premium = usePremium();
  const n = useApp((s) => s.profiles.length);
  const limit = premium ? null : brand.profileLimit.free;
  return { limit, canAdd: limit == null || n < limit, count: n };
}
export const isUnlockedToday = (unlocked: Record<string, string>, key: string) => unlocked[key] === today();
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// 앱 상태 — MOCK_MODE 에서는 localStorage 에 저장(zustand persist). 08 단계에서 서버와 동기화한다.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  relation?: string; // 본인·배우자·자녀 등
};
export type Purchase = { orderId: string; productId: string; profileId: string; price: number; createdAt: string };

// 정보 입력 전 보여주는 예시 인물
export const SAMPLE_PROFILE: Profile = { id: 'sample', name: '홍길동', gender: 'M', year: 1968, month: 3, day: 15, calendar: 'solar', leap: false, hour: 7 };

type State = {
  introSeen: boolean;
  profiles: Profile[];
  mainId: string | null;
  fontScale: '100' | '115' | '130';
  notifyOn: boolean;
  notifyTime: string;
  premium: boolean;
  purchases: Purchase[];
  setIntroSeen: () => void;
  saveProfile: (p: Profile, makeMain?: boolean) => void;
  removeProfile: (id: string) => void;
  setMain: (id: string) => void;
  setFontScale: (s: State['fontScale']) => void;
  setNotify: (on: boolean, time?: string) => void;
  setPremium: (on: boolean) => void;
  addPurchase: (p: Purchase) => void;
};

export const useApp = create<State>()(
  persist(
    (set) => ({
      introSeen: false,
      profiles: [],
      mainId: null,
      fontScale: '100',
      notifyOn: false,
      notifyTime: '07:00',
      premium: false,
      purchases: [],
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
      setFontScale: (fontScale) => set({ fontScale }),
      setNotify: (notifyOn, notifyTime) => set((s) => ({ notifyOn, notifyTime: notifyTime ?? s.notifyTime })),
      setPremium: (premium) => set({ premium }),
      addPurchase: (p) => set((s) => ({ purchases: [p, ...s.purchases] })),
    }),
    { name: 'naman-unse', version: 1 },
  ),
);

// 대표 프로필(없으면 예시 인물)
export function useMainProfile(): { profile: Profile; isSample: boolean } {
  const { profiles, mainId } = useApp();
  const p = profiles.find((x) => x.id === mainId) ?? profiles[0];
  return p ? { profile: p, isSample: false } : { profile: SAMPLE_PROFILE, isSample: true };
}
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

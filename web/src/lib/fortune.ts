// 오늘의 운세 훅 — 엔진 계산 + 문구 DB (AI 호출 없음). 같은 프로필·같은 날은 항상 같은 결과.
import { useMemo } from 'react';
import { sajuOf, todayFortune, weekFortune, monthFortune } from '@naman/content';
import type { Profile } from '../store/app';

const now = () => new Date();
export const useSaju = (p: Profile) => useMemo(() => sajuOf(p), [p]);
export function useTodayFortune(p: Profile) {
  const saju = useSaju(p);
  return useMemo(() => todayFortune(saju, now(), p.id), [saju, p.id]);
}
export function useWeekFortune(p: Profile) {
  const saju = useSaju(p);
  return useMemo(() => weekFortune(saju, now(), p.id), [saju, p.id]);
}
export function useMonthFortune(p: Profile) {
  const saju = useSaju(p);
  return useMemo(() => monthFortune(saju, now(), p.id), [saju, p.id]);
}

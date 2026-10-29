// 오늘의 운세 훅 — 엔진 계산 + 문구 DB (AI 호출 없음). 같은 프로필·같은 날은 항상 같은 결과.
import { useEffect, useMemo, useState } from 'react';
import { sajuOf, todayFortune, weekFortune, monthFortune } from '@naman/content';
import type { Profile } from '../store/app';

const now = () => new Date();
// 한국 날짜 — 화면을 밤새 켜 두었거나 다음 날 다시 열어도 '오늘' 운세가 새로 계산되게(예전엔 어제 운세가 오늘 날짜로 보였다)
const kstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
function useKstDay() {
  const [day, setDay] = useState(kstDay);
  useEffect(() => {
    const check = () => setDay((d) => (d === kstDay() ? d : kstDay()));
    const t = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', check); };
  }, []);
  return day;
}
export const useSaju = (p: Profile) => useMemo(() => sajuOf(p), [p]);
export function useTodayFortune(p: Profile) {
  const saju = useSaju(p);
  const day = useKstDay();
  return useMemo(() => todayFortune(saju, now(), p.id), [saju, p.id, day]);
}
export function useWeekFortune(p: Profile) {
  const saju = useSaju(p);
  const day = useKstDay();
  return useMemo(() => weekFortune(saju, now(), p.id), [saju, p.id, day]);
}
export function useMonthFortune(p: Profile) {
  const saju = useSaju(p);
  const day = useKstDay();
  return useMemo(() => monthFortune(saju, now(), p.id), [saju, p.id, day]);
}

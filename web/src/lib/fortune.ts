// 오늘의 운세 훅 — 04 단계에서 packages/content 계산으로 교체.
import type { Profile } from '../store/app';

export function useTodayFortune(_p: Profile) {
  return { total: 87, stars: 4, oneLine: '어른의 조언과 문서 소식에 귀를 여는 날이에요.' };
}

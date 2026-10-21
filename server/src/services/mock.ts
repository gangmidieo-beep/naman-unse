// 시험 모드 판정 한 곳에서 — MOCK_MODE=true 라고 똑똑히 적었을 때만 켜진다(변수 없음·오타 = 운영).
// 자동 테스트(vitest, NODE_ENV=test)에서는 변수를 안 적어도 시험 모드.
export const mockMode = () => process.env.MOCK_MODE === 'true' || (process.env.MOCK_MODE === undefined && process.env.NODE_ENV === 'test');

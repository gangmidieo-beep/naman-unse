// 대표님이 Railway 화면에 직접 넣는 AI 변수 정리 — 2026-10-26 양도 후 실제 사례:
// 변수 3개를 넣고 Deploy 했는데도 유료 풀이가 '준비 중'으로 남음(값 앞뒤 공백·따옴표·대소문자 차이로 추정).
// 서버 시작 때 한 번, 값의 앞뒤 공백·따옴표를 지우고 READING_AI 는 소문자로 맞춘다. 이름 뒤에 공백이 붙은 변수도 찾아서 바로잡는다.
const AI_VARS = ['READING_AI', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'PHOTO_AI_MODEL', 'GEMINI_API_KEY', 'GEMINI_IMAGE_MODEL'] as const;

// 눈에 안 보이는 문자(줄바꿈·제로폭 공백·BOM 등)까지 지운다
const INVISIBLE = /[\u0000-\u001f\u007f\u00a0\u200b-\u200f\u2028\u2029\u2060\ufeff]/g;
const clean = (v: string) => v.replace(INVISIBLE, ' ').trim().replace(/^(['"`])(.*)\1$/s, '$2').trim();

// 2026-10-27: 대표님이 READING_AI 를 여러 번 다시 넣어도 'live' 로 인식되지 않음(값 확인 불가) →
// 판매 스위치를 '끄는 값'만 정하는 방식으로 바꿈. 키(+모델)가 있으면 기본 켜짐, READING_AI=off 일 때만 꺼짐.
const OFF_VALUES = new Set(['off', 'false', '0', 'no', 'mock', 'sample', 'stop', '끔', '끄기']);
/** 판매 스위치 — READING_AI 가 없거나 off 가 아닌 값이면 켜짐(키가 있어야 실제로 켜짐) */
export const aiSwitchOn = (env: NodeJS.ProcessEnv = process.env) => !OFF_VALUES.has(clean(env.READING_AI ?? '').toLowerCase());

export function normalizeAiEnv(env: NodeJS.ProcessEnv = process.env) {
  // 이름에 공백이 섞인 변수("READING_AI " 등) → 정확한 이름으로 옮김(정확한 이름이 이미 있으면 그대로 둠)
  for (const raw of Object.keys(env)) {
    const name = raw.replace(INVISIBLE, '').trim().toUpperCase();
    if (raw !== name && (AI_VARS as readonly string[]).includes(name) && !env[name]) env[name] = env[raw];
  }
  for (const k of AI_VARS) {
    const v = env[k];
    if (v === undefined) continue;
    const c = clean(v);
    if (c) env[k] = k === 'READING_AI' ? c.toLowerCase() : c;
    else delete env[k];
  }
}

/** /health 에 보여 줄 AI 상태 — 값은 절대 내보내지 않고 켜짐 여부와 빠진 변수 이름만 */
export function aiStatus(env: NodeJS.ProcessEnv = process.env) {
  const missing: string[] = [];
  if (!aiSwitchOn(env)) missing.push('READING_AI=off(판매 꺼짐)');
  if (!env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
  else if (!env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) missing.push('ANTHROPIC_API_KEY(sk-ant- 로 시작해야 함)');
  if (!env.ANTHROPIC_MODEL) missing.push('ANTHROPIC_MODEL');
  const claude = aiSwitchOn(env) && !!env.ANTHROPIC_API_KEY;
  return { reading: claude && !!env.ANTHROPIC_MODEL, photo: claude, baby: !!env.GEMINI_API_KEY, missing };
}

// 대표님이 Railway 화면에 직접 넣는 AI 변수 정리 — 2026-10-26 양도 후 실제 사례:
// 변수 3개를 넣고 Deploy 했는데도 유료 풀이가 '준비 중'으로 남음(값 앞뒤 공백·따옴표·대소문자 차이로 추정).
// 서버 시작 때 한 번, 값의 앞뒤 공백·따옴표를 지우고 READING_AI 는 소문자로 맞춘다. 이름 뒤에 공백이 붙은 변수도 찾아서 바로잡는다.
const AI_VARS = ['READING_AI', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'PHOTO_AI_MODEL', 'GEMINI_API_KEY', 'GEMINI_IMAGE_MODEL'] as const;

const clean = (v: string) => v.trim().replace(/^(['"`])(.*)\1$/s, '$2').trim();

export function normalizeAiEnv(env: NodeJS.ProcessEnv = process.env) {
  // 이름에 공백이 섞인 변수("READING_AI " 등) → 정확한 이름으로 옮김(정확한 이름이 이미 있으면 그대로 둠)
  for (const raw of Object.keys(env)) {
    const name = raw.trim().toUpperCase();
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
  if (env.READING_AI !== 'live') missing.push('READING_AI=live');
  if (!env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
  else if (!env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) missing.push('ANTHROPIC_API_KEY(sk-ant- 로 시작해야 함)');
  if (!env.ANTHROPIC_MODEL) missing.push('ANTHROPIC_MODEL');
  const claude = env.READING_AI === 'live' && !!env.ANTHROPIC_API_KEY;
  return { reading: claude && !!env.ANTHROPIC_MODEL, photo: claude, baby: !!env.GEMINI_API_KEY, missing };
}

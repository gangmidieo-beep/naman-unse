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

/* AI 호출 진단 — 2026-10-29: 실서버에서 감정서가 '풀이를 쓰는 중 문제'로 끝나는데 원인(키·잔액·모델명)을 볼 방법이 없었다.
   마지막 실패의 HTTP 상태와 Anthropic 오류 종류·문구(키·본문 없이 앞부분만)를 메모리에 두고 /health 에 보여 준다. */
type AiErr = { at: string; status: number; type: string; message: string };
export const aiDiag: { lastError: AiErr | null; lastOkAt: string | null } = { lastError: null, lastOkAt: null };
export async function recordAiFailure(r: { status: number; text?: () => Promise<string> } | null, fallback = '') {
  let type = '', message = fallback;
  try {
    const body = r?.text ? await r.text() : '';
    const j = body ? JSON.parse(body) : null;
    type = String(j?.error?.type ?? '');
    message = String(j?.error?.message ?? message);
  } catch { /* 본문 없음 */ }
  message = message.replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-***').slice(0, 200);
  aiDiag.lastError = { at: new Date().toISOString(), status: r?.status ?? 0, type, message };
}
export const recordAiOk = () => { aiDiag.lastOkAt = new Date().toISOString(); };
/** 대표님이 바로 알아볼 수 있게 흔한 오류를 한국어로 */
export function aiErrorHint(e: AiErr | null) {
  if (!e) return null;
  const m = `${e.type} ${e.message}`.toLowerCase();
  if (e.status === 401 || m.includes('authentication')) return 'API 키가 틀렸어요 — Anthropic 콘솔에서 새 키를 만들어 ANTHROPIC_API_KEY 에 다시 넣어 주세요';
  if (m.includes('credit') || m.includes('billing') || m.includes('balance')) return 'Anthropic 크레딧(잔액)이 부족해요 — 콘솔 Billing 에서 충전해 주세요';
  if (e.status === 404 || m.includes('model')) return 'ANTHROPIC_MODEL 이름이 맞지 않아요 — claude-sonnet-5-5 로 넣어 주세요';
  if (e.status === 403 || m.includes('permission')) return 'API 키 권한·조직 설정 문제예요 — 콘솔에서 키를 확인해 주세요';
  if (e.status === 429 || e.status === 529) return '잠시 요청이 몰렸어요(자동 재시도) — 계속되면 콘솔 한도를 확인해 주세요';
  return null;
}

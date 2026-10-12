// 사진운세 — 손금·관상(Claude 비전, 7개 항목) / 2세 얼굴보기(Gemini 이미지, 아들·딸 2장).
// 사진은 메모리에서만 쓰고 버린다(저장·로그 없음). 결과 글·2세 그림만 readings.content 에 보관해 운세함에서 다시 본다.
// 켜는 조건: 손금·관상 = READING_AI=live + ANTHROPIC_API_KEY (모델 PHOTO_AI_MODEL, 기본 claude-sonnet-5-5 — 1건 약 30원)
//            2세 = GEMINI_API_KEY (모델 GEMINI_IMAGE_MODEL, 기본 gemini-2.5-flash-image — 1건 2장 약 130~180원). 없으면 예시 결과.
import sample from '../../../packages/content/data/photo-sample.json' with { type: 'json' };

export type PhotoKind = 'palm' | 'face';
export type PhotoSection = { key: string; title: string; emoji: string; body: string };
export type PhotoResult = { title: string; intro: string; sections: PhotoSection[]; closing: string; generatedBy: 'ai' | 'sample' };
export const PALM_LINES = [
  { key: 'life', title: '생명선', emoji: '🌱' }, { key: 'head', title: '두뇌선', emoji: '🧠' }, { key: 'heart', title: '감정선', emoji: '💗' },
  { key: 'fate', title: '운명선', emoji: '🧭' }, { key: 'sun', title: '태양선', emoji: '☀️' }, { key: 'marriage', title: '결혼선', emoji: '💍' }, { key: 'wealth', title: '재물선', emoji: '💰' },
] as const;
export const FACE_PARTS = [
  { key: 'forehead', title: '이마', emoji: '🌄' }, { key: 'brow', title: '눈썹', emoji: '〰️' }, { key: 'eye', title: '눈', emoji: '👁️' },
  { key: 'nose', title: '코', emoji: '💰' }, { key: 'mouth', title: '입', emoji: '💬' }, { key: 'ear', title: '귀', emoji: '👂' }, { key: 'chin', title: '턱', emoji: '🏔️' },
] as const;
const PARTS = { palm: PALM_LINES, face: FACE_PARTS };

export const photoLive = () => process.env.READING_AI === 'live' && !!process.env.ANTHROPIC_API_KEY;
export const babyLive = () => !!process.env.GEMINI_API_KEY;

export function samplePhoto(kind: PhotoKind): PhotoResult {
  const s = (sample as any)[kind];
  return { title: s.title, intro: s.intro, closing: s.closing, generatedBy: 'sample', sections: PARTS[kind].map((p, i) => ({ ...p, body: s.sections[i]?.body ?? s.sections[s.sections.length - 1].body })) };
}

const SYSTEM = (kind: PhotoKind) => `당신은 "천궁도사"다. 점잖은 하오체(~하오, ~구려, ~하시게)로 쓴다. 재미로 보는 전통 ${kind === 'palm' ? '손금' : '관상'} 풀이다.
사진에서 실제로 보이는 특징(선의 길이·굵기·갈래·휘어짐 / 이마 넓이·눈매·콧대·입꼬리·턱선 등)을 근거로 한 줄씩 짚어 "내 손(얼굴) 얘기 같다"는 느낌을 준다.
단정·공포 금지(죽음·이혼·파산·병 단정 금지), 의료·투자 권유 금지, 외모 평가·비하 금지. 희망적으로 마무리하고 실천 조언을 준다.
${kind === 'palm' ? '손바닥' : '사람의 얼굴 정면'}이 아니거나 너무 흐려 볼 수 없으면 {"error":"unclear"} 만 출력한다.
출력은 JSON 하나만: {"intro": string(2문장), "sections": [{"key": string, "body": string(3~5문장, 180~320자)}], "closing": string(2문장)}
sections 는 정확히 이 순서·key 로 7개: ${PARTS[kind].map((p) => `${p.key}=${p.title}`).join(', ')}`;

export async function analyzePhoto(kind: PhotoKind, image: string, http: typeof fetch): Promise<PhotoResult | { error: 'unclear' }> {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(image);
  if (!m) throw new Error('사진 형식');
  const r = await http('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.PHOTO_AI_MODEL || 'claude-sonnet-5-5', max_tokens: 3000, system: SYSTEM(kind),
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: m[1] === 'image/jpg' ? 'image/jpeg' : m[1], data: m[2] } }, { type: 'text', text: `이 ${kind === 'palm' ? '손바닥' : '얼굴'} 사진으로 풀이해 주시게.` }] }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) throw new Error(`AI 호출 실패 ${r.status}`);
  const j = (await r.json()) as any;
  const text = (j.content ?? []).map((c: any) => c.text ?? '').join('');
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  if (json.error) return { error: 'unclear' };
  const by = new Map<string, string>((json.sections ?? []).map((s: any) => [s.key, s.body]));
  const base = samplePhoto(kind);
  return {
    title: `천궁도사의 ${kind === 'palm' ? '손금' : '관상'} 풀이`, intro: json.intro || base.intro, closing: json.closing || base.closing, generatedBy: 'ai',
    sections: PARTS[kind].map((p, i) => ({ ...p, body: by.get(p.key) || base.sections[i].body })),
  };
}

/* ---------- 2세 얼굴보기 (Gemini) ---------- */
export type BabyResult = { boy: string; girl: string; generatedBy: 'ai' | 'sample' };
export const sampleBaby = (): BabyResult => ({ boy: '/img/v4/baby_boy.webp', girl: '/img/v4/baby_girl.webp', generatedBy: 'sample' });
const BABY_PROMPT = (sex: 'boy' | 'girl') => `Using the two adult face photos as the parents, create one photorealistic portrait of their ${sex === 'boy' ? 'son' : 'daughter'} at about 3 years old.
Blend facial features naturally from both parents (eye shape, nose, lips, face shape, skin tone, hair color). Warm, soft studio lighting, gentle smile, looking at the camera,
wearing a simple cream-colored Korean hanbok top, softly blurred warm background with cherry blossoms. Head-and-shoulders, square 1:1 framing. No text, no watermark.`;
async function geminiImage(parts: unknown[], http: typeof fetch) {
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const r = await http(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'] } }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) throw new Error(`이미지 AI 호출 실패 ${r.status}`);
  const j = (await r.json()) as any;
  const img = (j.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData || p.inline_data);
  const d = img?.inlineData ?? img?.inline_data;
  if (!d?.data) throw new Error('이미지를 만들지 못했어요');
  return `data:${d.mimeType ?? d.mime_type ?? 'image/png'};base64,${d.data}`;
}
export async function generateBaby(a: string, b: string, http: typeof fetch): Promise<BabyResult> {
  const part = (u: string) => { const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(u); if (!m) throw new Error('사진 형식'); return { inline_data: { mime_type: m[1], data: m[2] } }; };
  const parents = [part(a), part(b)];
  const [boy, girl] = await Promise.all((['boy', 'girl'] as const).map((s) => geminiImage([...parents, { text: BABY_PROMPT(s) }], http)));
  return { boy, girl, generatedBy: 'ai' };
}

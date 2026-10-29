// 사진운세 — 손금·관상(Claude 비전, 7개 항목) / 2세 얼굴보기(Gemini 이미지, 아들·딸 2장).
// 사진은 메모리에서만 쓰고 버린다(저장·로그 없음). 결과 글·2세 그림만 readings.content 에 보관해 운세함에서 다시 본다.
// 켜는 조건: 손금·관상 = ANTHROPIC_API_KEY (READING_AI=off 면 중지) (모델 PHOTO_AI_MODEL, 기본 claude-sonnet-5-5 — 3차 분량 보강 후 1건 약 100~150원)
//            2세 = GEMINI_API_KEY (모델 GEMINI_IMAGE_MODEL, 기본 gemini-2.5-flash-image — 1건 2장 약 130~180원). 없으면 예시 결과.
import { aiSwitchOn, recordAiFailure, recordAiOk } from './env.ts';
import sample from '../../../packages/content/data/photo-sample.json' with { type: 'json' };

export type PhotoKind = 'palm' | 'face';
// 3차(2026-10-14): 유료인 만큼 분량 보강 — 총평 + 전체 모양 + 7항목(보이는 모습·풀이·조언) + 시기별 흐름 3 + 복을 키우는 습관 3 + 마무리
export type PhotoSection = { key: string; title: string; emoji: string; feature?: string; body: string; advice?: string };
export type PhotoResult = {
  title: string; intro: string; overview?: { title: string; body: string }; sections: PhotoSection[];
  timeline?: { label: string; body: string }[]; tips?: string[]; closing: string; generatedBy: 'ai' | 'sample';
};
export const PALM_LINES = [
  { key: 'life', title: '생명선', emoji: '🌱' }, { key: 'head', title: '두뇌선', emoji: '🧠' }, { key: 'heart', title: '감정선', emoji: '💗' },
  { key: 'fate', title: '운명선', emoji: '🧭' }, { key: 'sun', title: '태양선', emoji: '☀️' }, { key: 'marriage', title: '결혼선', emoji: '💍' }, { key: 'wealth', title: '재물선', emoji: '💰' },
] as const;
export const FACE_PARTS = [
  { key: 'forehead', title: '이마', emoji: '🌄' }, { key: 'brow', title: '눈썹', emoji: '〰️' }, { key: 'eye', title: '눈', emoji: '👁️' },
  { key: 'nose', title: '코', emoji: '💰' }, { key: 'mouth', title: '입', emoji: '💬' }, { key: 'ear', title: '귀', emoji: '👂' }, { key: 'chin', title: '턱', emoji: '🏔️' },
] as const;
const PARTS = { palm: PALM_LINES, face: FACE_PARTS };

export const photoLive = () => aiSwitchOn() && !!process.env.ANTHROPIC_API_KEY;
export const babyLive = () => !!process.env.GEMINI_API_KEY;

export function samplePhoto(kind: PhotoKind): PhotoResult {
  const s = (sample as any)[kind];
  return {
    title: s.title, intro: s.intro, overview: s.overview, timeline: s.timeline, tips: s.tips, closing: s.closing, generatedBy: 'sample',
    sections: PARTS[kind].map((p, i) => { const x = s.sections[i] ?? s.sections[s.sections.length - 1]; return { ...p, feature: x.feature, body: x.body, advice: x.advice }; }),
  };
}

const SYSTEM = (kind: PhotoKind) => {
  const palm = kind === 'palm';
  return `당신은 경험 많은 ${palm ? '손금' : '관상'} 풀이 전문가다. 유료 상품의 결과지이므로 충분한 분량과 깊이로 쓴다.
말투: 차분하고 신뢰감 있는 정통 존댓말(~합니다, ~입니다, ~해 보세요)로 통일한다. ~하오·~하시게·~구려 같은 사극체와 캐릭터 말투는 쓰지 않는다.
사진에서 실제로 보이는 특징(${palm ? '선의 길이·굵기·갈래·휘어짐·끊김, 손바닥 넓이, 손가락 길이, 엄지 아래 두께' : '얼굴형, 이마 넓이, 눈썹 모양, 눈매, 콧대·콧방울, 입술·입꼬리, 귀 모양, 턱선'})을 근거로 짚어 "내 ${palm ? '손' : '얼굴'} 이야기 같다"는 느낌을 준다. 누구에게나 맞는 일반론보다 보이는 특징에 맞춘 개인화된 문장을 우선한다.
전문 용어를 쓰면 바로 쉬운 설명을 붙인다. 같은 표현·좋은 말을 반복하지 않는다.
단정·공포 금지(죽음·이혼·파산·병 단정 금지), 의료·투자 권유 금지, 외모 평가·비하 금지. 어려운 부분도 대처법과 함께 희망적으로 쓴다.
${palm ? '손바닥' : '사람의 얼굴 정면'}이 아니거나 너무 흐려 볼 수 없으면 {"error":"unclear"} 만 출력한다.
출력은 JSON 하나만:
{"intro": string(총평 3~4문장),
 "overview": {"title": "${palm ? '손의 모양과 기운' : '얼굴형과 삼정(三停)'}", "body": string(4~6문장, ${palm ? '손바닥·손가락 모양과 전체 기운' : '얼굴형과 상정·중정·하정 균형'})},
 "sections": [{"key": string, "feature": string(사진에서 보이는 모습 1~2문장), "body": string(풀이 5~7문장, 350~550자), "advice": string(실천 조언 1~2문장)}],
 "timeline": [{"label": string, "body": string(2~3문장)}] (초년·중년·말년 3개),
 "tips": [string, string, string] (복을 키우는 생활 습관, 각 40자 안팎),
 "closing": string(마무리 3문장)}
sections 는 정확히 이 순서·key 로 7개: ${PARTS[kind].map((p) => `${p.key}=${p.title}`).join(', ')}`;
};

export async function analyzePhoto(kind: PhotoKind, image: string, http: typeof fetch): Promise<PhotoResult | { error: 'unclear' }> {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(image);
  if (!m) throw new Error('사진 형식');
  const r = await http('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.PHOTO_AI_MODEL || 'claude-sonnet-5-5', max_tokens: 9000, system: SYSTEM(kind),
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: m[1] === 'image/jpg' ? 'image/jpeg' : m[1], data: m[2] } }, { type: 'text', text: `이 ${kind === 'palm' ? '손바닥' : '얼굴'} 사진으로 풀이해 주세요.` }] }],
    }),
    signal: AbortSignal.timeout(150_000),
  });
  if (!r.ok) { await recordAiFailure(r as any); throw new Error(`AI 호출 실패 ${r.status}`); }
  recordAiOk();
  const j = (await r.json()) as any;
  const text = (j.content ?? []).map((c: any) => c.text ?? '').join('');
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  if (json.error) return { error: 'unclear' };
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const by = new Map<string, any>((json.sections ?? []).map((x: any) => [x.key, x]));
  const base = samplePhoto(kind);
  const tl = Array.isArray(json.timeline) ? json.timeline.map((t: any) => ({ label: str(t?.label), body: str(t?.body) })).filter((t: any) => t.label && t.body) : [];
  const tips = Array.isArray(json.tips) ? json.tips.map(str).filter(Boolean).slice(0, 3) : [];
  return {
    title: `나의 ${kind === 'palm' ? '손금' : '관상'} 풀이`, intro: str(json.intro) || base.intro, closing: str(json.closing) || base.closing, generatedBy: 'ai',
    overview: { title: str(json.overview?.title) || base.overview!.title, body: str(json.overview?.body) || base.overview!.body },
    sections: PARTS[kind].map((p, i) => {
      const x = by.get(p.key) ?? {};
      const body = str(x.body);
      // 본문이 비면 예시 문장 대신 보이는 모습·조언까지 예시로 채운다(섞이면 어색하므로 통째로)
      return body ? { ...p, feature: str(x.feature), body, advice: str(x.advice) } : base.sections[i];
    }),
    timeline: tl.length === 3 ? tl : base.timeline, tips: tips.length === 3 ? tips : base.tips,
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

// 유료 타로 AI 풀이 — 질문 주제에 맞춰 자리마다 해석 + 종합 + 현실 조언(대표님 3차: "단순 카드 의미가 아니라 질문 주제에 맞는 해석과 현실적인 조언").
// 카드는 화면과 같은 규칙(주문 번호 시드, @naman/content tarotSpread)으로 서버에서도 똑같이 뽑는다 — 사용자가 고른 순서대로 같은 카드가 드러남.
// AI 가 꺼져 있거나 실패하면 화면이 카드 기본 문장으로 대신 보여 준다(무료 예비 풀이).
import { tarotSpread, tarotSide } from '@naman/content';
import { callClaudeLong } from './reading/long.ts';

export type TarotInput = { question?: string; a?: string; b?: string };
export type TarotAI = {
  positions: { title: string; text: string }[];
  summary: { title: string; text: string };
  advice: string[];
  keywords: string[];
  answer?: string; // 가능성·시기를 묻는 주제의 한 줄 답(예: "연락 가능성 높음 · 2~3주 안")
};

// 주제별 읽는 관점 — 질문의 성격과 꼭 답해야 할 것
export const TAROT_TOPICS: Record<string, { focus: string; must: string; choice?: boolean }> = {
  tarot_love: { focus: '연애와 그 사람의 마음', must: '두 사람 관계의 현재와 다가가는 방법' },
  tarot_money: { focus: '재물과 돈의 흐름', must: '돈이 들어오는 때와 새는 곳, 지금 할 일' },
  tarot_work: { focus: '일·직장·진로', must: '지금 일의 방향과 선택' },
  tarot_reunion: { focus: '헤어진 사람과의 재회', must: '헤어진 이유, 지금 거리, 그 사람 마음, 재회 가능성과 시기(몇 주·몇 달 단위), 재회를 위한 구체적인 방법' },
  tarot_mind: { focus: '그 사람의 속마음', must: '그 사람이 겉으로 보이는 마음과 실제 속마음의 차이, 앞으로 마음이 어떻게 움직일지' },
  tarot_contact: { focus: '그 사람에게 연락이 올지', must: '연락 가능성(높음·보통·낮음 중 하나), 연락이 올 만한 시기(며칠·몇 주 단위)와 계기, 먼저 연락해도 될지' },
  tarot_newlove: { focus: '새로운 인연', must: '인연이 다가오는 시기, 어떤 사람인지(성향·분위기), 어디서 어떻게 만나는지' },
  tarot_match: { focus: '두 사람의 궁합', must: '서로의 마음, 끌리는 점과 부딪히는 점, 관계의 지금과 앞날' },
  tarot_choice: { focus: '두 가지 선택지 중 무엇이 나은지', must: 'A와 B 각각을 골랐을 때의 흐름과 결과를 비교하고, 어느 쪽이 나은지 분명하게 권하기', choice: true },
  tarot_job: { focus: '이직·취업·합격의 타이밍', must: '지금 자리에 머무를지 움직일지, 합격·이직 기운, 가장 좋은 시기(몇 달 단위)' },
  tarot_people: { focus: '인간관계(직장·친구·가족)', must: '지금 두 사람 관계의 상태, 갈등의 숨은 원인, 관계를 푸는 구체적인 말과 행동, 거리를 두는 게 나을 때의 신호' },
  tarot_3month: { focus: '앞으로 석 달의 흐름', must: '첫째·둘째·셋째 달 각각의 흐름과 그달에 할 일' },
  tarot_spread3: { focus: '과거·현재·미래의 흐름', must: '지나온 일, 지금, 앞으로의 방향' },
  tarot_celtic: { focus: '한 가지 고민을 깊이 읽기', must: '고민의 핵심, 막힌 것, 숨은 원인, 가까운 미래, 최종 결과와 조언' },
};

export function tarotCards(orderId: string, productId: string, n: number) {
  return tarotSpread(`${orderId}:${productId}`, n);
}

function prompt(p: { id: string; title: string; positions: string[] }, cards: ReturnType<typeof tarotCards>, input: TarotInput, name: string) {
  const t = TAROT_TOPICS[p.id] ?? { focus: p.title, must: '질문에 대한 답과 현실 조언' };
  const lines = cards.map((d, i) => {
    const s = tarotSide(d);
    return `${i + 1}. 자리 "${p.positions[i]}" — ${d.card.nameEn} (${d.card.nameKo}) ${d.reversed ? '역방향' : '정방향'} · 키워드 ${s.keywords.join(', ')}`;
  });
  const q = input.question?.trim() ? `질문: "${input.question.trim().slice(0, 200)}"` : '질문: (따로 적지 않음 — 주제 전반을 읽는다)';
  const ch = t.choice ? `\n선택지 A: "${(input.a ?? 'A').slice(0, 60)}" / 선택지 B: "${(input.b ?? 'B').slice(0, 60)}" (자리 이름의 A·B 는 이 선택지를 뜻한다)` : '';
  return {
    system: `당신은 다정하지만 솔직한 타로 리더 "월하선녀"다. 해요체(~해요, ~예요)로 쓴다.
- 카드의 일반적인 뜻을 늘어놓지 말고, 이 질문과 이 자리에서 그 카드가 무엇을 말하는지 해석한다(라이더-웨이트 상징을 근거로 한 문장 정도 언급).
- 반드시 다룰 것: ${t.must}.
- 불안을 키우는 단정(헤어짐 확정·절대 안 됨 등)이나 의료·법률·투자 지시는 하지 않는다. 어려운 카드도 대처법과 함께 쓴다.
- 현실적인 조언은 오늘·이번 주에 바로 할 수 있는 구체적인 행동으로.
- 출력은 JSON 하나만: {"positions":[{"title":string(자리 해석 제목 20자 안팎),"text":string(3~5문장)}],"summary":{"title":string,"text":string(4~6문장 종합)},"advice":[string,string,string](실천 조언, 각 40자 안팎),"keywords":[string,string,string],"answer":string(가능성·시기·선택을 묻는 주제면 한 줄 답, 아니면 빈 문자열)}`,
    user: `주제: ${p.title} (${t.focus})
이름: ${name || '고객'} 님
${q}${ch}

뽑힌 카드(자리 순서):
${lines.join('\n')}`,
  };
}

export async function generateTarot(p: { id: string; title: string; positions: string[] }, orderId: string, input: TarotInput, name: string, http: typeof fetch = fetch) {
  const cards = tarotCards(orderId, p.id, p.positions.length);
  const { system, user } = prompt(p, cards, input, name);
  const r = await callClaudeLong(system, user, 2500 + p.positions.length * 450, http);
  const j = r.json as any;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const ai: TarotAI = {
    positions: p.positions.map((pos, i) => ({ title: str(j.positions?.[i]?.title) || pos, text: str(j.positions?.[i]?.text) })),
    summary: { title: str(j.summary?.title), text: str(j.summary?.text) },
    advice: (Array.isArray(j.advice) ? j.advice : []).map(str).filter(Boolean).slice(0, 3),
    keywords: (Array.isArray(j.keywords) ? j.keywords : []).map(str).filter(Boolean).slice(0, 3),
    ...(str(j.answer) ? { answer: str(j.answer) } : {}),
  };
  if (ai.positions.some((x) => !x.text) || !ai.summary.text) throw new Error('AI 응답이 비어 있어요');
  const rate = { inp: +(process.env.AI_PRICE_IN_PER_M ?? 2), out: +(process.env.AI_PRICE_OUT_PER_M ?? 10) };
  return { ai, tokensIn: r.tokensIn, tokensOut: r.tokensOut, costKrw: Math.round(((r.tokensIn * rate.inp + r.tokensOut * rate.out) / 1e6) * 1400) };
}

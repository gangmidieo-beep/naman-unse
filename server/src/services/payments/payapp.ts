// 웹 결제 — PayApp(페이앱). 대표님 PayApp 판매자 계정의 아이디·연동키(linkkey)·연동값(linkval)을 .env 에만 넣는다.
// 결제 요청: https://api.payapp.kr/oapi/apiLoad.html (cmd=payrequest) → payurl 로 이동 → 결제 완료 시 feedbackurl 로 통보(form) → "SUCCESS" 응답.
import { timingSafeEqual } from 'node:crypto';

export type PayAppEnv = { userid: string; linkkey: string; linkval: string };
export const payappEnv = (): PayAppEnv | null => {
  const userid = process.env.PAYAPP_USERID ?? '';
  const linkkey = process.env.PAYAPP_LINKKEY ?? '';
  const linkval = process.env.PAYAPP_LINKVAL ?? '';
  return userid && linkkey && linkval ? { userid, linkkey, linkval } : null;
};

// pay_state → 우리 주문 상태
// 70·71 = 부분취소: 일부 금액만 돌려준 것 — 풀이·구독은 그대로 두고 기록만(예전엔 전부 회수했다)
const STATES: Record<string, 'paid' | 'cancelled' | 'refunded' | 'failed' | 'partial'> = {
  '4': 'paid',
  '99': 'failed', // 정기결제 2회차 이후 승인 실패(failurl 로 통보)
  '8': 'cancelled', '16': 'cancelled', '31': 'cancelled', '32': 'cancelled',
  '9': 'refunded', '64': 'refunded', '70': 'partial', '71': 'partial',
};

// 휴대폰 번호: 하이픈·공백·+82 제거 → 01X 로 시작하는 10~11자리만 허용
export function normalizePhone(raw: string): string | null {
  let d = String(raw ?? '').replace(/[^\d+]/g, '');
  if (d.startsWith('+82')) d = '0' + d.slice(3);
  d = d.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

export type PayRequest = { orderId: string; amount: number; goodName: string; phone: string; returnUrl: string; feedbackUrl: string; openpaytype?: string };

export async function payappRequest(req: PayRequest, env: PayAppEnv, http: typeof fetch = fetch): Promise<{ payUrl: string; mulNo: string }> {
  const form = new URLSearchParams({
    cmd: 'payrequest', userid: env.userid, goodname: req.goodName.slice(0, 40), price: String(req.amount), recvphone: req.phone,
    feedbackurl: req.feedbackUrl, returnurl: req.returnUrl, var1: req.orderId, smsuse: 'n', checkretry: 'y', skip_cstpage: 'y',
    ...(req.openpaytype ? { openpaytype: req.openpaytype } : {}),
  });
  let res: Response;
  try {
    res = await http('https://api.payapp.kr/oapi/apiLoad.html', { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw Object.assign(new Error('결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요.'), { status: 502 });
  }
  const data = new URLSearchParams(await res.text());
  if (data.get('state') !== '1') throw Object.assign(new Error(data.get('errorMessage') || '결제 요청이 거절됐어요'), { status: 502 });
  let url: URL;
  try { url = new URL(data.get('payurl') ?? ''); } catch { throw Object.assign(new Error('결제 주소가 올바르지 않아요'), { status: 502 }); }
  if (url.protocol !== 'https:' || !(url.hostname === 'payapp.kr' || url.hostname.endsWith('.payapp.kr'))) throw Object.assign(new Error('결제 주소가 올바르지 않아요'), { status: 502 });
  return { payUrl: url.href, mulNo: data.get('mul_no') ?? '' };
}

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

// 통보 검증: userid·linkkey·linkval 이 모두 맞아야 한다. linkkey 의 '+' 가 form 전송 중 공백으로 바뀌는 일이 있어 양쪽을 같은 규칙으로 정규화.
export function parsePayappFeedback(body: Record<string, unknown>, env: PayAppEnv, log: (m: string) => void = () => {}) {
  const norm = (v: unknown) => String(v ?? '').trim().replace(/ /g, '+');
  const bad = ([['userid', body.userid, env.userid], ['linkkey', body.linkkey, env.linkkey], ['linkval', body.linkval, env.linkval]] as const)
    .filter(([, got, want]) => !same(norm(got), norm(want)));
  if (bad.length) {
    for (const [f, got] of bad) log(`[payapp] 통보 검증 실패 field=${f} got=${norm(got).slice(0, 4)}…(${norm(got).length})`); // 값 전체는 남기지 않음
    return null;
  }
  return {
    orderId: String(body.var1 ?? ''),
    mulNo: String(body.mul_no ?? ''),
    amount: Number(body.price ?? NaN),
    state: STATES[String(body.pay_state)] ?? null,
    method: String(body.pay_type ?? ''),
    rebillNo: String(body.rebill_no ?? ''), // 정기결제일 때만 값이 있음
  };
}

// 관리자 환불 → PayApp 결제 취소(cmd=paycancel). 성공해야만 우리 주문을 환불 처리한다.
export async function payappCancel(mulNo: string, memo: string, env: PayAppEnv, http: typeof fetch = fetch): Promise<void> {
  const form = new URLSearchParams({ cmd: 'paycancel', userid: env.userid, linkkey: env.linkkey, mul_no: mulNo, cancelmemo: memo.slice(0, 100) || '관리자 환불' });
  const res = await http('https://api.payapp.kr/oapi/apiLoad.html', { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) });
  const data = new URLSearchParams(await res.text());
  if (data.get('state') !== '1') throw Object.assign(new Error(data.get('errorMessage') || 'PayApp 취소가 거절됐어요'), { status: 502 });
}

/* ---------- 정기결제(월 자동결제) ----------
   cmd=rebillRegist → payurl 에서 구매자가 카드 등록 + 1회차 승인 → 이후 매월 같은 날 PayApp 이 자동 승인하고 feedbackurl 로 통보(rebill_no 포함).
   PayApp 정기결제 주기는 월·주·일만 있어서 "연간 자동결제"는 지원되지 않는다 → 연간은 1년 이용권 + 만료 전 알림.
   카드 번호는 PayApp 결제창에서만 입력(우리 서버는 카드 정보를 받지도 저장하지도 않음). */
const kstDate = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
// 매월 결제일: 오늘(한국 날짜). 29~31일은 짧은 달에 빠지지 않도록 "말일(90)"
export const rebillDay = (now = new Date()) => {
  const [y, m, d] = kstDate(now).split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d >= 29 || d === last ? '90' : String(d); // 2월 28일(말일)에 승인된 말일 결제도 "말일"로 이어지게
};
// 다음 결제 예정일(한국 날짜 기준) — 이용 기간은 여기에 여유 2일을 더해 결제 처리 시간 동안 끊기지 않게
export function nextRebillDate(from: Date, day: string): Date {
  const k = new Date(from.getTime() + 9 * 3600_000);
  const y = k.getUTCFullYear(), m = k.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const dd = day === '90' ? last : Math.min(+day, last);
  return new Date(Date.UTC(y, m, dd) - 9 * 3600_000); // 다음 달 해당 일 00:00 KST
}

export type RebillRequest = { orderId: string; amount: number; goodName: string; phone: string; returnUrl: string; feedbackUrl: string; failUrl: string; now?: Date };
export async function payappRebillRegist(req: RebillRequest, env: PayAppEnv, http: typeof fetch = fetch): Promise<{ payUrl: string; rebillNo: string; day: string }> {
  const now = req.now ?? new Date();
  const day = rebillDay(now);
  const expire = kstDate(new Date(now.getTime() + 5 * 365 * 86_400_000)); // 5년 뒤 만료(해지 전까지 매월)
  const form = new URLSearchParams({
    cmd: 'rebillRegist', userid: env.userid, goodname: req.goodName.slice(0, 40), goodprice: String(req.amount), recvphone: req.phone,
    rebillCycleType: 'Month', rebillCycleMonth: day, rebillExpire: expire,
    feedbackurl: req.feedbackUrl, failurl: req.failUrl, returnurl: req.returnUrl, var1: req.orderId, smsuse: 'n', openpaytype: 'card',
  });
  let res: Response;
  try {
    res = await http('https://api.payapp.kr/oapi/apiLoad.html', { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw Object.assign(new Error('결제창을 열지 못했어요. 잠시 후 다시 시도해 주세요.'), { status: 502 });
  }
  const data = new URLSearchParams(await res.text());
  if (data.get('state') !== '1') throw Object.assign(new Error(data.get('errorMessage') || '정기결제 요청이 거절됐어요'), { status: 502 });
  let url: URL;
  try { url = new URL(data.get('payurl') ?? ''); } catch { throw Object.assign(new Error('결제 주소가 올바르지 않아요'), { status: 502 }); }
  if (!(url.hostname === 'payapp.kr' || url.hostname.endsWith('.payapp.kr'))) throw Object.assign(new Error('결제 주소가 올바르지 않아요'), { status: 502 });
  url.protocol = 'https:'; // 문서 예시가 http 로 오는 경우가 있어 https 로 맞춤
  return { payUrl: url.href, rebillNo: data.get('rebill_no') ?? '', day };
}

// 자동결제 해지 — 다음 달부터 결제되지 않음(이미 낸 기간은 그대로 이용). 이미 해지된 건이면 성공으로 본다.
export async function payappRebillCancel(rebillNo: string, env: PayAppEnv, http: typeof fetch = fetch): Promise<void> {
  const form = new URLSearchParams({ cmd: 'rebillCancel', userid: env.userid, linkkey: env.linkkey, rebill_no: rebillNo });
  const res = await http('https://api.payapp.kr/oapi/apiLoad.html', { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) });
  const data = new URLSearchParams(await res.text());
  if (data.get('state') !== '1' && data.get('errno') !== '20023') throw Object.assign(new Error(data.get('errorMessage') || '자동결제 해지가 거절됐어요'), { status: 502 });
}

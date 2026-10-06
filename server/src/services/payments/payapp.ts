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
const STATES: Record<string, 'paid' | 'cancelled' | 'refunded'> = {
  '4': 'paid',
  '8': 'cancelled', '16': 'cancelled', '31': 'cancelled', '32': 'cancelled',
  '9': 'refunded', '64': 'refunded', '70': 'refunded', '71': 'refunded',
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
  };
}

// 관리자 환불 → PayApp 결제 취소(cmd=paycancel). 성공해야만 우리 주문을 환불 처리한다.
export async function payappCancel(mulNo: string, memo: string, env: PayAppEnv, http: typeof fetch = fetch): Promise<void> {
  const form = new URLSearchParams({ cmd: 'paycancel', userid: env.userid, linkkey: env.linkkey, mul_no: mulNo, cancelmemo: memo.slice(0, 100) || '관리자 환불' });
  const res = await http('https://api.payapp.kr/oapi/apiLoad.html', { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) });
  const data = new URLSearchParams(await res.text());
  if (data.get('state') !== '1') throw Object.assign(new Error(data.get('errorMessage') || 'PayApp 취소가 거절됐어요'), { status: 502 });
}

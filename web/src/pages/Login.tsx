// 간편 로그인 — Google · 카카오 · 네이버. 방식은 서버 OAuth 로 통일: 웹은 서버로 리다이렉트, 앱은 브라우저 창 → 딥링크로 토큰.
// 서버·키가 없으면(MOCK_MODE) 가짜 계정으로 흐름만 완성한다. 게스트로 쓰던 사주·구매는 그대로 이어진다(서버 merge 는 /auth/merge).
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble } from '../components/ui';
import { useApp, newId } from '../store/app';
import { MOCK_MODE } from '../lib/api';
import { track } from '../lib/track';
import { guestToken, pullProfiles, syncEntitlements } from '../platform/payments';


type Provider = 'google' | 'kakao' | 'naver';
// 브랜드 표시(대표님 점검 사항2 예시처럼 카카오 말풍선·네이버 N·구글 G)
const MARK: Record<Provider, ReactElement> = {
  kakao: <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path fill="#191919" d="M12 3.5c-5.2 0-9.4 3.3-9.4 7.4 0 2.6 1.7 4.9 4.3 6.2l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.4 0 .7.1 1.1.1 5.2 0 9.4-3.3 9.4-7.4S17.2 3.5 12 3.5z" /></svg>,
  naver: <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path fill="#fff" d="M15.6 12.7 8.1 2H2v20h6.4V11.3L15.9 22H22V2h-6.4z" /></svg>,
  google: <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" /></svg>,
};
const LABEL: Record<Provider, { t: string; mark: string }> = {
  google: { t: 'Google로 시작하기', mark: 'G' },
  kakao: { t: '카카오로 시작하기', mark: 'K' },
  naver: { t: '네이버로 시작하기', mark: 'N' },
};

export function LoginButtons({ after }: { after?: () => void }) {
  const setAccount = useApp((s) => s.setAccount);
  const login = (p: Provider) => {
    track('login', { provider: p });
    if (MOCK_MODE) {
      setAccount({ provider: 'mock', id: `${p}-${newId()}`, name: `${LABEL[p].t.slice(0, -5)} 계정(테스트)` });
      after?.();
      return;
    }
    // 서버 OAuth 시작 — 끝나면 /auth/callback?token=&nonce= 으로 돌아온다.
    // nonce: 이 브라우저에서 로그인을 시작했다는 표시. 남이 보낸 로그인 링크(그 사람 계정 토큰)를 눌러도 내 기록이 그 계정으로 넘어가지 않게
    const nonce = newId() + newId();
    try { localStorage.setItem(NONCE, JSON.stringify({ v: nonce, at: Date.now() })); } catch { /* 저장소 막힘 */ } // 카카오·네이버 앱을 거쳐 새 탭으로 돌아와도 같은 브라우저면 확인되게(10분 유효)
    location.href = `${__API_ORIGIN__}/auth/${p}/start?redirect=${encodeURIComponent(location.href)}&nonce=${nonce}`;
  };
  // 3차 요청: 회원가입·로그인 버튼(카카오·네이버·구글)을 늘 보여 준다. 대표님이 로그인 키를 아직 등록하지 않은 곳은 눌렀을 때 안내만
  const [ready, setReady] = useState<Provider[] | null>(MOCK_MODE ? (Object.keys(LABEL) as Provider[]) : null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (MOCK_MODE) return;
    fetch(`${__API_ORIGIN__}/auth/providers`).then((r) => r.json()).then((j) => setReady(j.providers ?? [])).catch(() => setReady([]));
  }, []);
  const tap = (p: Provider) => {
    if (ready?.includes(p)) return login(p);
    setMsg(`${LABEL[p].t.replace('로 시작하기', '')} 로그인은 곧 열려요. 지금은 로그인 없이 이 기기에서 그대로 이용하실 수 있어요.`);
  };
  return (
    <div className="loginbox">
      {(['kakao', 'naver', 'google'] as Provider[]).map((p) => (
        <button key={p} className={`sso ${p}${ready && !ready.includes(p) ? ' soon' : ''}`} onClick={() => tap(p)}><i aria-hidden>{MARK[p]}</i>{LABEL[p].t}</button>
      ))}
      {msg && <p className="note center" role="status">{msg}</p>}
    </div>
  );
}

export default function Login() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  return (
    <>
      <SubHeader title="로그인 · 회원가입" sub="유료 풀이·부적을 안전하게 보관해요" />
      <main className="screen no-tab">
        <div className="mt24" />
        <CharacterBubble who="wolha">무료 운세는 로그인 없이도 볼 수 있어요. 풀이를 사면 운세함에 잘 간직해 드릴게요.</CharacterBubble>
        <LoginButtons after={() => nav(sp.get('back') || '/box', { replace: true })} />
        <p className="note" style={{ margin: '16px 18px 0' }}>처음이시면 버튼 한 번으로 회원가입까지 끝나요. 로그인하면 지금까지 이 기기에 저장한 사주 정보와 구매 내역이 계정으로 옮겨져요</p>
      </main>
    </>
  );
}

// OAuth 콜백 — 서버가 ?token=&name=&provider= 로 돌려준다
// 2026-10-29 대표님 제보: 카카오 로그인 후 "로그인 중이에요…"에서 멈춤 — 화면이 붙기 전에(렌더 중) 이동을 시도해서
// 라우터가 이동을 무시했다(저장된 사주가 없으면 바로 이동 → 무시됨). 이동은 화면이 붙은 뒤(useEffect)에, 실패해도 몇 초 뒤 운세함으로.
const NONCE = 'naman-login-nonce';
// 이 브라우저에서 10분 안에 로그인을 시작했는지 + 돌아온 nonce 가 같은지. (서버가 nonce 를 안 돌려주는 예전 버전이면 시작 기록만 확인)
function loginStartedHere(nonce: string | null) {
  try {
    const s = JSON.parse(localStorage.getItem(NONCE) || 'null') as { v: string; at: number } | null; // 지우기는 로그인 처리 때(개발 모드 이중 실행 대비)
    if (!s || Date.now() - s.at > 600_000) return false;
    return nonce ? nonce === s.v : true;
  } catch { return false; }
}
export function AuthCallback() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const raw = sp.get('token');
  const [trusted] = useState(() => !!raw && loginStartedHere(sp.get('nonce')));
  const token = trusted ? raw : null;
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    try { localStorage.removeItem(NONCE); } catch { /* */ } // 한 번 쓴 표시는 버림(같은 링크로 다시 들어와도 로그인 안 됨)
    const { setAccount, profiles, account: before } = useApp.getState();
    // 다른 계정이 이 기기에 로그인돼 있었다면 그 사람 정보는 새 계정으로 올리지 않는다
    if (before?.token && before.id !== sp.get('uid')) useApp.getState().signOut();
    const back = sp.get('back') || '/box';
    const dest = back.startsWith('/') && !back.startsWith('//') && !back.startsWith('/login') && !back.startsWith('/auth/') ? back : '/box';
    const guest = guestToken();
    setAccount({ provider: (sp.get('provider') as Provider) ?? 'google', id: sp.get('uid') ?? '', name: sp.get('name') ?? '회원', token });
    const go = () => nav(dest, { replace: true });
    const fallback = setTimeout(go, 8000); // 네트워크가 느려도 화면에 갇히지 않게
    void (async () => {
      const post = (path: string, body: unknown) => fetch(`${__API_ORIGIN__}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) }).catch(() => null);
      if (guest && guest !== token) await post('/auth/merge', { guestToken: guest }); // 게스트로 산 풀이·부적·구독을 계정으로
      const mine = before?.token && before.id !== sp.get('uid') ? [] : profiles;
      for (const p of mine) {
        const r = await post('/profiles', p); // 이 기기에 저장해 둔 사주 정보를 계정으로(서버가 새 id 를 주면 바꿈)
        const v = r && r.ok ? await r.json().catch(() => null) : null;
        if (v?.id && v.id !== p.id) useApp.setState((s) => ({ profiles: s.profiles.map((x) => (x.id === p.id ? { ...x, id: v.id } : x)), mainId: s.mainId === p.id ? v.id : s.mainId }));
      }
      await pullProfiles(); // 계정에 있는 사주(다른 기기에서 저장한 것)를 이 기기로
      await syncEntitlements().catch(() => null); // 계정에 있는 구매를 운세함에
      clearTimeout(fallback);
      go();
    })();
  }, [token]);
  if (token) return <main className="screen no-tab"><p className="muted center mt24">로그인 중이에요…</p></main>;
  return (
    <>
      <SubHeader title="로그인" />
      <main className="screen no-tab">
        <p className="muted center mt24">{raw ? '이 화면에서 시작한 로그인이 아니어서 안전을 위해 멈췄어요. 아래 버튼으로 다시 로그인해 주세요.' : '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.'}</p>
        <div className="pad mt14"><Button kind="gold" onClick={() => nav('/login', { replace: true })}>다시 로그인하기</Button></div>
        <div className="pad mt14"><Button kind="line" onClick={() => nav('/', { replace: true })}>홈으로</Button></div>
      </main>
    </>
  );
}

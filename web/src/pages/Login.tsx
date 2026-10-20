// 간편 로그인 — Google · 카카오 · 네이버. 방식은 서버 OAuth 로 통일: 웹은 서버로 리다이렉트, 앱은 브라우저 창 → 딥링크로 토큰.
// 서버·키가 없으면(MOCK_MODE) 가짜 계정으로 흐름만 완성한다. 게스트로 쓰던 사주·구매는 그대로 이어진다(서버 merge 는 /auth/merge).
import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { CharacterBubble } from '../components/ui';
import { useApp, newId } from '../store/app';
import { MOCK_MODE } from '../lib/api';
import { track } from '../lib/track';

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
    // 서버 OAuth 시작 — 끝나면 /auth/callback?token= 으로 돌아온다
    location.href = `${__API_ORIGIN__}/auth/${p}/start?redirect=${encodeURIComponent(location.href)}`;
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
export function AuthCallback() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const setAccount = useApp((s) => s.setAccount);
  const token = sp.get('token');
  const profiles = useApp((s) => s.profiles);
  if (token) {
    setAccount({ provider: (sp.get('provider') as Provider) ?? 'google', id: sp.get('uid') ?? '', name: sp.get('name') ?? '회원', token });
    // 이 기기에 저장해 둔 사주 정보를 계정으로 올린다(서버가 게스트 기록 합치기 /auth/merge 와 같은 역할)
    queueMicrotask(async () => {
      for (const p of profiles)
        await fetch(`${__API_ORIGIN__}/profiles`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(p) }).catch(() => {});
      nav(sp.get('back') || '/box', { replace: true });
    });
  }
  return <main className="screen no-tab"><p className="muted center mt24">{token ? '로그인 중이에요…' : '로그인에 실패했어요. 다시 시도해 주세요.'}</p></main>;
}

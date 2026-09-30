// 간편 로그인 — Google · 카카오 · 네이버. 방식은 서버 OAuth 로 통일: 웹은 서버로 리다이렉트, 앱은 브라우저 창 → 딥링크로 토큰.
// 서버·키가 없으면(MOCK_MODE) 가짜 계정으로 흐름만 완성한다. 게스트로 쓰던 사주·구매는 그대로 이어진다(서버 merge 는 /auth/merge).
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { CharacterBubble } from '../components/ui';
import { useApp, newId } from '../store/app';
import { MOCK_MODE } from '../lib/api';
import { track } from '../lib/track';

type Provider = 'google' | 'kakao' | 'naver';
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
  return (
    <div className="loginbox">
      {(Object.keys(LABEL) as Provider[]).map((p) => (
        <button key={p} className={`sso ${p}`} onClick={() => login(p)}><i aria-hidden>{LABEL[p].mark}</i>{LABEL[p].t}</button>
      ))}
    </div>
  );
}

export default function Login() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  return (
    <>
      <SubHeader title="로그인" sub="유료 풀이·부적을 안전하게 보관해요" />
      <main className="screen no-tab">
        <div className="mt24" />
        <CharacterBubble who="wolha">무료 운세는 로그인 없이도 볼 수 있어요. 풀이를 사면 운세함에 잘 간직해 드릴게요.</CharacterBubble>
        <LoginButtons after={() => nav(sp.get('back') || '/box', { replace: true })} />
        <p className="note" style={{ margin: '16px 18px 0' }}>로그인하면 지금까지 이 기기에 저장한 사주 정보와 구매 내역이 계정으로 옮겨져요</p>
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

// 공유 — 채널별 URL·카카오 SDK·Web Share·이미지 저장. 앱(10 단계)은 @capacitor/share 로 기본 공유 분기.
import { saveImageNative } from '../platform/native';
import { toPng } from 'html-to-image';
import { track } from './track';

export type Channel = 'kakao' | 'band' | 'facebook' | 'threads' | 'copy' | 'image' | 'native';
const enc = encodeURIComponent;
export const CHANNELS: Record<Channel, { label: string; mark: string; bg: string; fg: string; href?: (url: string, text: string) => string }> = {
  kakao: { label: '카카오톡', mark: 'K', bg: '#FEE500', fg: '#191919' },
  band: { label: '밴드', mark: 'B', bg: '#06C755', fg: '#FFFFFF', href: (u, t) => `https://band.us/plugin/share?body=${enc(`${t}\n${u}`)}&route=${enc(location.origin)}` },
  facebook: { label: '페이스북', mark: 'f', bg: '#1877F2', fg: '#FFFFFF', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
  threads: { label: '스레드', mark: '@', bg: '#1C1A17', fg: '#FFFFFF', href: (u, t) => `https://www.threads.com/intent/post?text=${enc(t)}&url=${enc(u)}` },
  copy: { label: '링크 복사', mark: '⧉', bg: '#EDE3CC', fg: '#2D2925' },
  image: { label: '이미지 저장', mark: '▣', bg: '#EDE3CC', fg: '#2D2925' },
  native: { label: '더보기', mark: '⋯', bg: '#EDE3CC', fg: '#2D2925' },
};

// 공유 링크 — 서버가 있으면 /s/:code(OG 태그·클릭 추적), 없으면 콘텐츠 주소 + utm
export function shareUrl(path: string, contentId: string) {
  const origin = __PUBLIC_WEB_ORIGIN__ || location.origin;
  const u = new URL(path, origin);
  u.searchParams.set('utm_source', 'share');
  u.searchParams.set('utm_content', contentId);
  return u.toString();
}

// 서버가 있으면 짧은 공유 링크(/s/:code — 미리보기 카드·클릭 집계), 없으면 콘텐츠 주소
export async function shortLink(path: string, contentId: string, title: string, text: string) {
  if (__MOCK_MODE__ || !__API_ORIGIN__) return shareUrl(path, contentId);
  try {
    const r = await fetch(`${__API_ORIGIN__}/share`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contentId, path, title, text }) });
    return (await r.json()).url as string;
  } catch { return shareUrl(path, contentId); }
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
  }
}

export async function shareLink(opts: { title: string; text: string; url?: string }, preferNative = true): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = opts.url ?? location.href;
  track('share', { url });
  if (preferNative && navigator.share) {
    try { await navigator.share({ title: opts.title, text: opts.text, url }); return 'shared'; } catch { return 'cancelled'; }
  }
  await copy(`${opts.text}\n${url}`);
  return 'copied';
}

// 카카오톡 공유 — Kakao JS SDK(피드 템플릿). 키가 없으면 링크 복사로 대신한다.
let kakaoLoading: Promise<any> | null = null;
function loadKakao(key: string) {
  kakaoLoading ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = () => { const K = (window as any).Kakao; if (!K.isInitialized()) K.init(key); res(K); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
  return kakaoLoading;
}
export async function kakaoShare(o: { title: string; text: string; url: string; imageUrl?: string }): Promise<'shared' | 'copied'> {
  const key = __KAKAO_JS_KEY__;
  if (!key) { await copy(`${o.text}\n${o.url}`); return 'copied'; }
  const K = await loadKakao(key);
  K.Share.sendDefault({
    objectType: 'feed',
    content: { title: o.title, description: o.text, imageUrl: o.imageUrl ?? `${location.origin}/img/share-default.png`, link: { mobileWebUrl: o.url, webUrl: o.url } },
    buttons: [{ title: '나도 보러 가기', link: { mobileWebUrl: o.url, webUrl: o.url } }],
  });
  return 'shared';
}

// 결과 카드를 이미지로 저장 — 카드는 540×675(CSS px) 로 그리고 2배로 뽑아 1080×1350.
export async function saveImage(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { pixelRatio: 1080 / node.offsetWidth, cacheBust: true, backgroundColor: '#F5EFE1' });
  if (await saveImageNative(dataUrl, filename)) { track('share', { kind: 'image', filename }); return dataUrl; } // 앱: 저장 후 공유 시트
  // data: 주소 대신 blob 주소 + 문서에 붙였다 떼기 — 일부 브라우저가 파일 이름을 무시하는 문제 방지
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  track('share', { kind: 'image', filename });
  return dataUrl;
}

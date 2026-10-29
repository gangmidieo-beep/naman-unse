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
    // 짧은 공유 링크(/s/:code)면 서버가 그린 카드(로고·날짜·점수·버튼)를 미리보기 그림으로
    content: { title: o.title, description: o.text, imageUrl: o.imageUrl ?? (/\/s\/[\w-]+$/.test(o.url) ? `${o.url}/card.png` : `${location.origin}/img/share-default.png`), link: { mobileWebUrl: o.url, webUrl: o.url } },
    buttons: [{ title: '나만의 운세 확인하러 가기', link: { mobileWebUrl: o.url, webUrl: o.url } }],
  });
  return 'shared';
}

// 결과 카드를 이미지로 저장 — 카드는 540×675(CSS px) 로 그리고 2배로 뽑아 1080×1350.
/* 이미지 내려받기 — 카카오톡·인스타그램 등 앱 안 브라우저는 '내려받기'가 아무 반응 없이 무시된다(저장했다는 안내만 뜨던 문제).
   그런 곳에서는 이미지를 화면 가득 띄우고 "길게 눌러 저장"을 안내한다. 반환값: 'download' | 'longpress' */
export const inAppBrowser = () => /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps|everytimeApp|BAND\//i.test(navigator.userAgent);
export let lastSaveMode: 'download' | 'longpress' = 'download';
export async function downloadDataUrl(dataUrl: string, filename: string) {
  if (inAppBrowser()) { showLongPress(dataUrl); lastSaveMode = 'longpress'; return 'longpress' as const; }
  // data: 주소 대신 blob 주소 + 문서에 붙였다 떼기 — 일부 브라우저가 파일 이름을 무시하는 문제 방지
  const blob = await (await fetch(dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // 한글 파일 이름은 일부 브라우저가 무시하고 "download" 로 저장 → 영문·숫자로만
  a.download = `naman-unse_${filename.replace(/\.png$/i, '').replace(/[^\w.-]+/g, '').replace(/^_+/, '') || Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  lastSaveMode = 'download';
  return 'download' as const;
}
function showLongPress(src: string) {
  const bg = document.createElement('div');
  bg.setAttribute('role', 'dialog');
  bg.setAttribute('aria-label', '이미지 저장');
  bg.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(20,16,12,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:14px';
  const tip = document.createElement('p');
  tip.textContent = '이미지를 길게 눌러 ‘사진에 저장’(또는 ‘이미지 저장’)을 눌러 주세요';
  tip.style.cssText = 'color:#F5EFE1;font-size:18px;line-height:1.6;text-align:center;margin:0';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '저장할 이미지';
  img.style.cssText = 'max-width:100%;max-height:70vh;border-radius:8px;-webkit-touch-callout:default;user-select:auto';
  const close = document.createElement('button');
  close.textContent = '닫기';
  close.style.cssText = 'font-size:18px;padding:12px 28px;border-radius:24px;border:1px solid #C9A45C;background:transparent;color:#F5EFE1';
  close.onclick = () => bg.remove();
  bg.append(tip, img, close);
  document.body.appendChild(bg);
}
export async function saveImage(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { pixelRatio: 1080 / node.offsetWidth, cacheBust: true, backgroundColor: '#F5EFE1' });
  if (await saveImageNative(dataUrl, filename)) { track('share', { kind: 'image', filename }); return dataUrl; } // 앱: 저장 후 공유 시트
  await downloadDataUrl(dataUrl, filename);
  track('share', { kind: 'image', filename });
  return dataUrl;
}

/** 부적 저장 — 화면을 캡처하지 않고 부적 그림 파일을 그대로 PNG 로 저장(2026-10-29 대표님 제보).
 *  예전 방식(화면 캡처)은 휴대폰에서 등장 애니메이션 때문에 부적이 한쪽으로 밀려 잘리고,
 *  PC 에서는 그림을 늦게 불러오는 설정(lazy) 때문에 빈 흰 화면만 저장됐다. */
export async function saveTalismanImage(src: string, filename: string) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  const pad = Math.round(img.naturalWidth * 0.06);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth + pad * 2;
  c.height = img.naturalHeight + pad * 2;
  const g = c.getContext('2d')!;
  g.fillStyle = '#1C1612'; // 먹색 바탕 위에 부적(앱 화면과 같은 느낌)
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, pad, pad);
  const dataUrl = c.toDataURL('image/png');
  if (await saveImageNative(dataUrl, filename)) { track('share', { kind: 'image', filename }); return dataUrl; }
  await downloadDataUrl(dataUrl, filename);
  track('share', { kind: 'image', filename });
  return dataUrl;
}

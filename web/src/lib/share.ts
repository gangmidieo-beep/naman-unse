// 공유 — 웹: Web Share API(없으면 링크 복사). 앱: 10 단계에서 @capacitor/share 로 분기.
import { toPng } from 'html-to-image';
import { track } from './track';

export async function shareLink(opts: { title: string; text: string; url?: string }): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = opts.url ?? location.href;
  track('share', { url });
  if (navigator.share) {
    try { await navigator.share({ title: opts.title, text: opts.text, url }); return 'shared'; } catch { return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(`${opts.text}\n${url}`); } catch {
    const t = document.createElement('textarea');
    t.value = `${opts.text}\n${url}`;
    document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
  }
  return 'copied';
}

// 결과 카드를 이미지로 저장 — 카드는 540×675(CSS px) 로 그리고 2배로 뽑아 1080×1350.
export async function saveImage(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { pixelRatio: 1080 / node.offsetWidth, cacheBust: true, backgroundColor: '#FBF7EE' });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
  track('share', { kind: 'image', filename });
  return dataUrl;
}

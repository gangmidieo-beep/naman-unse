// 공유 시트 — 카카오톡 · 밴드 · 페이스북 · 스레드 · 링크 복사 · 이미지 저장 · (지원 시) 기본 공유.
// 채널별 방식은 공식 문서 기준(2026-09-30 확인): 카카오톡=Kakao JS SDK(키 필요, 없으면 링크 복사), 밴드=band.us/plugin/share,
// 페이스북=facebook.com/sharer, 스레드=threads.com/intent/post. 카카오스토리는 API 종료(2023-11-15)로 숨김 — 결정필요 D14.
import { type RefObject } from 'react';
import { BottomSheet } from './ui';
import { saveImage, shareLink, shortLink, kakaoShare, CHANNELS, type Channel } from '../lib/share';
import { track } from '../lib/track';

export function ShareSheet({ open, onClose, card, title, text, path, contentId, onDone, imageName }: {
  open: boolean; onClose: () => void; card?: RefObject<HTMLDivElement>; title: string; text: string; path: string; contentId: string;
  onDone?: (msg?: string) => void; imageName?: string;
}) {
  const go = async (c: Channel) => {
    track('share_click', { channel: c, contentId });
    const url = c === 'image' ? '' : await shortLink(path, contentId, title, text);
    if (c === 'kakao') {
      const r = await kakaoShare({ title, text, url });
      onDone?.(r === 'copied' ? '카카오톡 연결 전이라 링크를 복사했어요. 카카오톡에 붙여 넣어 보내세요' : undefined);
    } else if (c === 'copy' || c === 'native') {
      const r = await shareLink({ title, text, url }, c === 'native');
      if (r === 'copied') onDone?.('링크를 복사했어요');
    } else if (c === 'image') {
      if (card?.current) { await saveImage(card.current, imageName ?? `나만의운세_${contentId}.png`); onDone?.('이미지로 저장했어요'); }
    } else {
      window.open(CHANNELS[c].href!(url, text), '_blank', 'noopener,width=600,height=640');
    }
    onClose();
  };
  const list: Channel[] = ['kakao', 'band', 'facebook', 'threads', 'copy', ...(card ? (['image'] as Channel[]) : []), ...(typeof navigator.share === 'function' ? (['native'] as Channel[]) : [])];
  return (
    <BottomSheet open={open} onClose={onClose} title="공유하기">
      <div className="sharegrid">
        {list.map((c) => (
          <button key={c} onClick={() => go(c)} aria-label={CHANNELS[c].label}>
            <i style={{ background: CHANNELS[c].bg, color: CHANNELS[c].fg }} aria-hidden>{CHANNELS[c].mark}</i>
            {CHANNELS[c].label}
          </button>
        ))}
      </div>
      <p className="note">공유 카드에는 ‘나만의 운세’ 로고와 이 화면으로 오는 링크가 들어가요</p>
    </BottomSheet>
  );
}

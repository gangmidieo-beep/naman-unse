// 이미지 저장용 결과 카드(화면 밖에 그려 두고 html-to-image 로 1080×1350 저장). 워터마크 "나만의 운세".
import { forwardRef, type ReactNode } from 'react';

export const ShareCard = forwardRef<HTMLDivElement, { title: string; sub?: string; children: ReactNode }>(function ShareCard({ title, sub, children }, ref) {
  return (
    <div className="share-stage" aria-hidden>
      <div className="share-card" ref={ref}>
        <div className="share-head"><span className="seal">運</span><b>{title}</b>{sub && <small>{sub}</small>}</div>
        <div className="share-body">{children}</div>
        <div className="share-mark">나만의 운세</div>
      </div>
    </div>
  );
});

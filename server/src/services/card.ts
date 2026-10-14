// 공유 카드 이미지(서버 생성) — 가로 1200×630(링크 미리보기 OG), 세로 1080×1350(이미지 공유).
// 글꼴: SVG 는 서버 시스템 글꼴을 쓴다 → Dockerfile 에서 fonts-noto-cjk 설치(윈도우 개발 PC 는 맑은 고딕).
import sharp from 'sharp';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 한글은 글자 폭이 거의 같으므로 글자 수로 줄바꿈
function wrap(text: string, perLine: number, maxLines: number) {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > perLine) { out.push(line.trim()); line = word; } else line += ' ' + word;
    if (out.length === maxLines) break;
  }
  if (out.length < maxLines && line.trim()) out.push(line.trim());
  if (out.length === maxLines && text.replace(/\s+/g, '').length > out.join('').replace(/\s+/g, '').length) out[maxLines - 1] = out[maxLines - 1].replace(/.$/, '…');
  return out;
}
const FONT = `'Noto Serif CJK KR','Noto Serif KR','Malgun Gothic','NanumMyeongjo',serif`;

// 3차 요청(2026-10-14) 공유 카드 형식: 나만의 운세 로고 → 날짜·콘텐츠 → "OOO 님의 오늘의 운세" → 점수·별 → [나만의 운세 확인하러 가기]
export async function shareCard(o: { title: string; text: string; url: string; size: 'wide' | 'tall' }) {
  const wide = o.size === 'wide';
  const [W, H] = wide ? [1200, 630] : [1080, 1350];
  const pad = wide ? 64 : 80;
  const fs = wide ? 40 : 54;
  const textLines = o.text.split('\n').flatMap((t) => wrap(t, wide ? 28 : 22, wide ? 2 : 5)).slice(0, wide ? 3 : 7);
  const titleY = pad + fs * 2.9;
  const bodyY = titleY + fs * 1.5;
  const btnW = wide ? 520 : 720, btnH = wide ? 74 : 104, btnY = H - pad - btnH - (wide ? 4 : 30);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C5A16"/><stop offset=".28" stop-color="#C99A3A"/><stop offset=".5" stop-color="#F2D98E"/><stop offset=".72" stop-color="#C99A3A"/><stop offset="1" stop-color="#7C5A16"/></linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A2621"/><stop offset=".55" stop-color="#1C1A17"/><stop offset="1" stop-color="#12110F"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="28" fill="url(#ink)"/>
  <rect x="${pad - 18}" y="${pad - 18}" width="${W - 2 * pad + 36}" height="${H - 2 * pad + 36}" rx="18" fill="none" stroke="#B8892E" stroke-opacity=".45" stroke-width="2"/>
  <rect x="${pad}" y="${pad}" width="${fs * 1.1}" height="${fs * 1.1}" rx="6" fill="#A8291E"/>
  <text x="${pad + fs * 0.55}" y="${pad + fs * 0.85}" font-size="${fs * 0.72}" fill="#F8E9C8" text-anchor="middle" font-family="${FONT}">運</text>
  <text x="${pad + fs * 1.4}" y="${pad + fs * 0.86}" font-size="${fs * 0.8}" font-weight="900" fill="#E6C877" font-family="${FONT}">나만의 운세</text>
  <text x="${pad}" y="${titleY}" font-size="${fs * 1.12}" font-weight="900" fill="#F8EFD9" font-family="${FONT}">${esc(o.title)}</text>
  ${textLines.map((l, i) => `<text x="${pad}" y="${bodyY + i * fs * 1.45}" font-size="${fs * (/[★☆]/.test(l) ? 1.05 : 0.86)}" fill="${/[★☆]/.test(l) ? '#F2D98E' : '#E3D7BC'}" font-family="${FONT}">${esc(l)}</text>`).join('\n  ')}
  <rect x="${(W - btnW) / 2}" y="${btnY}" width="${btnW}" height="${btnH}" rx="${btnH / 2}" fill="url(#g)"/>
  <text x="${W / 2}" y="${btnY + btnH * 0.64}" font-size="${fs * 0.78}" font-weight="900" fill="#24180A" text-anchor="middle" font-family="${FONT}">나만의 운세 확인하러 가기 ›</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

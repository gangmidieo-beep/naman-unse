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

export async function shareCard(o: { title: string; text: string; url: string; size: 'wide' | 'tall' }) {
  const [W, H] = o.size === 'wide' ? [1200, 630] : [1080, 1350];
  const pad = o.size === 'wide' ? 64 : 80;
  const lines = wrap(o.text, o.size === 'wide' ? 26 : 18, o.size === 'wide' ? 4 : 8);
  const fs = o.size === 'wide' ? 40 : 54;
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
  <text x="${pad + fs * 1.4}" y="${pad + fs * 0.86}" font-size="${fs * 0.8}" font-weight="900" fill="#E6C877" font-family="${FONT}">${esc(o.title)}</text>
  ${lines.map((l, i) => `<text x="${pad}" y="${pad + fs * 2.6 + i * fs * 1.55}" font-size="${fs}" fill="#F4EBD6" font-family="${FONT}">${esc(l)}</text>`).join('\n  ')}
  <text x="${pad}" y="${H - pad}" font-size="${fs * 0.55}" fill="#CFC3A8" font-family="${FONT}">${esc(o.url.replace(/^https?:\/\//, ''))}</text>
  <text x="${W - pad}" y="${H - pad}" font-size="${fs * 0.8}" fill="#E6C877" text-anchor="end" font-family="${FONT}">나만의 운세</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

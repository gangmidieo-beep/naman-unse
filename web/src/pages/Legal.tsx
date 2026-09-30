// /privacy · /terms · /contact — 애드센스 심사·스토어 등록에 필요한 정적 페이지. 사업자 정보는 brand.config.json business 에서.
// 초안이다: 대표님 사업자 정보가 들어오면 빈칸이 자동으로 채워지고, 문구는 법무 확인 후 확정(내할일.md).
import type { ReactNode } from 'react';
import { SubHeader } from '../components/layout';
import { BRAND } from '../lib/catalog';

const biz = BRAND.business;
const v = (x: string) => x || '(준비 중)';
const NAME = '나만의 운세';

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <SubHeader title={title} sub={NAME} />
      <main className="screen legal">{children}</main>
    </>
  );
}

export function Privacy() {
  return (
    <Doc title="개인정보처리방침">
      <p>{v(biz.name)}(이하 “회사”)는 {NAME} 서비스를 이용하는 분의 개인정보를 소중히 다루며, 개인정보 보호법 등 관련 법령을 지킵니다.</p>
      <h2>1. 모으는 정보와 목적</h2>
      <ul>
        <li>사주 정보(이름 또는 별명, 성별, 생년월일, 태어난 시각): 운세·풀이 제공</li>
        <li>간편 로그인 정보(구글·카카오·네이버 계정 식별값, 이름): 구매 내역·풀이 보관</li>
        <li>결제 기록(주문 번호, 상품, 금액, 결제 일시): 결제·환불 처리, 법정 보관</li>
        <li>이용 기록(방문 화면, 기기 종류, 유입 경로): 서비스 개선·통계</li>
        <li>손금·관상 사진: 풀이에만 쓰고 풀이 직후 바로 삭제하며 저장하지 않습니다</li>
      </ul>
      <h2>2. 보관 기간</h2>
      <p>회원 탈퇴 시 바로 삭제합니다. 다만 전자상거래법에 따라 계약·결제 기록은 5년, 소비자 불만·분쟁 기록은 3년 보관합니다.</p>
      <h2>3. 제3자 제공·처리 위탁</h2>
      <p>법령에 따른 경우를 빼고 다른 곳에 제공하지 않습니다. 결제(결제 대행사·구글 플레이), 서버 운영(클라우드 사업자), 광고(구글 애드센스·애드몹)를 위해 필요한 범위에서만 위탁합니다.</p>
      <h2>4. 광고와 쿠키</h2>
      <p>웹에서는 구글 애드센스 광고가 표시될 수 있으며, 구글은 쿠키를 사용해 관심사 기반 광고를 보여줄 수 있습니다. 구글 광고 설정(adssettings.google.com)에서 맞춤 광고를 끌 수 있습니다. 프리미엄 회원에게는 광고가 표시되지 않습니다.</p>
      <h2>5. 이용자의 권리</h2>
      <p>언제든 내 정보의 열람·수정·삭제·처리 정지를 요청할 수 있습니다. 앱의 ‘운세함 → 사주 정보 관리’ 또는 아래 연락처로 요청해 주세요.</p>
      <h2>6. 개인정보 보호책임자</h2>
      <p>대표 {v(biz.ceo)} · 연락처 {v(biz.contact)}</p>
      <p className="muted">시행일: 서비스 정식 오픈일</p>
    </Doc>
  );
}

export function Terms() {
  return (
    <Doc title="이용약관">
      <h2>제1조 목적</h2>
      <p>이 약관은 {v(biz.name)}가 제공하는 {NAME} 서비스의 이용 조건과 절차를 정합니다.</p>
      <h2>제2조 서비스 내용</h2>
      <p>오늘의 운세·재미로 보는 운세(무료), 사주·궁합·타로·손금·관상 풀이와 부적(유료), 프리미엄 구독을 제공합니다. 모든 풀이는 전통 명리·타로에 바탕한 참고용 콘텐츠이며 의학·법률·투자 판단을 대신하지 않습니다.</p>
      <h2>제3조 결제와 환불</h2>
      <p>유료 풀이는 결제 직후 바로 제공되는 디지털 콘텐츠로, 풀이를 열어 본 뒤에는 청약 철회가 제한될 수 있습니다. 풀이를 열기 전이거나 서비스 오류로 받지 못한 경우 전액 환불합니다. 구독은 언제든 해지할 수 있고, 다음 결제일부터 청구되지 않습니다.</p>
      <h2>제4조 이용자의 의무</h2>
      <p>다른 사람의 정보를 허락 없이 입력하거나, 풀이·이미지를 무단으로 복제·판매해서는 안 됩니다.</p>
      <h2>제5조 책임의 한계</h2>
      <p>회사는 천재지변 등 어쩔 수 없는 사유로 서비스를 제공하지 못한 경우 책임을 지지 않습니다.</p>
      <h2>제6조 분쟁 해결</h2>
      <p>분쟁은 서로 성실히 협의해 해결하며, 협의가 되지 않으면 관할 법원은 민사소송법에 따릅니다.</p>
      <dl className="summary">
        <dt>상호</dt><dd>{v(biz.name)}</dd>
        <dt>대표</dt><dd>{v(biz.ceo)}</dd>
        <dt>사업자번호</dt><dd>{v(biz.regNo)}</dd>
        <dt>통신판매업</dt><dd>{v(biz.mailOrderNo)}</dd>
        <dt>주소</dt><dd>{v(biz.address)}</dd>
      </dl>
    </Doc>
  );
}

export function Contact() {
  return (
    <Doc title="문의하기">
      <p>이용 중 불편한 점이나 결제·환불 문의는 아래로 연락해 주세요. 평일 기준 1~2일 안에 답변드려요.</p>
      <dl className="summary">
        <dt>카카오톡</dt><dd>{BRAND.links.kakaoChannel ? <a className="u" href={BRAND.links.kakaoChannel} target="_blank" rel="noreferrer">채널 열기</a> : '(준비 중)'}</dd>
        <dt>연락처</dt><dd>{v(biz.contact)}</dd>
        <dt>상호</dt><dd>{v(biz.name)}</dd>
      </dl>
    </Doc>
  );
}

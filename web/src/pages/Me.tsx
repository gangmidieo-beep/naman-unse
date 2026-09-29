// S10 내 정보 — 사주 프로필(여러 명)·구매한 풀이·구독·글자 크기·알림 시간·구매 복원·공지·약관·문의·버전.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SubHeader, SectionHeader } from '../components/layout';
import { BottomSheet, Button, useToast } from '../components/ui';
import { useApp } from '../store/app';
import { BRAND, productById, won } from '../lib/brand';
import { api } from '../lib/api';
import { getPayments } from '../platform/payments';
import { productTitle } from './Consult';
import { birthLabel, hourLabel } from './ProfileNew';

type Notice = { id: number; title: string; date: string; body: string };
const VERSION = '0.1.0 (시안)';

export default function Me() {
  const nav = useNavigate();
  const toast = useToast();
  const s = useApp();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [sheet, setSheet] = useState<null | 'notice' | 'terms' | 'biz' | 'contact'>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  useEffect(() => { api<Notice[]>('/notices').then(setNotices).catch(() => setNotices([])); }, []);
  const biz = BRAND.business;
  const restore = async () => {
    const owned = await getPayments().restore();
    toast(owned.length ? '구매 내역을 되살렸어요' : '되살릴 구매 내역이 없어요');
  };

  return (
    <>
      <SubHeader title="내 정보" back={false} />
      <main className="screen">
        <SectionHeader en="PROFILE" title="사주 정보" desc="가족 정보도 함께 저장해 두고 골라 볼 수 있어요" />
        {s.profiles.length === 0 && <p className="muted">아직 저장된 정보가 없어요. 지금은 예시(홍길동) 운세가 보여요.</p>}
        <ul className="me-list">
          {s.profiles.map((p) => (
            <li key={p.id} className={`me-prof${p.id === s.mainId ? ' main' : ''}`}>
              <div className="who">
                <b>{p.name}</b>{p.id === s.mainId && <span className="badge">대표</span>}
                <span>{p.gender === 'F' ? '여' : '남'} · {birthLabel(p)} · {hourLabel(p.hour)}</span>
              </div>
              {p.id !== s.mainId && <button className="mini" onClick={() => { s.setMain(p.id); toast(`${p.name}님을 대표로 정했어요`); }}>대표로</button>}
              <button className="mini" onClick={() => nav(`/profile/${p.id}/edit?back=/me`)}>수정</button>
              <button className="mini" onClick={() => setConfirmDel(p.id)} aria-label={`${p.name} 삭제`}>삭제</button>
            </li>
          ))}
        </ul>
        <Button kind="line" to="/profile/new?back=/me">+ {s.profiles.length ? '가족·지인 정보 추가' : '내 정보 입력하기'}</Button>

        <SectionHeader en="MY READINGS" title="구매한 풀이" />
        {s.purchases.length === 0 ? (
          <p className="muted">아직 구매한 풀이가 없어요. <Link to="/consult" className="u">사주상담 가기</Link></p>
        ) : (
          <ul className="menu">
            {s.purchases.map((o) => {
              const p = productById(o.productId);
              return (
                <li key={o.orderId}>
                  <Link className="mrow" to={`/reading/${o.orderId}`}>
                    <span>{p ? productTitle(p) : o.productId}</span>
                    <span className="v">{o.createdAt.slice(0, 10)} ›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <SectionHeader en="SETTINGS" title="설정" />
        <ul className="menu">
          <li>
            <Link className="mrow" to="/premium">
              <span>구독 상태</span>
              <span className="v">{s.premium ? '✦ 프리미엄 이용 중' : `무료 회원 · 프리미엄 월 ${won(BRAND.subscription.price)}`} ›</span>
            </Link>
          </li>
          <li>
            <div className="mrow">
              <span>글자 크기</span>
              <div className="seg3" role="group" aria-label="글자 크기">
                {([['100', '보통'], ['115', '크게'], ['130', '아주 크게']] as const).map(([v, l]) => (
                  <button key={v} className={s.fontScale === v ? 'on' : ''} aria-pressed={s.fontScale === v} onClick={() => s.setFontScale(v)}>{l}</button>
                ))}
              </div>
            </div>
          </li>
          <li>
            <div className="mrow">
              <span>매일 운세 알림</span>
              <button className={`switch-ui${s.notifyOn ? ' on' : ''}`} role="switch" aria-checked={s.notifyOn} aria-label="알림 받기" onClick={() => s.setNotify(!s.notifyOn)} />
            </div>
          </li>
          <li>
            <label className="mrow">
              <span>알림 시간</span>
              <input type="time" className="time-in" value={s.notifyTime} onChange={(e) => s.setNotify(s.notifyOn, e.target.value)} />
            </label>
          </li>
          <li><button className="mrow" onClick={restore}><span>구매 복원</span><span className="v">›</span></button></li>
        </ul>

        <SectionHeader en="INFO" title="안내" />
        <ul className="menu" id="terms">
          <li><button className="mrow" onClick={() => setSheet('notice')}><span>공지사항</span><span className="v">{notices.length}건 ›</span></button></li>
          <li><button className="mrow" onClick={() => setSheet('terms')}><span>이용약관 · 개인정보처리방침</span><span className="v">›</span></button></li>
          <li><button className="mrow" onClick={() => setSheet('biz')}><span>사업자 정보</span><span className="v">›</span></button></li>
          <li><button className="mrow" onClick={() => setSheet('contact')}><span>문의하기 (카카오톡 채널)</span><span className="v">›</span></button></li>
          <li><div className="mrow"><span>버전</span><span className="v">{VERSION}</span></div></li>
        </ul>
      </main>

      <BottomSheet open={sheet === 'notice'} onClose={() => setSheet(null)} title="공지사항">
        {notices.map((n) => <div key={n.id} className="mt14"><b>{n.title}</b><p className="muted">{n.date}</p><p>{n.body}</p></div>)}
        <Button kind="line" onClick={() => setSheet(null)}>닫기</Button>
      </BottomSheet>
      <BottomSheet open={sheet === 'terms'} onClose={() => setSheet(null)} title="이용약관 · 개인정보처리방침">
        <p>{BRAND.links.terms ? <a className="u" href={BRAND.links.terms}>이용약관 보기</a> : '약관은 대표님 사업자 정보를 받은 뒤 넣을 예정이에요.'}</p>
        <Button kind="line" onClick={() => setSheet(null)}>닫기</Button>
      </BottomSheet>
      <BottomSheet open={sheet === 'biz'} onClose={() => setSheet(null)} title="사업자 정보">
        <dl className="summary">
          <dt>상호</dt><dd>{biz.name || '(준비 중)'}</dd>
          <dt>대표</dt><dd>{biz.ceo || '(준비 중)'}</dd>
          <dt>사업자번호</dt><dd>{biz.regNo || '(준비 중)'}</dd>
          <dt>통신판매업</dt><dd>{biz.mailOrderNo || '(준비 중)'}</dd>
          <dt>주소</dt><dd>{biz.address || '(준비 중)'}</dd>
          <dt>연락처</dt><dd>{biz.contact || '(준비 중)'}</dd>
        </dl>
        <Button kind="line" onClick={() => setSheet(null)}>닫기</Button>
      </BottomSheet>
      <BottomSheet open={sheet === 'contact'} onClose={() => setSheet(null)} title="문의하기">
        <p>{BRAND.links.kakaoChannel ? <a className="u" href={BRAND.links.kakaoChannel} target="_blank" rel="noreferrer">카카오톡 채널 열기</a> : '카카오톡 채널 주소는 대표님께 받은 뒤 연결할 예정이에요.'}</p>
        <Button kind="line" onClick={() => setSheet(null)}>닫기</Button>
      </BottomSheet>
      <BottomSheet open={!!confirmDel} onClose={() => setConfirmDel(null)} title="이 정보를 지울까요?">
        <p>지운 정보는 되살릴 수 없어요. 구매한 풀이는 그대로 남아요.</p>
        <div className="btn-row">
          <Button kind="line" onClick={() => setConfirmDel(null)}>취소</Button>
          <Button onClick={() => { if (confirmDel) s.removeProfile(confirmDel); setConfirmDel(null); toast('지웠어요'); }}>지우기</Button>
        </div>
      </BottomSheet>
    </>
  );
}

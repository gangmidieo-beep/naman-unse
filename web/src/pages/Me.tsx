// 나의 운세함 — "개인 서재": 인사말 + 내 사주정보(일반 2개 / 프리미엄 무제한) · 나의 운명서 · 나의 인연서 · 나의 부적함 · 결제 내역 · 알림 설정 · 설정
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SubHeader, SectionHeader } from '../components/layout';
import { BottomSheet, Button, TalismanPaper, useToast } from '../components/ui';
import { useApp, useMainProfile, usePremium, useProfileLimit } from '../store/app';
import { BRAND, CHAR, charOf, displayTitle, isTarot, productById, won, type Talisman } from '../lib/catalog';
import { api, MOCK_MODE } from '../lib/api';
import { apiAuth, getPayments } from '../platform/payments';
import { birthLabel, hourLabel } from './ProfileNew';

type Notice = { id: number; title: string; date: string; body: string };
const VERSION = '0.3.0 (구조 v3)';
const dot = (s: string) => s.slice(0, 10).replace(/-/g, '.');

export default function Box() {
  const nav = useNavigate();
  const toast = useToast();
  const s = useApp();
  // 회원 탈퇴: 서버 개인정보 삭제(결제 기록만 법정 보관) → 이 기기 저장 내용도 지우고 처음 화면으로
  const withdraw = async () => {
    try {
      if (!MOCK_MODE) await apiAuth('/me/delete', { method: 'POST', body: '{}' });
    } catch (e) { toast((e as Error).message); return; }
    setSheet(null);
    try { localStorage.removeItem('naman-unse'); localStorage.removeItem('naman-guest'); } catch { /* */ }
    location.replace('/'); // 저장소를 비운 뒤 바로 새로 열어 이전 상태가 다시 저장되지 않게
  };
  const premium = usePremium();
  const { profile, isSample } = useMainProfile();
  const { limit, canAdd } = useProfileLimit();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [sheet, setSheet] = useState<null | 'profiles' | 'notice' | 'terms' | 'biz' | 'contact' | 'withdraw'>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  useEffect(() => { api<Notice[]>('/notices').then(setNotices).catch(() => setNotices([])); }, []);
  const books = s.purchases.filter((o) => o.kind === 'reading').map((o) => ({ o, p: productById(o.productId) })).filter((x) => x.p);
  const fate = books.filter((x) => charOf(x.p!) === 'cheongung');
  const tarot = books.filter((x) => isTarot(x.p!));
  const love = books.filter((x) => charOf(x.p!) === 'wolha' && !isTarot(x.p!));
  const restore = async () => {
    const owned = await getPayments().restore();
    toast(owned.length ? '구매 내역을 되살렸어요' : '되살릴 구매 내역이 없어요');
  };
  const biz = BRAND.business;

  return (
    <>
      <SubHeader title="나의 운세함" sub="내 운세를 보관하는 개인 서재" back={false} right={premium ? <span className="badge new" title="프리미엄">✦</span> : null} />
      <main className="screen">
        <section className="boxhead mt14">
          <small>MY LIBRARY</small>
          <b>{isSample ? '반가워요' : `${profile.name}님`}, 오늘도 좋은 운이<br />함께 하기를 바랍니다.</b>
          <div className="pf">
            {s.profiles.map((p) => (
              <button key={p.id} className={p.id === s.mainId ? 'main' : ''} onClick={() => setSheet('profiles')}>{p.relation ?? (p.id === s.mainId ? '나' : p.name)} · {p.year}.{String(p.month).padStart(2, '0')}.{String(p.day).padStart(2, '0')}</button>
            ))}
            <Link to={canAdd ? '/profile/new?back=/box' : '/premium'}>+ 사주 추가{limit != null ? ` (${s.profiles.length}/${limit})` : ''}</Link>
          </div>
        </section>

        <SectionHeader en="DESTINY" title={<>나의 <em>운명서</em></>} style={{ marginTop: 26 }} />
        {fate.length ? (
          <div className="shelf">
            {fate.map(({ o, p }) => <Link key={o.orderId} to={`/reading/${o.orderId}`} className="book f"><small>천궁도사</small><b>{displayTitle(p!)}</b><span>{dot(o.createdAt)}</span><em>다시 열어보기 ›</em></Link>)}
          </div>
        ) : <div className="shelf-empty">아직 운명서가 없어요. <Link to="/unse?cat=fate" className="u">나만의 운명 보기</Link></div>}

        <SectionHeader en="FATE" title={<>나의 <em>인연서</em></>} style={{ marginTop: 22 }} />
        {love.length ? (
          <div className="shelf">
            {love.map(({ o, p }) => <Link key={o.orderId} to={`/reading/${o.orderId}`} className="book l"><small>월하선녀</small><b>{displayTitle(p!)}</b><span>{dot(o.createdAt)}</span><em>다시 열어보기 ›</em></Link>)}
          </div>
        ) : <div className="shelf-empty">아직 인연서가 없어요. <Link to="/unse?cat=love" className="u">나만의 인연 보기</Link></div>}

        {tarot.length > 0 && <>
          <SectionHeader en="TAROT" title={<>나의 <em>타로 기록</em></>} style={{ marginTop: 22 }} />
          <div className="shelf">
            {tarot.map(({ o, p }) => <Link key={o.orderId} to={`/reading/${o.orderId}`} className="book t"><small>타로</small><b>{displayTitle(p!)}</b><span>{dot(o.createdAt)}</span><em>다시 열어보기 ›</em></Link>)}
          </div>
        </>}

        <SectionHeader en="TALISMAN" title={<>나의 <em>부적함</em></>} style={{ marginTop: 22 }} />
        <div id="talismans" />
        {s.talismans.length ? (
          <div className="bjbox">
            {s.talismans.map((t) => {
              const tt = productById(t.talismanId) as Talisman;
              return <Link key={t.id} to={`/talisman/${t.talismanId}/make?order=${t.orderId}`}><TalismanPaper t={tt} size={0.9} /><span>{tt.title}<br />{dot(t.issuedAt)}</span></Link>;
            })}
          </div>
        ) : <div className="shelf-empty">아직 부적이 없어요. <Link to="/talisman" className="u">나만의 부적 보기</Link></div>}

        <SectionHeader en="PAYMENT" title="결제 내역" style={{ marginTop: 22 }} />
        {s.purchases.length ? (
          <ul className="paylist">
            {s.purchases.map((o) => {
              const p = productById(o.productId);
              return <li key={o.orderId}><div><b>{p ? displayTitle(p) : o.productId}</b><span>{dot(o.createdAt)} · 주문번호 {o.orderId}</span></div><div className="center"><b>{won(o.price)}</b><span>{o.status === 'paid' ? '결제 완료' : '환불'}</span></div></li>;
            })}
          </ul>
        ) : <div className="shelf-empty">결제 내역이 없어요</div>}

        <SectionHeader en="SETTINGS" title="알림 · 설정" style={{ marginTop: 22 }} />
        <ul className="menu">
          <li><Link className="mrow" to="/premium"><span>구독</span><span className="v">{premium ? `✦ 프리미엄(${s.plan === 'yearly' ? '연간' : '월간'}) · ${s.planUntil}까지` : `일반 회원 · 월 ${won(BRAND.subscription.monthly.price)}`} ›</span></Link></li>
          <li><div className="mrow"><span>오늘의 운세 알림</span><button className={`switch-ui${s.notifyOn ? ' on' : ''}`} role="switch" aria-checked={s.notifyOn} aria-label="오늘의 운세 알림" onClick={() => s.setNotify(!s.notifyOn)} /></div></li>
          <li><label className="mrow"><span>알림 시간</span><input type="time" className="time-in" value={s.notifyTime} onChange={(e) => s.setNotify(s.notifyOn, e.target.value)} /></label></li>
          <li><div className="mrow"><span>이벤트·혜택 알림</span><button className={`switch-ui${s.eventNotify ? ' on' : ''}`} role="switch" aria-checked={s.eventNotify} aria-label="이벤트 혜택 알림" onClick={() => s.setEventNotify(!s.eventNotify)} /></div></li>
          <li>
            <div className="mrow"><span>글자 크기</span>
              <div className="seg3" role="group" aria-label="글자 크기">
                {([['100', '보통'], ['115', '크게'], ['130', '아주 크게']] as const).map(([v, l]) => (
                  <button key={v} className={s.fontScale === v ? 'on' : ''} aria-pressed={s.fontScale === v} onClick={() => s.setFontScale(v)}>{l}</button>
                ))}
              </div>
            </div>
          </li>
          <li><button className="mrow" onClick={restore}><span>구매 복원</span><span className="v">›</span></button></li>
        </ul>
        <ul className="menu" id="terms">
          <li>{s.account ? <div className="mrow"><span>로그인 계정</span><span className="v">{s.account.name}</span></div> : <Link className="mrow" to="/login"><span>로그인 계정</span><span className="v">로그인하기 ›</span></Link>}</li>
          <li><button className="mrow" onClick={() => setSheet('notice')}><span>공지사항</span><span className="v">{notices.length}건 ›</span></button></li>
          <li><button className="mrow" onClick={() => setSheet('terms')}><span>이용약관 · 개인정보처리방침</span><span className="v">›</span></button></li>
          <li><button className="mrow" onClick={() => setSheet('biz')}><span>사업자 정보</span><span className="v">›</span></button></li>
          <li><button className="mrow" onClick={() => setSheet('contact')}><span>문의하기</span><span className="v">›</span></button></li>
          {s.account && <li><button className="mrow" onClick={() => { s.setAccount(null); toast('로그아웃했어요'); }}><span>로그아웃</span><span className="v">›</span></button></li>}
          {s.account && <li><button className="mrow" onClick={() => setSheet('withdraw')}><span>회원 탈퇴</span><span className="v">›</span></button></li>}
          <li><div className="mrow"><span>버전</span><span className="v">{VERSION}</span></div></li>
        </ul>
      </main>

      <BottomSheet open={sheet === 'profiles'} onClose={() => setSheet(null)} title="내 사주정보">
        {s.profiles.map((p) => (
          <div key={p.id} className={`prof${p.id === s.mainId ? ' main' : ''}`} style={{ margin: '0 0 10px' }}>
            <div className="who">
              <b>{p.name}</b>{p.id === s.mainId && <span className="badge best">대표</span>}
              <span className="d">{p.relation ? `${p.relation} · ` : ''}{p.gender === 'F' ? '여' : '남'} · {birthLabel(p)} · {hourLabel(p.hour)}</span>
            </div>
            {p.id !== s.mainId && <button className="mini" onClick={() => { s.setMain(p.id); toast(`${p.name}님을 대표로 정했어요`); }}>대표로</button>}
            <button className="mini" onClick={() => nav(`/profile/${p.id}/edit?back=/box`)}>수정</button>
            <button className="mini" onClick={() => setConfirmDel(p.id)} aria-label={`${p.name} 삭제`}>삭제</button>
          </div>
        ))}
        <p className="note">일반 회원은 {BRAND.profileLimit.free}명까지, 프리미엄 회원은 제한 없이 저장할 수 있어요</p>
        <Button kind={canAdd ? 'ink' : 'gold'} to={canAdd ? '/profile/new?back=/box' : '/premium'}>{canAdd ? '+ 가족·지인 추가' : '✦ 프리미엄으로 더 저장하기'}</Button>
      </BottomSheet>
      <BottomSheet open={sheet === 'notice'} onClose={() => setSheet(null)} title="공지사항">
        {notices.map((n) => <div key={n.id} className="mt14"><b>{n.title}</b><p className="muted">{n.date}</p><p>{n.body}</p></div>)}
        <Button kind="line" onClick={() => setSheet(null)}>닫기</Button>
      </BottomSheet>
      <BottomSheet open={sheet === 'terms'} onClose={() => setSheet(null)} title="이용약관 · 개인정보처리방침">
        <p><Link className="u" to="/terms">이용약관 보기</Link> · <Link className="u" to="/privacy">개인정보처리방침 보기</Link></p>
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
      <BottomSheet open={sheet === 'withdraw'} onClose={() => setSheet(null)} title="회원 탈퇴">
        <p>탈퇴하면 계정과 연결된 풀이·부적 보관 기록이 삭제되고 되살릴 수 없어요. 구독은 구글 플레이에서 먼저 해지해 주세요.</p>
        <div className="btn-row">
          <Button kind="line" onClick={() => setSheet(null)}>취소</Button>
          <Button kind="ink" onClick={withdraw}>탈퇴하기</Button>
        </div>
      </BottomSheet>
      <BottomSheet open={!!confirmDel} onClose={() => setConfirmDel(null)} title="이 사주 정보를 지울까요?">
        <p>지운 정보는 되살릴 수 없어요. 구매한 풀이는 그대로 남아요.</p>
        <div className="btn-row">
          <Button kind="line" onClick={() => setConfirmDel(null)}>취소</Button>
          <Button kind="ink" onClick={() => { if (confirmDel) s.removeProfile(confirmDel); setConfirmDel(null); toast('지웠어요'); }}>지우기</Button>
        </div>
      </BottomSheet>
    </>
  );
}
export { CHAR };

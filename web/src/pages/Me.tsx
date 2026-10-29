// 나의 운세함 — "개인 서재": 인사말 + 내 사주정보(일반 2개 / 프리미엄 무제한) · 나의 운명서 · 나의 인연서 · 나의 부적함 · 결제 내역 · 알림 설정 · 설정
import { useEffect, useState } from 'react';
import { ExpiryNotice } from '../components/ExpiryNotice';
import { LoginButtons } from './Login';
import { Link, useNavigate } from 'react-router-dom';
import { SubHeader } from '../components/layout';
import { Icon } from '../components/Icon';
import { tarotSpread } from '@naman/content';
import { CardBack, tarotArt } from './Tarot';
import { v4 } from '../assets/images';
import type { ReactNode } from 'react';
import { BottomSheet, Button, ProductThumb, TalismanPaper, useToast } from '../components/ui';
import { useApp, useMainProfile, usePremium, useProfileLimit } from '../store/app';
import { BRAND, CHAR, charOf, displayTitle, isPhoto, isTarot, productById, thumbOf, won, type Product, type Talisman } from '../lib/catalog';
import { api, MOCK_MODE } from '../lib/api';
import { apiAuth, deleteProfileOnServer, getPayments, hideOrder, syncEntitlements, uploadAllProfiles } from '../platform/payments';
import { enablePush, syncPushPrefs } from '../platform/native';
import { birthLabel, hourLabel } from './ProfileNew';

type Notice = { id: number; title: string; date: string; body: string };
const VERSION = '1.0';
const dot = (s: string) => s.slice(0, 10).replace(/-/g, '.');

// 운세함 v4 (대표님 2차 시안) — 섹션 머리(영문 + 제목 + 산 그림 선), 항목 = 썸네일·이름·구매일 → 결과로 이동, 빈 칸 = 작은 아이콘 + 안내
function LibSec({ en, title, id, children }: { en: string; title: ReactNode; id?: string; children?: ReactNode }) {
  return (
    <section className="libsec" id={id}>
      <div className="lh"><small>{en}</small><h2>{title}</h2></div>
      {children && <div className="lb">{children}</div>}
    </section>
  );
}
function Empty({ icon, text, to }: { icon: string; text: ReactNode; to?: string }) {
  const body = <><span className="ic"><Icon name={icon} size={30} /></span><p>{text}</p>{to && <span className="chev">›</span>}</>;
  return to ? <Link to={to} className="lib-empty">{body}</Link> : <div className="lib-empty">{body}</div>;
}
// 운세함 항목 지우기 버튼(×) — 누르면 확인창. 결제는 취소되지 않고 화면에서만 지워짐(모든 기기 반영)
function DelBtn({ onAsk }: { onAsk: () => void }) {
  return <button type="button" className="lib-del" aria-label="운세함에서 지우기" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAsk(); }}>×</button>;
}
function BookRow({ o, p, onDel }: { o: { orderId: string; createdAt: string }; p: Product; onDel: () => void }) {
  const t = thumbOf(p);
  return (
    <div className="lib-item">
      <Link to={`/reading/${o.orderId}`} className="lib-book">
        {t.src ? <img src={t.src} alt="" /> : <span className="hz">{t.hanja}</span>}
        <div><b>{displayTitle(p)}</b><span className="d">{dot(o.createdAt)}</span><p>{p.cardCopy}</p></div>
        <span className="chev">›</span>
      </Link>
      <DelBtn onAsk={onDel} />
    </div>
  );
}

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
  const [hideAsk, setHideAsk] = useState<string | null>(null); // 운세함에서 지울 주문
  const hide = async (orderId: string) => {
    try { if (MOCK_MODE) s.removeOrder(orderId); else await hideOrder(orderId); toast('운세함에서 지웠어요'); } catch (e) { toast((e as Error).message); }
    setHideAsk(null);
  };
  // 운세함을 열 때마다 서버 기준으로 맞춤(웹에서 산 것이 모바일에도, 환불·삭제한 건 빠짐)
  useEffect(() => { if (!MOCK_MODE) void syncEntitlements(); }, []);
  useEffect(() => { api<Notice[]>('/notices').then(setNotices).catch(() => setNotices([])); }, []);
  const books = s.purchases.filter((o) => o.kind === 'reading').map((o) => ({ o, p: productById(o.productId) })).filter((x) => x.p);
  const fate = books.filter((x) => (charOf(x.p!) === 'cheongung' || isPhoto(x.p!)) && !isTarot(x.p!));
  const tarot = books.filter((x) => isTarot(x.p!));
  const love = books.filter((x) => charOf(x.p!) === 'wolha' && !isTarot(x.p!) && !isPhoto(x.p!));
  const restore = async () => {
    const owned = await getPayments().restore();
    toast(owned.length ? '구매 내역을 되살렸어요' : '되살릴 구매 내역이 없어요');
  };
  const biz = BRAND.business;

  return (
    <>
      <SubHeader title="나의 운세함" sub="내 운세를 보관하는 개인 서재" back={false} right={premium ? <span className="badge new" title="프리미엄">✦</span> : null} />
      <main className="screen lib4">
        <section className="lib-head">
          <img src={v4('library_bg')} alt="" />
          <div className="tx">
            <small>MY LIBRARY</small>
            <b>{isSample ? '반가워요' : `${profile.name}님`},<br />오늘도 좋은 운이<br />함께 하기를 바랍니다.</b>
            <Link to={canAdd ? '/profile/new?back=/box' : '/premium'} className="add">+ 사주 추가하기{limit != null ? ` (${s.profiles.length}/${limit})` : ''}</Link>
          </div>
        </section>
        {s.profiles.length > 0 && (
          <div className="lib-pf">
            {s.profiles.map((p) => (
              <button key={p.id} className={p.id === s.mainId ? 'main' : ''} onClick={() => setSheet('profiles')}>{p.relation ?? (p.id === s.mainId ? '나' : p.name)} · {p.year}.{String(p.month).padStart(2, '0')}.{String(p.day).padStart(2, '0')}</button>
            ))}
          </div>
        )}
        <ExpiryNotice />
        {!s.account && (
          <section className="lib-login">
            <b>회원가입 · 로그인</b>
            <p>간편 로그인하면 구매한 풀이와 부적을 휴대폰을 바꿔도 그대로 볼 수 있어요.</p>
            <LoginButtons />
          </section>
        )}

        <LibSec en="DESTINY" title={<>나의 <em>운명서</em></>}>
          {fate.length ? fate.map(({ o, p }) => <BookRow key={o.orderId} o={o} p={p!} onDel={() => setHideAsk(o.orderId)} />)
            : <Empty icon="scroll-text" to="/unse?cat=fate" text={<>아직 운명서가 없어요.<br />나만의 운명서를 받아보세요.</>} />}
        </LibSec>
        <LibSec en="FATE" title={<>나의 <em>인연서</em></>}>
          {love.length ? love.map(({ o, p }) => <BookRow key={o.orderId} o={o} p={p!} onDel={() => setHideAsk(o.orderId)} />)
            : <Empty icon="heart-handshake" to="/unse?cat=love" text={<>아직 인연서가 없어요.<br />나만의 인연서를 받아보세요.</>} />}
        </LibSec>
        <LibSec en="TAROT" title={<>나의 <em>타로함</em></>}>
          {tarot.length ? (
            <div className="lib-tarot">
              {tarot.map(({ o, p }) => (
                <Link key={o.orderId} to={`/reading/${o.orderId}`} className="lib-item"><DelBtn onAsk={() => setHideAsk(o.orderId)} /><div className="cd">{(() => { const d = tarotSpread(`${o.orderId}:${p!.id}`, (p as any).cards ?? 1)[0]; const src = d && tarotArt(d.card.id); return src ? <img src={src} alt="" className={d.reversed ? 'rev' : ''} loading="lazy" /> : <CardBack />; })()}</div><b>{p!.title}</b><span>{dot(o.createdAt)}</span></Link>
              ))}
            </div>
          ) : <Empty icon="layers" to="/tarot" text={<>아직 타로 기록이 없어요.<br />나만의 타로를 받아보세요.</>} />}
        </LibSec>
        <LibSec en="TALISMAN" title={<>나의 <em>부적함</em></>} id="talismans">
          {s.talismans.length ? (
            <div className="lib-bj">
              {s.talismans.map((t) => {
                const tt = productById(t.talismanId) as Talisman | undefined;
                if (!tt) return null;
                return <Link key={t.id} to={`/talisman/${t.talismanId}/make?order=${t.orderId}`} className="lib-item"><DelBtn onAsk={() => setHideAsk(t.orderId)} /><TalismanPaper t={tt} size={0.78} /><b>{tt.title}</b><span>{dot(t.issuedAt)}</span></Link>;
              })}
            </div>
          ) : <Empty icon="gift" to="/talisman" text={<>아직 부적이 없어요.<br />나만의 부적을 받아보세요.</>} />}
        </LibSec>
        <LibSec en="PAYMENT" title="결제 내역">
          {s.purchases.length ? (
            <ul className="lib-pay">
              {s.purchases.map((o) => {
                const p = productById(o.productId);
                // 결제 내역에서 바로 열기 — 풀이는 결과 화면, 부적은 만들기(이미 만들었으면 그 부적) 화면
                const to = o.status !== 'paid' ? null : o.kind === 'talisman' ? `/talisman/${o.productId}/make?order=${o.orderId}` : o.kind === 'reading' ? `/reading/${o.orderId}` : null;
                const body = (
                  <>
                    {p && <ProductThumb p={p} size={52} />}
                    <div className="t"><b>{p ? displayTitle(p) : o.productId}</b><span>{dot(o.createdAt)} · {o.orderId}</span></div>
                    <div className="r"><b>{won(o.price)}</b><span>{o.status === 'paid' ? (to ? '열기 ›' : '결제 완료') : '환불'}</span></div>
                  </>
                );
                return <li key={o.orderId} className="lib-item">{to ? <Link to={to} className="lib-pay-row">{body}</Link> : body}<DelBtn onAsk={() => setHideAsk(o.orderId)} /></li>;
              })}
            </ul>
          ) : <Empty icon="file-text" text={<>결제 내역이 없어요.</>} />}
        </LibSec>

        <LibSec en="SETTINGS" title="알림 · 설정" />
        <ul className="menu">
          <li><Link className="mrow" to="/premium"><span>구독</span><span className="v">{premium ? `✦ 프리미엄 · ${s.plan === 'yearly' ? `연 ${won(BRAND.subscription.yearly.price)}` : `월 ${won(BRAND.subscription.monthly.price)}`} · ${s.planAuto ? '자동결제 중' : `${s.planUntil}까지`}` : '일반 회원 · 무료'} ›</span></Link></li>
          <li><div className="mrow"><span>오늘의 운세 알림</span><button className={`switch-ui${s.notifyOn ? ' on' : ''}`} role="switch" aria-checked={s.notifyOn} aria-label="오늘의 운세 알림" onClick={async () => { const on = !s.notifyOn; if (on && (await enablePush(s.notifyTime)) === 'denied') { toast('휴대폰 설정에서 알림을 켜 주세요'); return; } s.setNotify(on); void syncPushPrefs(on, s.notifyTime); }} /></div></li>
          <li><label className="mrow"><span>알림 시간</span><input type="time" className="time-in" value={s.notifyTime} onChange={(e) => { s.setNotify(s.notifyOn, e.target.value); void syncPushPrefs(s.notifyOn, e.target.value); }} /></label></li>
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
          {s.account && <li><button className="mrow" onClick={async () => { await uploadAllProfiles(); s.signOut(); toast('로그아웃했어요. 다시 로그인하면 운세함이 그대로 돌아와요'); }}><span>로그아웃</span><span className="v">›</span></button></li>}
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
        <p>탈퇴하면 계정과 연결된 풀이·부적 보관 기록이 삭제되고 되살릴 수 없어요. 웹에서 신청한 월 자동결제는 탈퇴할 때 함께 해지돼요. 앱(구글 플레이)에서 구독하셨다면 구글 플레이에서 먼저 해지해 주세요.</p>
        <div className="btn-row">
          <Button kind="line" onClick={() => setSheet(null)}>취소</Button>
          <Button kind="ink" onClick={withdraw}>탈퇴하기</Button>
        </div>
      </BottomSheet>
      <BottomSheet open={!!hideAsk} onClose={() => setHideAsk(null)} title="운세함에서 지울까요?">
        <p className="note" style={{ margin: '0 0 14px' }}>지우면 운세함·결제 내역에서 사라지고 다시 볼 수 없어요. (결제가 취소되지는 않아요)</p>
        <div className="btn-row">
          <Button kind="line" onClick={() => setHideAsk(null)}>그대로 두기</Button>
          <Button kind="ink" onClick={() => hideAsk && hide(hideAsk)}>지우기</Button>
        </div>
      </BottomSheet>
      <BottomSheet open={!!confirmDel} onClose={() => setConfirmDel(null)} title="이 사주 정보를 지울까요?">
        <p>지운 정보는 되살릴 수 없어요. 구매한 풀이는 그대로 남아요.</p>
        <div className="btn-row">
          <Button kind="line" onClick={() => setConfirmDel(null)}>취소</Button>
          <Button kind="ink" onClick={async () => {
            const id = confirmDel; setConfirmDel(null);
            if (!id) return;
            const why = await deleteProfileOnServer(id); // 쓰는 중인 풀이가 있으면 지우지 않음(결제한 풀이가 멈추지 않게)
            if (why) return toast(why);
            s.removeProfile(id); toast('지웠어요');
          }}>지우기</Button>
        </div>
      </BottomSheet>
    </>
  );
}
export { CHAR };

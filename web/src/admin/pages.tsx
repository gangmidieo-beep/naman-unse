// 관리자 8개 메뉴 화면
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { adminApi, download, dt, fileToDataUrl, session, won } from './api';

/* ---------- 공통 ---------- */
function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState('');
  const reload = useCallback(() => { setErr(''); fn().then(setData).catch((e) => setErr(e.message)); }, deps);
  useEffect(reload, [reload]);
  return { data, err, reload };
}
const PERIODS = [['today', '오늘'], ['yesterday', '어제'], ['7d', '최근 7일'], ['month', '이번 달'], ['custom', '기간 선택']] as const;
function usePeriod(initial = 'today') {
  const [period, setPeriod] = useState(initial);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const qs = period === 'custom' && from && to ? `period=custom&from=${from}&to=${to}` : `period=${period === 'custom' ? '7d' : period}`;
  const ui = (
    <div className="ad-period">
      {PERIODS.map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}
      {period === 'custom' && <><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />~<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></>}
    </div>
  );
  return { qs, ui };
}
function Head({ title, children }: { title: string; children?: ReactNode }) {
  return <header className="ad-head"><h2>{title}</h2><div className="ad-tools">{children}</div></header>;
}
function Card({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="ad-card"><small>{label}</small><b>{value}</b>{sub && <span>{sub}</span>}</div>;
}
// 선 그래프(외부 라이브러리 없이 SVG)
function Line({ rows, keys }: { rows: Record<string, any>[]; keys: { k: string; label: string; color: string }[] }) {
  const W = 760, H = 220, P = 34;
  if (!rows.length) return null;
  const max = (k: string) => Math.max(1, ...rows.map((r) => +r[k] || 0));
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, rows.length - 1);
  return (
    <figure className="ad-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="일별 그래프">
        {[0, 0.5, 1].map((t) => <line key={t} x1={P} x2={W - P} y1={P + t * (H - P * 2)} y2={P + t * (H - P * 2)} stroke="#E8DDC4" />)}
        {keys.map(({ k, color }) => (
          <polyline key={k} fill="none" stroke={color} strokeWidth={2.5} points={rows.map((r, i) => `${x(i)},${H - P - ((+r[k] || 0) / max(k)) * (H - P * 2)}`).join(' ')} />
        ))}
        {rows.map((r, i) => (i % Math.ceil(rows.length / 8) === 0 ? <text key={i} x={x(i)} y={H - 8} fontSize={11} textAnchor="middle" fill="#857B6E">{String(r.date).slice(5)}</text> : null))}
      </svg>
      <figcaption>{keys.map(({ k, label, color }) => <span key={k}><i style={{ background: color }} />{label} (최대 {max(k).toLocaleString('ko-KR')})</span>)}</figcaption>
    </figure>
  );
}
const isSuper = () => session()?.role === 'super';

/* ---------- 1 대시보드 ---------- */
export function Dashboard() {
  const { qs, ui } = usePeriod('7d');
  const { data, err } = useLoad(() => adminApi<any>(`/dashboard?${qs}`), [qs]);
  const k = data?.byKind ?? {};
  return (
    <>
      <Head title="대시보드">{ui}<button className="ad-btn line" onClick={() => download(`/dashboard?${qs}&format=csv`, 'dashboard.csv')}>CSV 받기</button></Head>
      {err && <p className="ad-err">{err}</p>}
      {data && (
        <>
          <div className="ad-cards">
            <Card label="방문자" value={data.cards.visitors.toLocaleString('ko-KR')} />
            <Card label="신규가입" value={data.cards.signups.toLocaleString('ko-KR')} />
            <Card label="프리미엄 회원(현재)" value={data.cards.premium.toLocaleString('ko-KR')} />
            <Card label="결제건수" value={data.cards.orders.toLocaleString('ko-KR')} />
            <Card label="결제매출" value={won(data.cards.revenue)} />
          </div>
          <div className="ad-cards four">
            {[['fate', '운명서(천궁도사)'], ['love', '인연서(월하선녀)'], ['talisman', '부적'], ['subscription', '구독']].map(([key, l]) => (
              <Card key={key} label={l} value={won(k[key]?.revenue ?? 0)} sub={`${k[key]?.n ?? 0}건`} />
            ))}
          </div>
          <section className="ad-box"><h3>일별 흐름 ({data.range.from} ~ {data.range.to})</h3>
            <Line rows={data.daily} keys={[{ k: 'visitors', label: '방문자', color: '#223056' }, { k: 'signups', label: '신규가입', color: '#9E3A55' }, { k: 'revenue', label: '매출', color: '#B8892E' }]} />
            <table className="ad-table"><thead><tr><th>날짜</th><th>방문자</th><th>신규가입</th><th>결제건수</th><th>매출</th></tr></thead>
              <tbody>{data.daily.slice().reverse().map((r: any) => <tr key={r.date}><td>{r.date}</td><td>{r.visitors}</td><td>{r.signups}</td><td>{r.orders}</td><td>{won(r.revenue)}</td></tr>)}</tbody></table>
          </section>
        </>
      )}
    </>
  );
}

/* ---------- 2 회원관리 ---------- */
export function Members() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('');
  const { data, err } = useLoad(() => adminApi<any[]>(`/members?limit=100&search=${encodeURIComponent(q)}&tier=${tier}`), [q, tier]);
  const [sel, setSel] = useState<string | null>(null);
  const detail = useLoad(() => (sel ? adminApi<any>(`/members/${sel}`) : Promise.resolve(null)), [sel]);
  return (
    <>
      <Head title="회원관리">
        <form onSubmit={(e) => { e.preventDefault(); setQ(search); }} className="ad-search"><input placeholder="이름·회원번호·이메일" value={search} onChange={(e) => setSearch(e.target.value)} /><button className="ad-btn">검색</button></form>
        <select value={tier} onChange={(e) => setTier(e.target.value)}><option value="">전체</option><option value="free">일반</option><option value="premium">프리미엄</option></select>
      </Head>
      {err && <p className="ad-err">{err}</p>}
      <table className="ad-table click">
        <thead><tr><th>회원번호</th><th>이름·닉네임</th><th>가입일</th><th>최근 접속</th><th>등급</th><th>결제 누적액</th><th>등록 사주</th><th>로그인</th></tr></thead>
        <tbody>{data?.map((m) => (
          <tr key={m.id} onClick={() => setSel(m.id)} className={sel === m.id ? 'on' : ''}>
            <td className="mono">{m.id.slice(0, 10)}</td><td>{m.name ?? '(게스트)'}</td><td>{dt(m.created_at)}</td><td>{dt(m.last_seen_at)}</td>
            <td>{m.premium ? <span className="ad-tag gold">프리미엄</span> : '일반'}</td><td>{won(m.paid_total)}</td><td>{m.profiles}</td><td>{m.provider ?? '-'}</td>
          </tr>
        ))}</tbody>
      </table>
      {detail.data && (
        <section className="ad-drawer">
          <button className="ad-x" onClick={() => setSel(null)} aria-label="닫기">×</button>
          <h3>{detail.data.user.name ?? '(게스트)'} <small className="mono">{detail.data.user.id}</small></h3>
          <h4>등록 사주 {detail.data.profiles.length}</h4>
          <ul>{detail.data.profiles.map((p: any) => <li key={p.id}>{p.name} · {p.calendar === 'lunar' ? '음력' : '양력'} {p.birth_year}.{p.birth_month}.{p.birth_day} · {p.gender === 'F' ? '여' : '남'}</li>)}</ul>
          <h4>구매 이력</h4>
          <ul>{detail.data.orders.map((o: any) => <li key={o.id}>{dt(o.created_at)} · {o.title ?? o.product_id} · {won(o.amount)} · {o.status}</li>)}</ul>
          <h4>구독 이력</h4>
          <ul>{detail.data.subscriptions.map((s: any) => <li key={s.id}>{s.plan === 'yearly' ? '연간' : '월간'} · {s.status} · {dt(s.started_at)} ~ {dt(s.expires_at)}</li>)}</ul>
        </section>
      )}
    </>
  );
}

/* ---------- 3 콘텐츠 상품관리 ---------- */
const PRODUCT_TABS = [
  ['today', '오늘의 운세', (p: any) => p.kind === 'today'], ['fun', '재미로 보는 운세', (p: any) => p.kind === 'fun'],
  ['cheongung', '천궁도사', (p: any) => p.kind === 'reading' && p.character === 'cheongung'], ['wolha', '월하선녀', (p: any) => p.kind === 'reading' && p.character === 'wolha'],
  ['talisman', '나만의 부적', (p: any) => p.kind === 'talisman'],
] as const;
export function Products() {
  const [tab, setTab] = useState<string>('cheongung');
  const { data, err, reload } = useLoad(() => adminApi<any[]>('/products'), []);
  const [rows, setRows] = useState<any[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const filter = PRODUCT_TABS.find((t) => t[0] === tab)![2];
  useEffect(() => { if (data) setRows(data.filter(filter as any).sort((a, b) => a.sort - b.sort)); }, [data, tab]);
  const patch = (i: number, v: Record<string, unknown>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...v, _dirty: true } : x)));
  const save = async (p: any) => {
    const body: any = { title: p.title, cardCopy: p.cardCopy, detail: p.detail, badge: p.badge || null, visible: p.visible, imageUrl: p.imageUrl };
    if (isSuper()) Object.assign(body, { price: +p.price, memberPrice: p.memberPrice ? +p.memberPrice : null });
    try { await adminApi(`/products/${p.id}`, { method: 'PATCH', json: body }); setMsg(`${p.title} 저장 — 앱에 바로 반영돼요`); reload(); } catch (e) { setMsg((e as Error).message); }
  };
  const drop = async (to: number) => {
    if (drag == null || drag === to) return;
    const next = rows.slice();
    const [m] = next.splice(drag, 1);
    next.splice(to, 0, m);
    setRows(next);
    setDrag(null);
    await adminApi('/products/reorder', { method: 'POST', json: { ids: next.map((x) => x.id) } });
    setMsg('노출 순서를 바꿨어요');
  };
  const upload = async (i: number, f?: File) => {
    if (!f) return;
    const r = await adminApi<{ url: string }>('/upload', { method: 'POST', json: { dataUrl: await fileToDataUrl(f) } });
    patch(i, { imageUrl: r.url });
  };
  return (
    <>
      <Head title="콘텐츠 상품관리"><div className="ad-period">{PRODUCT_TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div></Head>
      {err && <p className="ad-err">{err}</p>}
      {msg && <p className="ad-ok">{msg}</p>}
      <p className="ad-muted">줄을 끌어 놓으면 노출 순서가 바뀌어요 · 가격은 최고관리자만 바꿀 수 있어요{!isSuper() && ' (지금은 운영자)'}</p>
      <table className="ad-table">
        <thead><tr><th /><th>노출</th><th>상품명 · 카드 문구 · 상세설명</th><th>가격</th><th>할인가(회원)</th><th>배지</th><th>대표 이미지</th><th /></tr></thead>
        <tbody>{rows.map((p, i) => (
          <tr key={p.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)} className={drag === i ? 'dragging' : ''}>
            <td className="grip" title="끌어서 순서 바꾸기">⋮⋮</td>
            <td><input type="checkbox" checked={p.visible} onChange={(e) => patch(i, { visible: e.target.checked })} aria-label="노출" /></td>
            <td className="wide">
              <input value={p.title} onChange={(e) => patch(i, { title: e.target.value })} aria-label="상품명" />
              <input value={p.cardCopy ?? ''} onChange={(e) => patch(i, { cardCopy: e.target.value })} aria-label="카드 문구" />
              {p.kind === 'talisman' && <textarea value={p.detail ?? ''} onChange={(e) => patch(i, { detail: e.target.value })} aria-label="상세설명" rows={2} />}
            </td>
            <td><input type="number" value={p.price} disabled={!isSuper()} onChange={(e) => patch(i, { price: e.target.value })} aria-label="가격" /></td>
            <td><input type="number" value={p.memberPrice ?? ''} disabled={!isSuper()} onChange={(e) => patch(i, { memberPrice: e.target.value })} aria-label="할인가" /></td>
            <td><select value={p.badge ?? ''} onChange={(e) => patch(i, { badge: e.target.value })}><option value="">없음</option><option>NEW</option><option>BEST</option><option>HOT</option><option>인기</option></select></td>
            <td>{p.imageUrl ? <img src={p.imageUrl} alt="" className="ad-thumb" /> : <span className="ad-thumb hz">{p.thumbHanja ?? '—'}</span>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(i, e.target.files?.[0])} aria-label="이미지 올리기" /></td>
            <td><button className={`ad-btn ${p._dirty ? 'gold' : 'line'} sm`} onClick={() => save(p)}>저장</button></td>
          </tr>
        ))}</tbody>
      </table>
    </>
  );
}

/* ---------- 4 배너·팝업 ---------- */
const SLOTS = [['home', '홈 롤링 배너'], ['event_popup', '이벤트 팝업'], ['exit_popup', '앱 종료 팝업']] as const;
export function Banners() {
  const [slot, setSlot] = useState<string>('home');
  const { data, err, reload } = useLoad(() => adminApi<any[]>('/banners'), []);
  const [edit, setEdit] = useState<any | null>(null);
  const list = (data ?? []).filter((b) => b.slot === slot);
  const save = async () => { await adminApi('/banners', { method: 'POST', json: edit }); setEdit(null); reload(); };
  const del = async (id: string) => { if (confirm('이 배너를 지울까요?')) { await adminApi(`/banners/${id}`, { method: 'DELETE' }); reload(); } };
  const upload = async (f?: File) => { if (f) setEdit({ ...edit, imageUrl: (await adminApi<{ url: string }>('/upload', { method: 'POST', json: { dataUrl: await fileToDataUrl(f) } })).url }); };
  return (
    <>
      <Head title="배너·팝업 관리">
        <div className="ad-period">{SLOTS.map(([k, l]) => <button key={k} className={slot === k ? 'on' : ''} onClick={() => setSlot(k)}>{l}</button>)}</div>
        <button className="ad-btn gold" onClick={() => setEdit({ slot, title: '', copy: '', link: '/', active: true, sort: list.length })}>+ 새로 만들기</button>
      </Head>
      {err && <p className="ad-err">{err}</p>}
      <table className="ad-table">
        <thead><tr><th>순서</th><th>이미지</th><th>제목 · 문구</th><th>연결 화면·URL</th><th>노출 기간</th><th>ON</th><th /></tr></thead>
        <tbody>{list.map((b) => (
          <tr key={b.id}><td>{b.sort + 1}</td><td>{b.image_url ?? b.imageUrl ? <img className="ad-thumb" src={b.imageUrl ?? b.image_url} alt="" /> : <span className="ad-thumb hz">{b.character === 'wolha' ? '緣' : '命'}</span>}</td>
            <td><b>{b.title}</b><br /><span className="ad-muted">{b.copy}</span></td><td className="mono">{b.link}</td>
            <td>{b.startsAt ? dt(b.startsAt) : '항상'} ~ {b.endsAt ? dt(b.endsAt) : ''}</td><td>{b.active ? 'ON' : 'OFF'}</td>
            <td><button className="ad-btn line sm" onClick={() => setEdit({ ...b })}>수정</button> <button className="ad-btn line sm" onClick={() => del(b.id)}>삭제</button></td></tr>
        ))}</tbody>
      </table>
      {edit && (
        <section className="ad-drawer">
          <button className="ad-x" onClick={() => setEdit(null)} aria-label="닫기">×</button>
          <h3>{edit.id ? '배너 수정' : '새 배너'} · {SLOTS.find((s) => s[0] === edit.slot)?.[1]}</h3>
          <label>제목<input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
          <label>문구<input value={edit.copy ?? ''} onChange={(e) => setEdit({ ...edit, copy: e.target.value })} /></label>
          <label>연결할 화면 또는 URL<input value={edit.link ?? ''} onChange={(e) => setEdit({ ...edit, link: e.target.value })} placeholder="/product/wealth 또는 https://…" /></label>
          <label>이미지<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(e.target.files?.[0])} /></label>
          {edit.imageUrl && <img className="ad-preview" src={edit.imageUrl} alt="" />}
          <div className="ad-row2">
            <label>시작<input type="datetime-local" value={edit.startsAt?.slice(0, 16) ?? ''} onChange={(e) => setEdit({ ...edit, startsAt: e.target.value || null })} /></label>
            <label>끝<input type="datetime-local" value={edit.endsAt?.slice(0, 16) ?? ''} onChange={(e) => setEdit({ ...edit, endsAt: e.target.value || null })} /></label>
          </div>
          <div className="ad-row2">
            <label>노출 순서<input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: +e.target.value })} /></label>
            <label className="ad-check"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />노출 ON</label>
          </div>
          <button className="ad-btn gold" onClick={save} disabled={!edit.title}>저장</button>
        </section>
      )}
    </>
  );
}

/* ---------- 5 결제·구독 ---------- */
const PAY_TABS = [['', '전체 결제'], ['fate', '운명서'], ['love', '인연서'], ['talisman', '부적'], ['subscription', '프리미엄 구독']] as const;
export function Payments() {
  const [kind, setKind] = useState('');
  const { data, err, reload } = useLoad(() => adminApi<any[]>(`/payments?limit=300&kind=${kind}`), [kind]);
  const { qs, ui } = usePeriod('month');
  const subs = useLoad(() => (kind === 'subscription' ? adminApi<any>(`/subscriptions/stats?${qs}`) : Promise.resolve(null)), [kind, qs]);
  const refund = async (id: string) => { if (confirm('환불 처리할까요? (결제사 환불은 별도로 진행)')) { await adminApi(`/payments/${id}/refund`, { method: 'POST' }); reload(); } };
  const STATUS: Record<string, string> = { paid: '결제완료', pending: '대기', failed: '실패', cancelled: '취소', refunded: '환불' };
  return (
    <>
      <Head title="결제·구독 관리">
        <div className="ad-period">{PAY_TABS.map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
        <button className="ad-btn line" onClick={() => download(`/payments?limit=1000&kind=${kind}&format=csv`, 'payments.csv')}>CSV 받기</button>
      </Head>
      {kind === 'subscription' && (
        <>
          {ui}
          {subs.data && <div className="ad-cards">
            <Card label="월간 구독자" value={subs.data.monthly} /><Card label="연간 구독자" value={subs.data.yearly} /><Card label="신규 구독" value={subs.data.new} />
            <Card label="해지" value={subs.data.canceled} /><Card label="갱신" value={subs.data.renewed} /><Card label="구독 매출" value={won(subs.data.revenue)} />
          </div>}
        </>
      )}
      {err && <p className="ad-err">{err}</p>}
      <table className="ad-table">
        <thead><tr><th>결제일</th><th>회원</th><th>상품</th><th>결제금액</th><th>할인금액</th><th>결제수단</th><th>결제상태</th><th>환불상태</th><th /></tr></thead>
        <tbody>{data?.map((o) => (
          <tr key={o.id}><td>{dt(o.created_at)}</td><td>{o.user_name ?? o.user_id?.slice(0, 8)}</td><td>{o.title ?? o.product_id}</td><td>{won(o.amount)}</td><td>{won(o.discount)}</td>
            <td>{o.method ?? '-'} <span className="ad-muted">({o.channel})</span></td><td>{STATUS[o.status] ?? o.status}</td><td>{o.refund_status === 'done' ? '환불완료' : o.refund_status ?? '-'}</td>
            <td>{isSuper() && o.status === 'paid' && <button className="ad-btn line sm" onClick={() => refund(o.id)}>환불</button>}</td></tr>
        ))}</tbody>
      </table>
    </>
  );
}

/* ---------- 6 푸시 ---------- */
const TARGETS = [['all', '전체'], ['free', '일반 회원'], ['premium', '프리미엄 회원'], ['dormant7', '7일 이상 미접속'], ['dormant30', '30일 이상 미접속']] as const;
export function Push() {
  const links = useLoad(() => adminApi<string[]>('/push/links'), []);
  const { data, reload } = useLoad(() => adminApi<any[]>('/push'), []);
  const [f, setF] = useState({ title: '오늘 재물운이 좋은 시간은 언제일까요?', body: '[오늘의 운세 확인하기]', deepLink: '/today', target: 'all', when: 'now', at: '' });
  const [msg, setMsg] = useState('');
  const send = async () => {
    try {
      const r = await adminApi<any>('/push', { method: 'POST', json: { title: f.title, body: f.body, deepLink: f.deepLink, target: f.target, scheduledAt: f.when === 'later' ? new Date(f.at).toISOString() : undefined } });
      setMsg(r.status === 'sent' ? `${r.sentCount.toLocaleString('ko-KR')}명에게 보냈어요(앱 푸시 연결 전에는 기록만)` : '예약했어요');
      reload();
    } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <>
      <Head title="푸시 알림 관리" />
      <div className="ad-split">
        <section className="ad-box">
          <h3>① 문구 → ② 연결 콘텐츠 → ③ 대상 → ④ 발송</h3>
          <label>제목<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={40} /></label>
          <label>내용<input value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={80} /></label>
          <label>누르면 열릴 화면(딥링크)<select value={f.deepLink} onChange={(e) => setF({ ...f, deepLink: e.target.value })}>{links.data?.map((l) => <option key={l}>{l}</option>)}</select></label>
          <label>발송 대상<select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>{TARGETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <div className="ad-period"><button className={f.when === 'now' ? 'on' : ''} onClick={() => setF({ ...f, when: 'now' })}>즉시 발송</button><button className={f.when === 'later' ? 'on' : ''} onClick={() => setF({ ...f, when: 'later' })}>예약 발송</button>
            {f.when === 'later' && <input type="datetime-local" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} />}</div>
          {msg && <p className="ad-ok">{msg}</p>}
          <button className="ad-btn gold" onClick={send} disabled={!f.title || (f.when === 'later' && !f.at)}>{f.when === 'now' ? '지금 보내기' : '예약하기'}</button>
        </section>
        <section className="ad-phone" aria-label="미리보기">
          <div className="ad-notif"><b><span className="seal">運</span>나만의 운세 · 지금</b><strong>{f.title}</strong><p>{f.body}</p><small>→ {f.deepLink}</small></div>
        </section>
      </div>
      <table className="ad-table">
        <thead><tr><th>예약·발송 시각</th><th>제목</th><th>연결</th><th>대상</th><th>상태</th><th>발송 수</th><th>작성</th></tr></thead>
        <tbody>{data?.map((c) => <tr key={c.id}><td>{dt(c.scheduledAt)}</td><td>{c.title}</td><td className="mono">{c.deepLink}</td><td>{TARGETS.find((t) => t[0] === c.target)?.[1] ?? c.target}</td><td>{c.status === 'sent' ? '발송완료' : c.status === 'scheduled' ? '예약' : c.status}</td><td>{c.sentCount.toLocaleString('ko-KR')}</td><td>{c.createdBy ?? '-'}</td></tr>)}</tbody>
      </table>
    </>
  );
}

/* ---------- 7 광고 관리 ---------- */
const AD_LABEL: Record<string, [string, string]> = {
  home_banner: ['홈 하단 배너', '홈 화면 맨 아래 배너 1개'],
  detail_native: ['상세 운세 네이티브', '오늘의 운세 상세 풀이 안 네이티브 광고 1개'],
  rewarded: ['결과 보상형 전면', '띠별·혈액형·MBTI·타로 결과, 오늘의 운세 상세 풀이 전'],
  exit: ['앱 종료 팝업', '뒤로가기로 종료할 때 AdMob 또는 이미지+링크'],
  content_banner: ['콘텐츠 하단 배너', '재미로 보는 운세·띠별 결과 아래 배너'],
  tarot_banner: ['타로 탭 하단 배너', '타로 탭 맨 아래 배너'],
};
export function Ads() {
  const { data, reload, err } = useLoad(() => adminApi<any[]>('/ads'), []);
  const [msg, setMsg] = useState('');
  const save = async (slot: string, enabled: boolean, config: unknown) => {
    try { await adminApi(`/ads/${slot}`, { method: 'PUT', json: { enabled, config } }); setMsg('저장했어요 — 앱에 바로 반영돼요'); reload(); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <>
      <Head title="광고 관리" />
      <p className="ad-muted">프리미엄 회원에게는 모든 광고가 자동으로 빠져요 · 앱은 AdMob, 웹은 애드센스(앱 안에서는 애드센스를 불러오지 않음) · 앱 시작 시 전면 광고는 없어요 · 변경은 최고관리자만</p>
      {err && <p className="ad-err">{err}</p>}
      {msg && <p className="ad-ok">{msg}</p>}
      <div className="ad-cards two">
        {data?.map((a) => (
          <div className="ad-card ad-adslot" key={a.slot}>
            <small>{AD_LABEL[a.slot]?.[1]}</small>
            <b>{AD_LABEL[a.slot]?.[0] ?? a.slot}</b>
            <label className="ad-check"><input type="checkbox" checked={a.enabled} disabled={!isSuper()} onChange={(e) => save(a.slot, e.target.checked, a.config)} />{a.enabled ? 'ON' : 'OFF'}</label>
            {a.slot === 'rewarded' && (
              <div className="ad-row2">
                <label>하루 최대 횟수<input type="number" defaultValue={a.config?.maxPerDay} disabled={!isSuper()} onBlur={(e) => save(a.slot, a.enabled, { ...a.config, maxPerDay: +e.target.value })} /></label>
                <label>최소 간격(초)<input type="number" defaultValue={a.config?.minIntervalSec} disabled={!isSuper()} onBlur={(e) => save(a.slot, a.enabled, { ...a.config, minIntervalSec: +e.target.value })} /></label>
              </div>
            )}
            {a.config && 'adsenseSlot' in a.config && (
              <label className="ad-row1">웹 애드센스 슬롯 ID<input defaultValue={a.config.adsenseSlot} placeholder="예) 1234567890" disabled={!isSuper()} onBlur={(e) => save(a.slot, a.enabled, { ...a.config, adsenseSlot: e.target.value.trim() })} /></label>
            )}
            {a.slot === 'exit' && (
              <select value={a.config?.mode ?? 'admob'} disabled={!isSuper()} onChange={(e) => save(a.slot, a.enabled, { ...a.config, mode: e.target.value })}>
                <option value="admob">AdMob 광고</option><option value="image">이미지+링크(배너·팝업 메뉴의 '앱 종료 팝업')</option>
              </select>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- 8 통계 분석 ---------- */
const CONTENT_KO: Record<string, string> = { today: '오늘의 운세', zodiac: '띠별', star: '별자리', blood: '혈액형', tarot: '타로', dream: '꿈해몽', factbomb: '팩폭', mbti: 'MBTI' };
function Bars({ rows, label, value, fmt = (n: number) => n.toLocaleString('ko-KR') }: { rows: any[]; label: string; value: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => +r[value]));
  return <ul className="ad-bars">{rows.map((r, i) => <li key={i}><span>{r[label] ?? '(없음)'}</span><i style={{ width: `${(+r[value] / max) * 100}%` }} /><b>{fmt(+r[value])}</b></li>)}</ul>;
}
export function Stats() {
  const { qs, ui } = usePeriod('7d');
  const { data, err } = useLoad(() => adminApi<any>(`/stats?${qs}`), [qs]);
  const funnel = useMemo(() => {
    if (!data) return [];
    const f = data.funnel;
    return [['상품 보기', f.product_view ?? 0], ['결제창 열기', f.checkout_open ?? 0], ['결제 성공', f.pay_success ?? 0], ['취소', f.pay_cancel ?? 0], ['실패', f.pay_fail ?? 0]].map(([l, n]) => ({ l, n }));
  }, [data]);
  return (
    <>
      <Head title="통계 분석">{ui}</Head>
      {err && <p className="ad-err">{err}</p>}
      {data && (
        <div className="ad-grid">
          <section className="ad-box"><h3>콘텐츠별 조회수</h3><Bars rows={data.views.map((v: any) => ({ ...v, content: CONTENT_KO[v.content] ?? v.content }))} label="content" value="n" /></section>
          <section className="ad-box"><h3>공유수 (채널별)</h3><Bars rows={data.shares} label="channel" value="n" />
            <p className="ad-muted">공유 링크 열림 {data.links.opens.toLocaleString('ko-KR')}회 · 누적 클릭 {data.links.total_clicks.toLocaleString('ko-KR')}회</p></section>
          <section className="ad-box"><h3>가입·결제 전환</h3>
            <div className="ad-cards three"><Card label="방문자" value={data.conversion.visitors} /><Card label="간편가입" value={data.conversion.signups} sub={`${((data.conversion.signups / Math.max(1, data.conversion.visitors)) * 100).toFixed(1)}%`} /><Card label="결제 회원" value={data.conversion.payers} sub={`${((data.conversion.payers / Math.max(1, data.conversion.visitors)) * 100).toFixed(1)}%`} /></div>
            <h4>결제 퍼널</h4><Bars rows={funnel} label="l" value="n" /></section>
          <section className="ad-box"><h3>상품별 매출</h3><Bars rows={data.productRevenue} label="title" value="revenue" fmt={won} /></section>
          <section className="ad-box"><h3>꿈해몽 인기 검색어</h3><ol className="ad-rank">{data.dreamTop.map((d: any) => <li key={d.q}>{d.q}<b>{d.n}</b></li>)}</ol></section>
          <section className="ad-box"><h3>유입 경로</h3><Bars rows={data.sources} label="source" value="visitors" /></section>
        </div>
      )}
    </>
  );
}

// 오늘의 운세 v2 — 오늘 / 이번 주 ✦ / 이번 달 ✦ (주·월 = 프리미엄). 6항목 별점, 행운, 천궁도사의 한 마디,
// [상세 풀이 보기] → 보상형 광고(프리미엄 제외) 후 6항목 상세.
import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CORE_FIELDS, FIELDS, FIELD_LABEL } from '@naman/content';
import { SubHeader, SectionHeader } from '../components/layout';
import { AdSlot, Button, PremiumLock, SegTabs, Stars, useCountUp, useToast } from '../components/ui';
import { Img } from '../components/Img';
import { ShareCard } from '../components/ShareCard';
import { ShareSheet } from '../components/ShareSheet';
import { useRewarded } from '../components/Rewarded';
import { isUnlockedToday, useApp, useMainProfile, usePremium } from '../store/app';
import { useMonthFortune, useTodayFortune, useWeekFortune } from '../lib/fortune';
import { koDate } from '../lib/dates';

const DOW = ['월', '화', '수', '목', '금', '토', '일'];
type Tab = 'today' | 'week' | 'month';

export default function Today() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as Tab) || 'today';
  const { profile, isSample } = useMainProfile();
  const premium = usePremium();
  const { unlocked, unlock } = useApp();
  const f = useTodayFortune(profile);
  const w = useWeekFortune(profile);
  const m = useMonthFortune(profile);
  const toast = useToast();
  const { run, modal } = useRewarded();
  const [share, setShare] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const shown = useCountUp(f.total);
  const key = `today:${profile.id}:${f.date}`;
  const open = premium || isUnlockedToday(unlocked, key);
  const setTab = (t: Tab) => setSp(t === 'today' ? {} : { tab: t }, { replace: true });

  return (
    <>
      <SubHeader title="오늘의 운세" sub={`${koDate()} · ${f.dayPillar.text}일(${f.dayPillar.hanja}日)`} />
      <main className="screen">
        <SegTabs value={tab} onChange={setTab} tabs={[
          { value: 'today', label: '오늘' },
          { value: 'week', label: <>이번 주 <span className="lk" aria-label="프리미엄">✦</span></> },
          { value: 'month', label: <>이번 달 <span className="lk" aria-label="프리미엄">✦</span></> },
        ]} />

        {tab === 'today' && (
          <>
            <section className="today" style={{ marginTop: 0 }} aria-label="오늘의 총운">
              <div className="in">
                <div className="top"><small>총 운</small><span>천궁도사 풀이</span></div>
                <h4>{profile.name}님, 오늘의 운세예요!{isSample && <span className="sample-badge">예시</span>}</h4>
                <div className="sc" aria-label={`${f.total}점`}><b aria-hidden>{shown}</b><span aria-hidden>점</span><Stars n={f.stars} /></div>
                <p className="q"><b>한 줄 요약 · {f.headline}</b>{f.brief}</p>
                <div className="grid6">
                  {FIELDS.map((k) => <div key={k}>{FIELD_LABEL[k]}<Stars n={f.fields[k].stars} /></div>)}
                </div>
              </div>
            </section>
            <div className="lucky">
              <div>행운의 색<b><i className="sw" style={{ background: f.lucky.hex }} aria-hidden />{f.lucky.color}</b></div>
              <div>행운의 숫자<b>{f.lucky.number}</b></div>
              <div>행운의 방향<b>{f.lucky.direction}</b></div>
            </div>
            <div className="word">
              <Img k="cheongungFace" alt="" />
              <div><small>천궁도사의 오늘의 한 마디</small><p>“{f.word}”</p></div>
            </div>
            {isSample && <p className="note">예시 화면이에요. <Link to="/profile/new" className="u">내 정보를 입력</Link>하면 나만의 운세로 바뀌어요.</p>}

            {!open ? (
              <div className="pad mt14">
                <Button kind="gold" onClick={() => run(() => unlock(key), 'today-detail')}>✦ 상세 풀이 보기</Button>
                <div className="adnote">짧은 광고를 보시면 상세 풀이가 열립니다 · 프리미엄 회원은 광고 없음</div>
              </div>
            ) : (
              <section className="detailbox" id="detail" aria-label="상세 풀이">
                <SectionHeader en="DETAIL" title={<>오늘의 <em>상세 풀이</em></>} style={{ margin: '24px 0 12px' }} />
                {FIELDS.map((k) => {
                  const d = f.fields[k];
                  return (
                    <article className="dfield" key={k} id={`f-${k}`}>
                      <div className="hd"><b>{FIELD_LABEL[k]}</b><Stars n={d.stars} /></div>
                      <div className="sm">{d.summary}</div>
                      {(d.detailCheongung ?? d.detail).map((p, i) => <p key={i}>{p}</p>)}
                      {(CORE_FIELDS as readonly string[]).includes(k) && d.advice && (
                        <ul>
                          <li>해 보면 좋은 일 — {d.advice.do}</li>
                          <li>오늘은 피해 가요 — {d.advice.avoid}</li>
                        </ul>
                      )}
                    </article>
                  );
                })}
                <AdSlot premium={premium} kind="상세 운세 네이티브" />
              </section>
            )}
            <div className="pad mt14">
              <Button kind="ink" onClick={() => setShare(true)}>결과 이미지로 공유하기</Button>
            </div>
          </>
        )}

        {tab === 'week' && (premium ? <WeekPanel w={w} /> : <PremiumLock label="✦ 이번 주 운세는 프리미엄 회원에게 열려요"><WeekPanel w={w} /></PremiumLock>)}
        {tab === 'month' && (premium ? <MonthPanel m={m} /> : <PremiumLock label="✦ 이번 달 운세는 프리미엄 회원에게 열려요"><MonthPanel m={m} /></PremiumLock>)}
      </main>
      {modal}
      <ShareSheet open={share} onClose={() => setShare(false)} card={cardRef} title="나만의 운세 · 오늘의 운세"
        text={`${profile.name}님의 오늘 운세 ${f.total}점 — “${f.oneLine}”`} path="/today" contentId="today" onDone={(msg) => msg && toast(msg)} />
      <ShareCard ref={cardRef} title="오늘의 운세" sub={koDate()}>
        <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 22 }}>{profile.name}님 · {f.total}점 <Stars n={f.stars} /></p>
        <p style={{ fontFamily: 'var(--serif)', fontSize: 19, lineHeight: 1.7, margin: '10px 0 14px' }}>“{f.oneLine}”</p>
        <div className="grid6">
          {FIELDS.map((k) => <div key={k} style={{ background: 'var(--ink)', color: 'var(--on-ink)' }}>{FIELD_LABEL[k]}<Stars n={f.fields[k].stars} /></div>)}
        </div>
        <p style={{ marginTop: 14, fontSize: 17 }}>행운의 색 {f.lucky.color} · 숫자 {f.lucky.number} · 방향 {f.lucky.direction}</p>
      </ShareCard>
    </>
  );
}

function WeekPanel({ w }: { w: ReturnType<typeof useWeekFortune> }) {
  const best = w.days.indexOf(w.best);
  return (
    <section className="today" style={{ marginTop: 0 }}>
      <div className="in">
        <div className="top"><small>이번 주</small><span>{+w.start.slice(4, 6)}월 {+w.start.slice(6)}일 주간</span></div>
        <div className="sc"><b>{w.total}</b><span>점</span><Stars n={w.stars} /></div>
        <p className="q">{w.line}</p>
        <ol className="weekbars">
          {w.days.map((d, i) => (
            <li key={d.date} className={i === best ? 'on' : ''}>
              <span className="bar" style={{ height: `${((d.total - 50) / 46) * 100}%` }} /><b>{d.total}</b><small>{DOW[i]}</small>
            </li>
          ))}
        </ol>
        <p className="q" style={{ borderTop: 0, paddingTop: 0 }}>가장 좋은 날: {DOW[best]}요일 ({w.best.pillar.text}일)</p>
      </div>
    </section>
  );
}

function MonthPanel({ m }: { m: ReturnType<typeof useMonthFortune> }) {
  return (
    <section className="today" style={{ marginTop: 0 }}>
      <div className="in">
        <div className="top"><small>이번 달</small><span>{m.pillar.text}월({m.pillar.hanja}月)</span></div>
        <div className="sc"><b>{m.total}</b><span>점</span><Stars n={m.stars} /></div>
        <p className="q">{m.line}</p>
        <div className="grid6">{FIELDS.map((k) => <div key={k}>{FIELD_LABEL[k]}<Stars n={m.fields[k]} /></div>)}</div>
      </div>
    </section>
  );
}

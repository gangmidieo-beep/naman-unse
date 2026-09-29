// S3 오늘의 운세 — 시안 ② (운세보감 구성). 오늘·이번 주 무료, 이번 달 프리미엄.
import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FIELDS, FIELD_LABEL, type Field } from '@naman/content';
import { SubHeader, SectionHeader } from '../components/layout';
import {
  AdSlot, CategoryRow, CharacterBubble, LuckyGrid, PremiumLock, RareListItem, ScoreStars, SegTabs, Stars, useToast,
} from '../components/ui';
import { ShareCard } from '../components/ShareCard';
import { useApp, useMainProfile } from '../store/app';
import { useMonthFortune, useTodayFortune, useWeekFortune } from '../lib/fortune';
import { koDate } from '../lib/dates';
import { saveImage, shareLink } from '../lib/share';
import { Link } from 'react-router-dom';

export const FIELD_COLOR: Record<Field, string> = { wealth: 'var(--field-wealth)', love: 'var(--field-love)', work: 'var(--field-work)', health: 'var(--field-health)' };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
type Tab = 'today' | 'week' | 'month';

export default function Today() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as Tab) || 'today';
  const { profile, isSample } = useMainProfile();
  const premium = useApp((s) => s.premium);
  const f = useTodayFortune(profile);
  const w = useWeekFortune(profile);
  const m = useMonthFortune(profile);
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const setTab = (t: Tab) => setSp(t === 'today' ? {} : { tab: t }, { replace: true });
  const who = `${profile.name}님`;

  const share = async () => {
    const r = await shareLink({ title: '나만의 운세', text: `${who}의 오늘 운세 ${f.total}점 — “${f.oneLine}”` });
    if (r === 'copied') toast('링크를 복사했어요. 카카오톡에 붙여 넣어 보내세요');
  };
  const save = async () => {
    if (!cardRef.current) return;
    await saveImage(cardRef.current, `나만의운세_${f.date}.png`);
    toast('이미지로 저장했어요');
  };

  return (
    <>
      <SubHeader title="오늘의 운세" />
      <main className="screen">
        <SegTabs value={tab} onChange={setTab} tabs={[
          { value: 'today', label: '오늘' },
          { value: 'week', label: '이번 주' },
          { value: 'month', label: <>이번 달 <span className="lock" aria-label="프리미엄">✦</span></> },
        ]} />

        {tab === 'today' && (
          <>
            <CharacterBubble who="sunnyeo">{who}, {f.oneLine}</CharacterBubble>
            <section className="panel" aria-label="오늘의 점수">
              <div className="date">{koDate()} · {f.dayPillar.text}일({f.dayPillar.hanja}日){isSample && <span className="sample-tag">예시</span>}</div>
              <ScoreStars score={f.total} stars={f.stars} />
              {FIELDS.map((k) => (
                <CategoryRow key={k} label={FIELD_LABEL[k]} color={FIELD_COLOR[k]} summary={f.fields[k].summary} stars={f.fields[k].stars} to={`/today/${k}`} />
              ))}
            </section>
            <LuckyGrid color={f.lucky.color} colorHex={f.lucky.hex} number={f.lucky.number} direction={f.lucky.direction} />
            {isSample && <p className="note">예시 화면이에요. <Link to="/profile/new" className="u">내 정보를 입력</Link>하면 나만의 운세로 바뀌어요.</p>}
            <AdSlot premium={premium} />
            <div className="btn-row">
              <button className="btn line" onClick={share}>📤 공유하기</button>
              <button className="btn line" onClick={save}>🖼 이미지 저장</button>
            </div>
          </>
        )}

        {tab === 'week' && (
          <>
            <CharacterBubble who="sunnyeo">{who}, {w.line}</CharacterBubble>
            <section className="panel" aria-label="이번 주 흐름">
              <div className="date">{w.start.slice(4, 6).replace(/^0/, '')}월 {+w.start.slice(6)}일 주간</div>
              <ScoreStars score={w.total} stars={w.stars} />
              <ol className="weekbars">
                {w.days.map((d, i) => (
                  <li key={d.date} className={d.date === f.date ? 'on' : ''}>
                    <span className="bar" style={{ height: `${((d.total - 50) / 46) * 100}%` }} />
                    <b>{d.total}</b>
                    <small>{DOW[(i + 1) % 7]}</small>
                  </li>
                ))}
              </ol>
              <p className="muted">가장 좋은 날: {DOW[(w.days.indexOf(w.best) + 1) % 7]}요일 ({w.best.pillar.text}일)</p>
            </section>
            <AdSlot premium={premium} />
          </>
        )}

        {tab === 'month' && (
          <>
            <CharacterBubble who="sunnyeo">이번 달은 {m.pillar.text}월({m.pillar.hanja}月)이에요. 한 달 흐름을 짚어 볼게요.</CharacterBubble>
            {premium ? <MonthPanel m={m} /> : <PremiumLock><MonthPanel m={m} /></PremiumLock>}
          </>
        )}

        <SectionHeader en="MORE" title="더 깊이 알고 싶다면" />
        <RareListItem to="/consult?who=dosa&product=saju" img="dosaFace" title="천궁도령 정통사주" desc="타고난 그릇과 앞으로 10년 흐름" price="✦" />
      </main>
      <ShareCard ref={cardRef} title="오늘의 운세" sub={koDate()}>
        <p style={{ fontSize: 20, fontWeight: 800 }}>{who}</p>
        <ScoreStars score={f.total} stars={f.stars} />
        <div className="oneline" style={{ marginBottom: 14 }}>“{f.oneLine}”</div>
        {FIELDS.map((k) => (
          <div key={k} className="cat"><b style={{ color: FIELD_COLOR[k] }}>{FIELD_LABEL[k]}</b><p>{f.fields[k].summary}</p><Stars n={f.fields[k].stars} /></div>
        ))}
      </ShareCard>
    </>
  );
}

function MonthPanel({ m }: { m: ReturnType<typeof useMonthFortune> }) {
  return (
    <section className="panel">
      <ScoreStars score={m.total} stars={m.stars} />
      <p className="oneline">{m.line}</p>
      {FIELDS.map((k) => (
        <div key={k} className="cat"><b style={{ color: FIELD_COLOR[k] }}>{FIELD_LABEL[k]}</b><p /><Stars n={m.fields[k]} /></div>
      ))}
    </section>
  );
}

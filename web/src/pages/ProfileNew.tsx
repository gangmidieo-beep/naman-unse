// 사주 정보 입력 — 월하선녀가 한 칸씩 묻는 대화형(한 화면에 질문 하나).
// 이름 → 성별 → 생년월일 → 양력 / 음력(평달) / 음력(윤달) → 태어난 시(모름) → (첫 실행) 푸시 알림 수신 동의 → 확인
import { useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { leapMonthOf, lunarToSolar, LUNAR_YEAR_MAX, LUNAR_YEAR_MIN } from '@naman/engine';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, ChipGroup, SegTabs, useToast } from '../components/ui';
import { newId, useApp, useProfileLimit, type Profile } from '../store/app';

export const HOURS = [
  ['자시', '밤 11시~새벽 1시'], ['축시', '새벽 1시~3시'], ['인시', '새벽 3시~5시'], ['묘시', '새벽 5시~7시'],
  ['진시', '오전 7시~9시'], ['사시', '오전 9시~11시'], ['오시', '오전 11시~오후 1시'], ['미시', '오후 1시~3시'],
  ['신시', '오후 3시~5시'], ['유시', '오후 5시~7시'], ['술시', '저녁 7시~9시'], ['해시', '밤 9시~11시'],
] as const;
// 저장 시각(0~23) → 12지시 index. 엔진과 같은 규칙: floor(((h+1)%24)/2)
export const hourBranch = (h: number) => Math.floor(((h + 1) % 24) / 2);
export const hourLabel = (h: number | null) => (h == null ? '시간 모름' : `${HOURS[hourBranch(h)][0]} (${HOURS[hourBranch(h)][1]})`);
export const birthLabel = (p: Pick<Profile, 'calendar' | 'leap' | 'year' | 'month' | 'day'>) =>
  `${p.calendar === 'lunar' ? `음력${p.leap ? '(윤달)' : ''}` : '양력'} ${p.year}년 ${p.month}월 ${p.day}일`;

type Step = 'name' | 'gender' | 'birth' | 'calendar' | 'hour' | 'push' | 'confirm';
type Cal = 'solar' | 'lunar' | 'leap';
const THIS_YEAR = new Date().getFullYear();
const RELATIONS = ['나', '배우자', '연인', '자녀', '부모', '형제', '친구'];

function validDate(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export default function ProfileNew() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { profiles, saveProfile, pushConsent, setPushConsent } = useApp();
  const { canAdd } = useProfileLimit();
  const editing = profiles.find((p) => p.id === id);
  const first = !profiles.length;
  const steps: Step[] = ['name', 'gender', 'birth', 'calendar', 'hour', ...(pushConsent == null && !editing ? (['push'] as Step[]) : []), 'confirm'];
  const [step, setStep] = useState<Step>('name');
  const [p, setP] = useState<Profile>(
    editing ?? { id: newId(), name: '', gender: 'F', year: 1970, month: 1, day: 1, calendar: 'solar', leap: false, hour: null, relation: first ? '나' : sp.get('rel') ?? undefined },
  );
  const [touched, setTouched] = useState({ gender: !!editing, hour: !!editing });
  const [mode, setMode] = useState<'digits' | 'select'>('digits');
  const [digits, setDigits] = useState(editing ? `${editing.year}${String(editing.month).padStart(2, '0')}${String(editing.day).padStart(2, '0')}` : '');
  const [push, setPush] = useState(true);
  const [err, setErr] = useState('');
  if (!editing && !canAdd) return <Navigate to="/premium" replace />;
  const idx = steps.indexOf(step);
  const up = (x: Partial<Profile>) => setP((o) => ({ ...o, ...x }));
  const cal: Cal = p.calendar === 'solar' ? 'solar' : p.leap ? 'leap' : 'lunar';
  const leapMonth = leapMonthOf(p.year);

  const next = () => {
    setErr('');
    if (step === 'name' && !p.name.trim()) return setErr('이름(또는 별명)을 적어 주세요.');
    if (step === 'birth' && mode === 'digits') {
      if (!/^\d{8}$/.test(digits)) return setErr('숫자 8자리로 적어 주세요. 예) 19680315');
      const y = +digits.slice(0, 4), m = +digits.slice(4, 6), d = +digits.slice(6, 8);
      if (y < LUNAR_YEAR_MIN || y > THIS_YEAR || m < 1 || m > 12 || d < 1 || d > 31) return setErr(`${LUNAR_YEAR_MIN}년~${THIS_YEAR}년 사이 날짜를 적어 주세요.`);
      up({ year: y, month: m, day: d });
    }
    if (step === 'calendar') {
      if (p.calendar === 'solar' && !validDate(p.year, p.month, p.day)) return setErr('없는 날짜예요. 생년월일을 다시 확인해 주세요.');
      if (p.calendar === 'lunar') {
        if (p.year > LUNAR_YEAR_MAX) return setErr(`음력은 ${LUNAR_YEAR_MAX}년까지 계산할 수 있어요.`);
        try { lunarToSolar(p.year, p.month, p.day, p.leap); } catch (e) { return setErr((e as Error).message); }
      }
    }
    setStep(steps[idx + 1]);
  };
  const back = () => (idx === 0 ? nav(-1) : setStep(steps[idx - 1]));
  const save = () => {
    if (steps.includes('push')) setPushConsent(push);
    saveProfile({ ...p, name: p.name.trim() }, !editing && (first || sp.get('main') === '1'));
    toast(editing ? '정보를 고쳤어요' : `${p.name}님의 운세가 준비됐어요`);
    nav(sp.get('back') || '/', { replace: true });
  };

  return (
    <>
      <SubHeader title={editing ? '사주 정보 고치기' : '사주 정보 입력'} right={<span className="muted" style={{ fontSize: 14 }}>{idx + 1}/{steps.length}</span>} />
      <div className="progress mt14" aria-hidden><i style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>
      <main className="screen no-tab" key={step}>
        {step === 'name' && (
          <>
            <CharacterBubble who="wolha">{first ? '반가워요! 제가 무엇이라고 불러 드리면 될까요?' : '누구의 사주를 저장할까요? 이름과 관계를 알려 주세요.'}</CharacterBubble>
            <div className="form">
              <div className="field">
                <label htmlFor="nm">이름 또는 별명</label>
                <input id="nm" className="input" value={p.name} maxLength={12} autoFocus placeholder="예) 홍길동" onChange={(e) => up({ name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && next()} />
              </div>
              {!first && (
                <div className="field">
                  <span className="lbl">관계</span>
                  <div className="opts c3">{RELATIONS.map((r) => <button key={r} className={`opt${p.relation === r ? ' on' : ''}`} aria-pressed={p.relation === r} onClick={() => up({ relation: r })}>{r}</button>)}</div>
                </div>
              )}
            </div>
          </>
        )}
        {step === 'gender' && (
          <>
            <CharacterBubble who="wolha">{p.name}님, 성별을 알려 주세요. 대운 흐름을 읽을 때 필요해요.</CharacterBubble>
            <ChipGroup value={touched.gender ? p.gender : null} onChange={(g) => { up({ gender: g }); setTouched((t) => ({ ...t, gender: true })); }}
              options={[{ value: 'F', label: '여성' }, { value: 'M', label: '남성' }]} />
          </>
        )}
        {step === 'birth' && (
          <>
            <CharacterBubble who="wolha">태어난 날을 알려 주세요.</CharacterBubble>
            <SegTabs value={mode} onChange={setMode} tabs={[{ value: 'digits', label: '숫자로 입력' }, { value: 'select', label: '골라서 입력' }]} />
            <div className="form">
              {mode === 'digits' ? (
                <div className="field">
                  <label htmlFor="bd">생년월일 8자리</label>
                  <input id="bd" className="input big" inputMode="numeric" autoFocus maxLength={8} placeholder="19680315" value={digits}
                    onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 8))} onKeyDown={(e) => e.key === 'Enter' && next()} />
                </div>
              ) : (
                <div className="selects" role="group" aria-label="생년월일">
                  <select aria-label="태어난 해" value={p.year} onChange={(e) => up({ year: +e.target.value })}>
                    {Array.from({ length: THIS_YEAR - LUNAR_YEAR_MIN + 1 }, (_, i) => THIS_YEAR - i).map((y) => <option key={y} value={y}>{y}년</option>)}
                  </select>
                  <select aria-label="태어난 달" value={p.month} onChange={(e) => up({ month: +e.target.value })}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
                  </select>
                  <select aria-label="태어난 날" value={p.day} onChange={(e) => up({ day: +e.target.value })}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}일</option>)}
                  </select>
                </div>
              )}
            </div>
          </>
        )}
        {step === 'calendar' && (
          <>
            <CharacterBubble who="wolha">{p.year}년 {p.month}월 {p.day}일은 양력인가요, 음력인가요?</CharacterBubble>
            <div className="form">
              <div className="opts c3" role="radiogroup">
                {([['solar', '양력', ''], ['lunar', '음력', '평달'], ['leap', '음력', '윤달']] as const).map(([v, a, b]) => (
                  <button key={v} role="radio" aria-checked={cal === v} className={`opt${cal === v ? ' on' : ''}`}
                    onClick={() => up({ calendar: v === 'solar' ? 'solar' : 'lunar', leap: v === 'leap' })}>{a}<small>{b || ' '}</small></button>
                ))}
              </div>
              {cal === 'leap' && <p className="muted mt8">{leapMonth ? `${p.year}년 윤달은 윤${leapMonth}월이에요.` : `${p.year}년에는 윤달이 없어요.`}</p>}
            </div>
          </>
        )}
        {step === 'hour' && (
          <>
            <CharacterBubble who="wolha">태어난 시간을 아시나요? 모르셔도 괜찮아요.</CharacterBubble>
            <div className="form">
              <div className="opts c3">
                {HOURS.map(([n, t], i) => {
                  const on = touched.hour && p.hour != null && hourBranch(p.hour) === i;
                  return <button key={n} className={`opt${on ? ' on' : ''}`} aria-pressed={on} onClick={() => { up({ hour: i * 2 }); setTouched((x) => ({ ...x, hour: true })); }}>{n}<small>{t}</small></button>;
                })}
                <button className={`opt wide${touched.hour && p.hour == null ? ' on' : ''}`} aria-pressed={touched.hour && p.hour == null} onClick={() => { up({ hour: null }); setTouched((x) => ({ ...x, hour: true })); }}>시간을 몰라요</button>
              </div>
            </div>
          </>
        )}
        {step === 'push' && (
          <>
            <CharacterBubble who="wolha">매일 아침 오늘의 운세를 알림으로 보내 드려도 될까요?</CharacterBubble>
            <div className="form">
              <div className="opts c2" role="radiogroup">
                <button role="radio" aria-checked={push} className={`opt${push ? ' on' : ''}`} onClick={() => setPush(true)}>네, 받을게요<small>오전 7시 (바꿀 수 있어요)</small></button>
                <button role="radio" aria-checked={!push} className={`opt${!push ? ' on' : ''}`} onClick={() => setPush(false)}>나중에<small>운세함에서 켤 수 있어요</small></button>
              </div>
            </div>
          </>
        )}
        {step === 'confirm' && (
          <>
            <CharacterBubble who="wolha">이대로 저장할까요? 저장하면 바로 {p.name}님만의 운세로 바뀌어요.</CharacterBubble>
            <div className="panel">
              <dl className="summary">
                <dt>이름</dt><dd>{p.name}{p.relation ? ` (${p.relation})` : ''}</dd>
                <dt>성별</dt><dd>{p.gender === 'F' ? '여성' : '남성'}</dd>
                <dt>생년월일</dt><dd>{birthLabel(p)}</dd>
                <dt>태어난 시</dt><dd>{hourLabel(p.hour)}</dd>
                {steps.includes('push') && <><dt>운세 알림</dt><dd>{push ? '받기 (오전 7시)' : '받지 않기'}</dd></>}
              </dl>
            </div>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        <div className="pad mt14">
          {step === 'confirm' ? (
            <Button kind="gold" onClick={save}>저장하고 운세 보기</Button>
          ) : (
            <Button kind="ink" onClick={next} disabled={(step === 'gender' && !touched.gender) || (step === 'hour' && !touched.hour)}>다음</Button>
          )}
          {idx > 0 && <div className="center"><button className="textlink" onClick={back}>이전으로</button></div>}
        </div>
      </main>
    </>
  );
}

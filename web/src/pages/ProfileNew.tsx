// S1 사주 정보 입력 — 월하선녀가 한 칸씩 묻는 대화형. 한 화면에 질문 하나.
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { leapMonthOf, lunarToSolar, LUNAR_YEAR_MAX, LUNAR_YEAR_MIN } from '@naman/engine';
import { SubHeader } from '../components/layout';
import { Button, CharacterBubble, ChipGroup, SegTabs, useToast } from '../components/ui';
import { newId, useApp, type Profile } from '../store/app';

export const HOURS = [
  ['자시', '밤 11시~새벽 1시'], ['축시', '새벽 1시~3시'], ['인시', '새벽 3시~5시'], ['묘시', '새벽 5시~7시'],
  ['진시', '오전 7시~9시'], ['사시', '오전 9시~11시'], ['오시', '오전 11시~오후 1시'], ['미시', '오후 1시~3시'],
  ['신시', '오후 3시~5시'], ['유시', '오후 5시~7시'], ['술시', '저녁 7시~9시'], ['해시', '밤 9시~11시'],
] as const;
// 저장 시각(0~23) → 12지시 index. 엔진과 같은 규칙: floor(((h+1)%24)/2)
export const hourBranch = (h: number) => Math.floor(((h + 1) % 24) / 2);
export const hourLabel = (h: number | null) => (h == null ? '시간 모름' : `${HOURS[hourBranch(h)][0]} (${HOURS[hourBranch(h)][1]})`);
export const birthLabel = (p: Profile) =>
  `${p.calendar === 'lunar' ? `음력${p.leap ? '(윤달)' : ''}` : '양력'} ${p.year}년 ${p.month}월 ${p.day}일`;

type Step = 'name' | 'gender' | 'birth' | 'calendar' | 'hour' | 'confirm';
const STEPS: Step[] = ['name', 'gender', 'birth', 'calendar', 'hour', 'confirm'];
const THIS_YEAR = new Date().getFullYear();

function validDate(y: number, m: number, d: number) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export default function ProfileNew() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { profiles, saveProfile } = useApp();
  const editing = profiles.find((p) => p.id === id);
  const [step, setStep] = useState<Step>('name');
  const [p, setP] = useState<Profile>(
    editing ?? { id: newId(), name: '', gender: 'F', year: 1970, month: 1, day: 1, calendar: 'solar', leap: false, hour: null },
  );
  const [touched, setTouched] = useState({ gender: !!editing, birth: !!editing, hour: !!editing });
  const [mode, setMode] = useState<'digits' | 'select'>('digits');
  const [digits, setDigits] = useState(editing ? `${editing.year}${String(editing.month).padStart(2, '0')}${String(editing.day).padStart(2, '0')}` : '');
  const [err, setErr] = useState('');
  const idx = STEPS.indexOf(step);
  const up = (x: Partial<Profile>) => setP((o) => ({ ...o, ...x }));
  const leapMonth = useMemo(() => (p.calendar === 'lunar' ? leapMonthOf(p.year) : null), [p.calendar, p.year]);

  const next = () => {
    setErr('');
    if (step === 'name' && !p.name.trim()) return setErr('이름(또는 별명)을 적어 주세요.');
    if (step === 'birth') {
      if (mode === 'digits') {
        if (!/^\d{8}$/.test(digits)) return setErr('숫자 8자리로 적어 주세요. 예) 19680315');
        const y = +digits.slice(0, 4), m = +digits.slice(4, 6), d = +digits.slice(6, 8);
        if (y < LUNAR_YEAR_MIN || y > THIS_YEAR || m < 1 || m > 12 || d < 1 || d > 31) return setErr(`${LUNAR_YEAR_MIN}년~${THIS_YEAR}년 사이 날짜를 적어 주세요.`);
        up({ year: y, month: m, day: d });
      }
      setTouched((t) => ({ ...t, birth: true }));
    }
    if (step === 'calendar') {
      if (p.calendar === 'solar' && !validDate(p.year, p.month, p.day)) return setErr('없는 날짜예요. 생년월일을 다시 확인해 주세요.');
      if (p.calendar === 'lunar') {
        if (p.year > LUNAR_YEAR_MAX) return setErr(`음력은 ${LUNAR_YEAR_MAX}년까지 계산할 수 있어요.`);
        try { lunarToSolar(p.year, p.month, p.day, p.leap); } catch (e) { return setErr((e as Error).message); }
      }
    }
    setStep(STEPS[idx + 1]);
  };
  const back = () => (idx === 0 ? nav(-1) : setStep(STEPS[idx - 1]));
  const save = () => {
    saveProfile({ ...p, name: p.name.trim() }, !editing || sp.get('main') === '1');
    toast(editing ? '정보를 고쳤어요' : `${p.name}님의 운세가 준비됐어요`);
    nav(sp.get('back') || '/', { replace: true });
  };

  return (
    <>
      <SubHeader title={editing ? '내 정보 고치기' : '내 정보 입력'} right={<span className="muted" style={{ paddingRight: 12 }}>{Math.min(idx + 1, 5)} / 5</span>} />
      <main className="screen no-tab" key={step}>
        {step === 'name' && (
          <>
            <CharacterBubble who="sunnyeo">반가워요! 제가 무엇이라고 불러 드리면 될까요?</CharacterBubble>
            <div className="field">
              <label htmlFor="nm">이름 또는 별명</label>
              <input id="nm" className="input" value={p.name} maxLength={12} autoFocus placeholder="예) 홍길동" onChange={(e) => up({ name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && next()} />
            </div>
          </>
        )}
        {step === 'gender' && (
          <>
            <CharacterBubble who="sunnyeo">{p.name}님, 성별을 알려 주세요. 대운 흐름을 읽을 때 필요해요.</CharacterBubble>
            <ChipGroup align="left" value={touched.gender ? p.gender : null} onChange={(g) => { up({ gender: g }); setTouched((t) => ({ ...t, gender: true })); }}
              options={[{ value: 'F', label: '여성' }, { value: 'M', label: '남성' }]} />
          </>
        )}
        {step === 'birth' && (
          <>
            <CharacterBubble who="sunnyeo">태어난 날을 알려 주세요.</CharacterBubble>
            <SegTabs value={mode} onChange={setMode} tabs={[{ value: 'digits', label: '숫자로 입력' }, { value: 'select', label: '골라서 입력' }]} />
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
          </>
        )}
        {step === 'calendar' && (
          <>
            <CharacterBubble who="sunnyeo">{p.year}년 {p.month}월 {p.day}일은 양력인가요, 음력인가요?</CharacterBubble>
            <ChipGroup align="left" value={p.calendar} onChange={(c) => up({ calendar: c, leap: false })}
              options={[{ value: 'solar', label: '양력' }, { value: 'lunar', label: '음력' }]} />
            {p.calendar === 'lunar' && leapMonth === p.month && (
              <label className="check"><input type="checkbox" checked={p.leap} onChange={(e) => up({ leap: e.target.checked })} />윤달이에요 ({p.year}년 윤{leapMonth}월)</label>
            )}
            {p.calendar === 'lunar' && leapMonth !== p.month && <p className="muted mt8">{p.year}년 {p.month}월은 윤달이 없어요.</p>}
          </>
        )}
        {step === 'hour' && (
          <>
            <CharacterBubble who="sunnyeo">태어난 시간을 아시나요? 모르셔도 괜찮아요.</CharacterBubble>
            <div className="hourgrid">
              {HOURS.map(([n, t], i) => (
                <button key={n} className={touched.hour && p.hour != null && hourBranch(p.hour) === i ? 'on' : ''} aria-pressed={touched.hour && p.hour != null && hourBranch(p.hour) === i}
                  onClick={() => { up({ hour: i * 2 }); setTouched((x) => ({ ...x, hour: true })); }}>
                  {n}<small>{t}</small>
                </button>
              ))}
              <button className={`wide${touched.hour && p.hour == null ? ' on' : ''}`} aria-pressed={touched.hour && p.hour == null} onClick={() => { up({ hour: null }); setTouched((x) => ({ ...x, hour: true })); }}>
                시간을 몰라요
              </button>
            </div>
          </>
        )}
        {step === 'confirm' && (
          <>
            <CharacterBubble who="sunnyeo">이대로 저장할까요? 저장하면 바로 {p.name}님만의 운세로 바뀌어요.</CharacterBubble>
            <div className="panel">
              <dl className="summary">
                <dt>이름</dt><dd>{p.name}</dd>
                <dt>성별</dt><dd>{p.gender === 'F' ? '여성' : '남성'}</dd>
                <dt>생년월일</dt><dd>{birthLabel(p)}</dd>
                <dt>태어난 시간</dt><dd>{hourLabel(p.hour)}</dd>
              </dl>
            </div>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        {step === 'confirm' ? (
          <Button onClick={save}>저장하고 운세 보기</Button>
        ) : (
          <Button onClick={next} disabled={(step === 'gender' && !touched.gender) || (step === 'hour' && !touched.hour)}>다음</Button>
        )}
        {idx > 0 && <div className="center"><button className="textlink" onClick={back}>이전으로</button></div>}
      </main>
    </>
  );
}

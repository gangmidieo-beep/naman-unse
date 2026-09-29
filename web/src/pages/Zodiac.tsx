// S5 띠별 운세 — 12띠 → 출생연도별 한 줄. 월하선녀.
import { Link, Navigate, useParams } from 'react-router-dom';
import { ZODIAC_KEYS, zodiacToday, zodiacOfYear } from '../lib/zodiac';
import { SubHeader, SectionHeader } from '../components/layout';
import { AdSlot, CharacterBubble, Stars, ZodiacGrid } from '../components/ui';
import { useApp, useMainProfile } from '../store/app';
import { koDate } from '../lib/dates';

export function ZodiacList() {
  const { profile, isSample } = useMainProfile();
  const mine = zodiacOfYear(profile.year);
  return (
    <>
      <SubHeader title="띠별 운세" back={false} />
      <main className="screen">
        <CharacterBubble who="sunnyeo">오늘 열두 띠의 흐름을 살펴봤어요. 궁금한 띠를 눌러 보세요.</CharacterBubble>
        {!isSample && (
          <Link to={`/zodiac/${ZODIAC_KEYS[mine]}`} className="panel mine">
            <span className="muted">{profile.name}님은</span><b>{zodiacToday(mine, new Date()).name}띠</b><span className="chev">바로 보기 ›</span>
          </Link>
        )}
        <SectionHeader en="ZODIAC" title="12띠 오늘 흐름" desc={koDate()} />
        <ZodiacGrid active={isSample ? undefined : ZODIAC_KEYS[mine]} />
      </main>
    </>
  );
}

export function ZodiacDetail() {
  const { animal } = useParams();
  const premium = useApp((s) => s.premium);
  const i = ZODIAC_KEYS.indexOf(animal as (typeof ZODIAC_KEYS)[number]);
  if (i < 0) return <Navigate to="/zodiac" replace />;
  const z = zodiacToday(i, new Date());
  return (
    <>
      <SubHeader title={`${z.name}띠 오늘의 운세`} />
      <main className="screen">
        <section className="panel zhead">
          <i aria-hidden>{z.hanja}</i>
          <div>
            <div className="date">{koDate()} · {z.dayPillar.text}일</div>
            <b>{z.name}띠</b> <Stars n={z.stars} />
          </div>
        </section>
        <CharacterBubble who="sunnyeo">{z.line}</CharacterBubble>
        <SectionHeader en="BY YEAR" title="태어난 해별 한마디" />
        <ul className="years">
          {z.years.map((y) => (
            <li key={y.year}><b>{y.year}년생</b><p>{y.line}</p></li>
          ))}
        </ul>
        <AdSlot premium={premium} />
        <SectionHeader en="OTHERS" title="다른 띠도 보기" />
        <ZodiacGrid active={z.key} />
      </main>
    </>
  );
}

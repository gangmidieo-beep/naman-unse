// 띠별 운세 (무료 · 재미로 보는 운세) — 12띠 → 오늘 한 줄 + 출생연도별 한 줄. 결과 보기 전 보상형 광고(하루 1회, 프리미엄 제외).
import { useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ZODIAC_KEYS, ZODIAC_NAMES, ZODIAC_HANJA, zodiacToday } from '@naman/content';
import { SubHeader, SectionHeader } from '../components/layout';
import { AdSlot, Button, CharacterBubble, Stars, useToast } from '../components/ui';
import { ShareSheet } from '../components/ShareSheet';
import { ShareCard } from '../components/ShareCard';
import { useRewarded } from '../components/Rewarded';
import { isUnlockedToday, useApp, useMainProfile, usePremium } from '../store/app';
import { koDate } from '../lib/dates';

export const zodiacOfYear = (y: number) => (((y - 4) % 12) + 12) % 12;

function Grid({ active }: { active?: number }) {
  return (
    <div className="zodiac">
      {ZODIAC_KEYS.map((k, i) => (
        <Link key={k} to={`/zodiac/${k}`} className={`z${active === i ? ' on' : ''}`} aria-label={`${ZODIAC_NAMES[i]}띠 운세`}>
          <i aria-hidden>{ZODIAC_HANJA[i]}</i><span>{ZODIAC_NAMES[i]}띠</span>
        </Link>
      ))}
    </div>
  );
}

export function ZodiacList() {
  const { profile, isSample } = useMainProfile();
  const mine = zodiacOfYear(profile.year);
  return (
    <>
      <SubHeader title="띠별 운세" sub="오늘 나의 띠 운세는?" />
      <main className="screen">
        <div className="mt14" />
        <CharacterBubble who="wolha">오늘 열두 띠의 흐름을 살펴봤어요. 궁금한 띠를 눌러 보세요.</CharacterBubble>
        {!isSample && (
          <div className="pad"><Button kind="gold" to={`/zodiac/${ZODIAC_KEYS[mine]}`}>{profile.name}님의 {ZODIAC_NAMES[mine]}띠 운세 바로 보기</Button></div>
        )}
        <SectionHeader en="ZODIAC" title="12띠 오늘 흐름" desc={koDate()} />
        <Grid active={isSample ? undefined : mine} />
      </main>
    </>
  );
}

export function ZodiacDetail() {
  const { animal } = useParams();
  const premium = usePremium();
  const { unlocked, unlock } = useApp();
  const { run, modal } = useRewarded();
  const toast = useToast();
  const [share, setShare] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const i = ZODIAC_KEYS.indexOf(animal as (typeof ZODIAC_KEYS)[number]);
  if (i < 0) return <Navigate to="/zodiac" replace />;
  const z = zodiacToday(i, new Date());
  const key = `zodiac:${z.key}`;
  const open = premium || isUnlockedToday(unlocked, key);
  return (
    <>
      <SubHeader title={`${z.name}띠 오늘의 운세`} sub={koDate()} />
      <main className="screen">
        <section className="panel zhead mt14">
          <i aria-hidden>{z.hanja}</i>
          <div><div className="muted">{z.dayPillar.text}일</div><b>{z.name}띠</b> <Stars n={z.stars} /></div>
        </section>
        {!open ? (
          <div className="pad">
            <Button kind="gold" onClick={() => run(() => unlock(key), 'zodiac')}>✦ {z.name}띠 오늘 운세 보기</Button>
            <div className="adnote">짧은 광고를 보시면 결과가 열립니다 · 프리미엄 회원은 광고 없음</div>
          </div>
        ) : (
          <>
            <CharacterBubble who="wolha">{z.line}</CharacterBubble>
            <SectionHeader en="BY YEAR" title="태어난 해별 한마디" />
            <ul className="years">{z.years.map((y) => <li key={y.year}><b>{y.year}년생</b><p>{y.line}</p></li>)}</ul>
            <div className="pad mt14"><Button kind="ink" onClick={() => setShare(true)}>결과 이미지로 공유하기</Button></div>
          </>
        )}
        <AdSlot premium={premium} />
        <SectionHeader en="OTHERS" title="다른 띠도 보기" />
        <Grid active={i} />
      </main>
      {modal}
      <ShareSheet open={share} onClose={() => setShare(false)} card={cardRef} title={`${z.name}띠 오늘의 운세`} text={`${z.name}띠 오늘 — ${z.line}`} path={`/zodiac/${z.key}`} contentId={`zodiac-${z.key}`} onDone={(m) => m && toast(m)} />
      <ShareCard ref={cardRef} title={`${z.name}띠 오늘의 운세`} sub={koDate()}>
        <p style={{ fontFamily: 'var(--brush)', fontSize: 80, textAlign: 'center', color: 'var(--ink)', lineHeight: 1.1 }}>{z.hanja}</p>
        <p style={{ fontFamily: 'var(--serif)', fontSize: 20, lineHeight: 1.7, margin: '10px 0' }}>{z.line}</p>
        {z.years.slice(0, 4).map((y) => <p key={y.year} style={{ fontSize: 16, lineHeight: 1.6 }}><b>{y.year}년생</b> {y.line}</p>)}
      </ShareCard>
    </>
  );
}

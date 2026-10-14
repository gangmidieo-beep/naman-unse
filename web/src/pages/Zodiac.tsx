// 띠별 운세 (무료 · 재미로 보는 운세) — 12띠 → 오늘 한 줄 + 출생연도별 2~3줄. 결과 보기 전 보상형 광고(하루 1회, 프리미엄 제외).
// 3차 요청(대표님 시안): 한자 대신 동물 그림 + 한글 띠 이름, 해별 한마디 ① 오늘의 흐름 ② 주의할 점·기회 ③ 행동 조언, 행운의 색·숫자·방향·키워드
import { useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ZODIAC_KEYS, ZODIAC_NAMES, ZODIAC_HANJA, zodiacToday } from '@naman/content';
import { SubHeader, SectionHeader } from '../components/layout';
import { AdSlot, Button, CharacterBubble, Stars, useToast } from '../components/ui';
import { ShareSheet } from '../components/ShareSheet';
import { ShareCard } from '../components/ShareCard';
import { useRewarded } from '../components/Rewarded';
import { Icon } from '../components/Icon';
import { funImg } from '../components/FunArt';
import { isUnlockedToday, useApp, useMainProfile, usePremium } from '../store/app';
import { koDate } from '../lib/dates';

export const zodiacOfYear = (y: number) => (((y - 4) % 12) + 12) % 12;
// 한글 띠 이름(시안: 호랑이띠) — 엔진 이름(범)은 그대로 두고 화면만
export const ZODIAC_KO = ZODIAC_NAMES.map((n) => (n === '범' ? '호랑이' : n));
const zImg = (i: number) => funImg(`zodiac_${ZODIAC_KEYS[i]}`);

function Grid({ active, mine }: { active?: number; mine?: number }) {
  return (
    <div className="zgrid">
      {ZODIAC_KEYS.map((k, i) => (
        <Link key={k} to={`/zodiac/${k}`} className={`zc${active === i ? ' on' : ''}`} aria-label={`${ZODIAC_KO[i]}띠 운세`} aria-current={active === i ? 'page' : undefined}>
          <img src={zImg(i)} alt="" loading="lazy" decoding="async" />
          <b>{ZODIAC_KO[i]}띠</b>
          <small>— {ZODIAC_HANJA[i]} —</small>
          {mine === i && <em>나의 띠</em>}
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
      <main className="screen fun-page">
        <img className="fun-deco" src={funImg('fun_deco')} alt="" aria-hidden />
        <div className="mt14" />
        <CharacterBubble who="wolha">오늘 열두 띠의 흐름을 살펴봤어요. 궁금한 띠를 눌러 보세요.</CharacterBubble>
        {!isSample && (
          <div className="pad"><Button kind="gold" to={`/zodiac/${ZODIAC_KEYS[mine]}`}>{profile.name}님의 {ZODIAC_KO[mine]}띠 운세 바로 보기</Button></div>
        )}
        <SectionHeader en="ZODIAC" title="12띠 오늘 흐름" desc={koDate()} />
        <Grid active={isSample ? undefined : mine} mine={isSample ? undefined : mine} />
      </main>
    </>
  );
}

const LUCKY_ICON = { color: 'flower', number: 'circle-dot', direction: 'compass', keyword: 'clover' };
export function ZodiacDetail() {
  const { animal } = useParams();
  const premium = usePremium();
  const { profile, isSample } = useMainProfile();
  const { unlocked, unlock } = useApp();
  const { run, modal } = useRewarded();
  const toast = useToast();
  const [share, setShare] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const i = ZODIAC_KEYS.indexOf(animal as (typeof ZODIAC_KEYS)[number]);
  if (i < 0) return <Navigate to="/zodiac" replace />;
  const z = zodiacToday(i, new Date());
  const myYear = isSample ? 0 : profile.year;
  const name = ZODIAC_KO[i];
  const key = `zodiac:${z.key}`;
  const open = premium || isUnlockedToday(unlocked, key);
  const lucky = [
    { k: 'color', label: '행운의 색', v: z.lucky.color },
    { k: 'number', label: '행운의 숫자', v: String(z.lucky.number) },
    { k: 'direction', label: '행운의 방향', v: z.lucky.direction },
    { k: 'keyword', label: '오늘의 키워드', v: z.keywords.join(' · ') },
  ] as const;
  return (
    <>
      <SubHeader title={`${name}띠 오늘의 운세`} sub={koDate()} />
      <main className="screen fun-page">
        <section className="zhero mt14">
          <div className="zpic"><img src={zImg(i)} alt={`${name}띠 그림`} /><span className="zbadge">{z.hanja}</span></div>
          <div className="ztxt">
            <h2>{name}띠 <Stars n={z.stars} /></h2>
            {open ? <><p className="zq">“{z.head}”</p><p className="zs">{z.sub}</p></> : <p className="zs">{z.dayPillar.text}일 · 오늘 {name}띠의 흐름을 열어 보세요.</p>}
          </div>
        </section>
        {!open ? (
          <div className="pad mt14">
            <Button kind="gold" onClick={() => run(() => unlock(key), 'zodiac')}>✦ {name}띠 오늘 운세 보기</Button>
            <div className="adnote">짧은 광고를 보시면 결과가 열립니다 · 프리미엄 회원은 광고 없음</div>
          </div>
        ) : (
          <>
            <div className="zlucky">
              {lucky.map((l) => (
                <div key={l.k}><i aria-hidden><Icon name={LUCKY_ICON[l.k]} size={22} /></i><span><small>{l.label}</small><b>{l.v}</b></span></div>
              ))}
            </div>
            <CharacterBubble who="wolha">{z.line}</CharacterBubble>
            <SectionHeader en="BY YEAR" title="출생연도별 오늘의 운세" desc="태어난 해에 따라 오늘의 흐름이 조금씩 다릅니다." />
            <ul className="zyears">
              {z.years.map((y, n) => (
                <li key={y.year} className={`t${n % 5}${y.year === myYear ? ' me' : ''}`}>
                  <div className="yy"><b>{y.year}년생</b><small>{y.age}세</small>{y.year === myYear && <em>나</em>}</div>
                  <div className="yt">
                    <b>{y.flow}</b>
                    <p>{y.care}</p>
                    <p>{y.act}</p>
                    <div className="ypt"><Icon name={y.point.icon} size={18} /><small>오늘의 포인트</small><span>{y.point.kw}</span></div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="pad mt14"><Button kind="ink" onClick={() => setShare(true)}>결과 이미지로 공유하기</Button></div>
          </>
        )}
        <AdSlot premium={premium} />
        <SectionHeader en="OTHERS" title="다른 띠도 보기" />
        <Grid active={i} />
      </main>
      {modal}
      <ShareSheet open={share} onClose={() => setShare(false)} card={cardRef} title={`${name}띠 오늘의 운세`} text={`${name}띠 오늘 — ${z.head}`} path={`/zodiac/${z.key}`} contentId={`zodiac-${z.key}`} onDone={(m) => m && toast(m)} />
      <ShareCard ref={cardRef} title={`${name}띠 오늘의 운세`} sub={koDate()}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <img src={zImg(i)} alt="" style={{ width: 150, borderRadius: 16 }} />
          <div><p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 30 }}>{name}띠</p><Stars n={z.stars} /></div>
        </div>
        <p style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 21, lineHeight: 1.6, margin: '14px 0 8px' }}>“{z.head}”</p>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink-3)' }}>행운의 색 {z.lucky.color} · 숫자 {z.lucky.number} · {z.lucky.direction}</p>
        {z.years.slice(0, 3).map((y) => <p key={y.year} style={{ fontSize: 16, lineHeight: 1.55, marginTop: 8 }}><b>{y.year}년생</b> {y.flow}</p>)}
      </ShareCard>
    </>
  );
}

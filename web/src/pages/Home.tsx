// 홈 v2 — 화면설계_v2 3장 순서: 헤더 → 히어로 → 오늘의 운세 카드 → 롤링 배너 10종 → 재미로 보는 운세 7종 → 나만의 운명 → 나만의 인연 → 나만의 부적 → 하단 광고
import { Link } from 'react-router-dom';
import { AppHeader, SectionHeader } from '../components/layout';
import { AdSlot, CharacterSectionHead, FreeCard, HeroDuo, RareCard, RollingBanner, TalismanPaper, TodayCard } from '../components/ui';
import { usePremium, useApp, useMainProfile } from '../store/app';
import { useTodayFortune } from '../lib/fortune';
import { BRAND, FATE, LOVE, TALISMANS } from '../lib/catalog';
import { optionalImg } from '../assets/images';
import { kstMonthDay } from '../lib/dates';

// 홈 가로 스크롤에 먼저 보일 상품(카탈로그 badge 가 있으면 그것 우선, 없으면 대표 상품)
const pick = <T extends { id: string; badge?: string | null }>(list: T[], ids: string[]) => {
  const badged = list.filter((p) => p.badge);
  return [...badged, ...ids.map((id) => list.find((p) => p.id === id)!).filter((p) => p && !badged.includes(p))].slice(0, 5);
};

export default function Home() {
  const { profile, isSample } = useMainProfile();
  const premium = usePremium();
  const purchases = useApp((s) => s.purchases);
  const f = useTodayFortune(profile);
  const owned = (id: string) => purchases.some((p) => p.productId === id);
  const banners = BRAND.banners.map((b) => ({ ...b, img: optionalImg(`banner_${b.link.split('/').pop()}`)?.src }));
  return (
    <>
      <AppHeader />
      <main className="screen">
        <HeroDuo />
        <TodayCard name={profile.name} isSample={isSample} date={`${kstMonthDay()} · ${f.dayPillar.text}일`} total={f.total} stars={f.stars} line={f.oneLine} />

        <SectionHeader en="SPECIAL" title={<>지금 많이 찾는 <em>풀이</em></>} />
        <RollingBanner items={banners} />

        <SectionHeader en="FOR FUN" title="재미로 보는 운세" desc="가볍게 즐기고, 새롭게 발견하는 나의 이야기" />
        <div className="g2">
          {BRAND.fun.map((x) => <FreeCard key={x.id} to={x.link} hanja={x.hanja} title={x.title} desc={x.copy} wide={x.id === 'dream'} />)}
        </div>

        <CharacterSectionHead who="cheongung" title="나만의 운명" desc="타고난 사주부터 재물과 성공, 운의 흐름까지" to="/fate" />
        <div className="hs">{pick(FATE, ['jeongtong', 'wealth', 'newyear', 'tojeong', 'daewoon']).map((p) => <RareCard key={p.id} p={p} owned={owned(p.id)} />)}</div>

        <CharacterSectionHead who="wolha" title="나만의 인연" desc="사랑과 인연 속에 숨겨진 이야기" to="/love" />
        <div className="hs">{pick(LOVE, ['gunghap', 'inyeon', 'reunion', 'marriage', 'love']).map((p) => <RareCard key={p.id} p={p} owned={owned(p.id)} />)}</div>

        <Link to="/talisman" className="bjentry">
          <div className="in">
            <TalismanPaper t={TALISMANS[8]} />
            <div><small>WISH TALISMAN</small><b>나만의 부적</b><span>간절한 소망을 마음에 담아, 나를 위한 특별한 부적을 만들어 보세요.</span></div>
          </div>
        </Link>

        <AdSlot premium={premium} kind="홈 하단 배너" />
      </main>
    </>
  );
}

import { useState } from 'react';
import { AppHeader, SectionHeader } from '../components/layout';
import { ComingSoonSheet, FreeCard, GreetingCard, NoticeCard, RareCard, ZodiacGrid, useToast } from '../components/ui';
import { useApp, useMainProfile } from '../store/app';
import { lunarPill, newYearTarget } from '../lib/dates';
import { useTodayFortune } from '../lib/fortune';
import { Icon } from '../components/Icon';

export default function Home() {
  const { profile, isSample } = useMainProfile();
  const { notifyOn, setNotify, purchases } = useApp();
  const today = useTodayFortune(profile);
  const toast = useToast();
  const [soon, setSoon] = useState<string | null>(null);
  const ny = newYearTarget();
  const owned = (id: string) => purchases.some((p) => p.productId === id || p.productId.startsWith(id + '_'));
  return (
    <>
      <AppHeader lunar={lunarPill()} />
      <main className="screen">
        <GreetingCard name={profile.name} isSample={isSample} score={today.total} stars={today.stars} oneLine={today.oneLine} />

        <SectionHeader en="FREE · DAILY" title={<>매일매일 <em>무료</em>로 보세요</>} desc="광고만 보면 모두 무료예요" />
        <div className="grid2">
          <FreeCard to="/today" icon={<Icon name="today" />} title="오늘의 운세" desc="총운·재물·애정·직장·건강" />
          <FreeCard to="/zodiac" icon={<Icon name="zodiac" />} title="띠별 운세" desc="12띠 오늘 흐름" />
          <FreeCard to="/today?tab=week" icon={<Icon name="week" />} title="이번 주 운세" desc="한 주 미리 보기" />
          <FreeCard onClick={() => setSoon('MBTI 운세')} icon={<Icon name="mbti" />} title="MBTI 운세" desc="성격 × 사주" />
        </div>

        <SectionHeader en="PREMIUM · 정통 풀이" title={<>도령과 선녀가<br /><em>깊이</em> 풀어드려요</>} />
        <div className="hscroll">
          <RareCard to="/consult?who=dosa&product=saju" img="dosaCard" title="정통 사주" desc="천궁도령 · 평생 흐름" owned={owned('saju')} />
          <RareCard to="/consult?who=sunnyeo&product=gunghap" img="sunnyeoCard" title="우리 궁합" desc="월하선녀 · 인연의 붉은 실" owned={owned('gunghap')} />
          <RareCard to="/consult?who=dosa&product=newyear" big={ny.pillar.hanja} title={`${ny.year} 신년운세`} desc="한 해 열두 달 흐름" owned={owned('newyear')} />
          <RareCard onClick={() => setSoon('한자 부적')} big="符" title="한자 부적" desc="천궁도령 · 곧 열려요" />
        </div>

        <SectionHeader en="ZODIAC" title="내 띠 운세 바로 찾기" />
        <ZodiacGrid />

        <NoticeCard
          on={notifyOn}
          onToggle={() => {
            setNotify(!notifyOn);
            toast(notifyOn ? '알림을 껐어요' : '매일 아침 7시에 알려드릴게요');
          }}
        />
      </main>
      <ComingSoonSheet open={!!soon} onClose={() => setSoon(null)} what={soon ?? ''} />
    </>
  );
}

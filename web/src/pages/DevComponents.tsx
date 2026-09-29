// /dev/components — 공통 컴포넌트 전부를 한 페이지에 나열(스토리북 대신).
import { useState } from 'react';
import { AppHeader, SectionHeader, SubHeader, TabBar } from '../components/layout';
import {
  AdSlot, BottomSheet, Button, CategoryRow, CharacterBubble, ChipGroup, FreeCard, GreetingCard, LuckyGrid, NoticeCard,
  PremiumLock, RareCard, RareListItem, ScoreStars, SegTabs, Skeleton, ZodiacGrid, useToast,
} from '../components/ui';
import { Icon, type IconName } from '../components/Icon';

export default function DevComponents() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [chip, setChip] = useState<string>('money');
  const [sheet, setSheet] = useState(false);
  const [on, setOn] = useState(false);
  const toast = useToast();
  return (
    <>
      <AppHeader lunar="8.18" />
      <SubHeader title="컴포넌트 모음" />
      <main className="screen">
        <SectionHeader en="COMPONENTS" title={<>공통 <em>컴포넌트</em></>} desc="디자인가이드 5장" />
        <GreetingCard name="홍길동" isSample score={87} stars={4} oneLine="어른의 조언에 귀를 여는 날이에요." />
        <div className="grid2 mt14">
          <FreeCard to="#" icon={<Icon name="today" />} title="오늘의 운세" desc="총운·재물·애정" />
          <FreeCard to="#" icon={<Icon name="zodiac" />} title="띠별 운세" desc="12띠 오늘 흐름" />
        </div>
        <div className="hscroll mt14">
          <RareCard to="#" img="dosaCard" title="정통 사주" desc="천궁도령 · 평생 흐름" />
          <RareCard to="#" img="sunnyeoCard" title="우리 궁합" desc="보유중 상태" owned />
          <RareCard to="#" big="丁未" title="2027 신년운세" desc="한 해 열두 달 흐름" />
        </div>
        <RareListItem img="dosaFace" title="정통사주 · 재물편" desc="돈이 들어오는 시기" price={<>9,900원<small>예시 가격</small></>} sel />
        <RareListItem th="丁" title="2027 신년운세" desc="열두 달 흐름" price={<>7,900원<small>예시 가격</small></>} />
        <CharacterBubble who="sunnyeo">월하선녀 말풍선이에요.</CharacterBubble>
        <CharacterBubble who="dosa">천궁도령 말풍선이오.</CharacterBubble>
        <CharacterBubble who="me">사용자 답</CharacterBubble>
        <ChipGroup value={chip} onChange={setChip} options={[{ value: 'money', label: '돈·재물' }, { value: 'work', label: '일·직장' }]} />
        <SegTabs value={seg} onChange={setSeg} tabs={[{ value: 'a', label: '오늘' }, { value: 'b', label: '이번 주' }, { value: 'c', label: <>이번 달 <span className="lock">✦</span></> }]} />
        <div className="panel"><ScoreStars score={87} stars={4} />
          <CategoryRow label="재물" color="var(--field-wealth)" summary="작은 지출은 줄이고" stars={3} to="#" />
          <CategoryRow label="애정" color="var(--field-love)" summary="먼저 건네는 안부" stars={4} />
        </div>
        <LuckyGrid color="흰색" colorHex="#fff" number={3} direction="서쪽" />
        <AdSlot />
        <PremiumLock><p>잠긴 본문 예시입니다. 잠긴 본문 예시입니다. 잠긴 본문 예시입니다.</p><p>둘째 문단</p></PremiumLock>
        <ZodiacGrid active="horse" />
        <NoticeCard on={on} onToggle={() => setOn(!on)} />
        <div className="mt14"><Skeleton h={24} /><div className="mt8"><Skeleton h={24} w="60%" /></div></div>
        <div className="grid2 mt14">
          {(['today', 'zodiac', 'week', 'mbti', 'wealth', 'love', 'work', 'health'] as IconName[]).map((n) => <div key={n} className="card center"><Icon name={n} /><span className="d">{n}</span></div>)}
        </div>
        <Button onClick={() => setSheet(true)}>바텀시트 열기</Button>
        <Button kind="gold" onClick={() => toast('토스트 메시지예요')}>✦ 결제 버튼(금색)</Button>
        <Button kind="line">보조 버튼</Button>
      </main>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="바텀시트"><p>내용</p><Button kind="line" onClick={() => setSheet(false)}>닫기</Button></BottomSheet>
      <TabBar />
    </>
  );
}

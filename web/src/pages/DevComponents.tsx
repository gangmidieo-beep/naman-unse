// /dev/components — 공통 컴포넌트 v2 전부를 한 페이지에(스토리북 대신).
import { useState } from 'react';
import { AppHeader, SectionHeader, SubHeader } from '../components/layout';
import {
  AdSlot, BottomSheet, Button, CategoryTabs, CharacterBubble, CharacterSectionHead, ChipGroup, EffectCard, FreeCard, HeroDuo, PremiumLock,
  ProductRow, RareCard, RollingBanner, SegTabs, Skeleton, StepList, TalismanPaper, TodayCard, useToast,
} from '../components/ui';
import { BRAND, FATE, LOVE, TALISMANS } from '../lib/catalog';

export default function DevComponents() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [chip, setChip] = useState('money');
  const [cat, setCat] = useState(BRAND.groups.fate[0]);
  const [sheet, setSheet] = useState(false);
  const toast = useToast();
  return (
    <>
      <AppHeader />
      <SubHeader title="컴포넌트 모음" sub="디자인가이드 v2 3장" />
      <main className="screen">
        <SectionHeader en="COMPONENTS" title={<>공통 <em>컴포넌트</em></>} desc="시안 v2 기준" />
        <HeroDuo />
        <TodayCard name="홍길동" isSample date="9월 30일 · 정미일" total={80} stars={4} line="서두르지 말고 한 박자 늦게 답하면 좋은 기회가 먼저 다가와요." />
        <SectionHeader en="BANNER" title="롤링 배너" />
        <RollingBanner items={BRAND.banners.slice(0, 3)} />
        <SectionHeader en="FREE" title="무료 카드" />
        <div className="g2">{BRAND.fun.slice(0, 2).map((x) => <FreeCard key={x.id} to="#" hanja={x.hanja} title={x.title} desc={x.copy} />)}<FreeCard to="#" hanja="夢" title="꿈 해몽" desc="어젯밤 꿈, 어떤 의미일까?" wide /></div>
        <CharacterSectionHead who="cheongung" title="나만의 운명" desc="캐릭터 섹션 머리" to="#" />
        <div className="hs">{[FATE[0], FATE[4], FATE[11]].map((p) => <RareCard key={p.id} p={p} />)}<RareCard p={LOVE[4]} owned /></div>
        <CategoryTabs tabs={BRAND.groups.fate} value={cat} onChange={setCat} />
        <ProductRow p={FATE[4]} />
        <ProductRow p={TALISMANS[0]} owned />
        <SectionHeader en="TALISMAN" title="부적 · 효험 · 단계" />
        <div className="pad" style={{ display: 'flex', gap: 14, alignItems: 'center' }}><TalismanPaper t={TALISMANS[0]} /><TalismanPaper t={TALISMANS[4]} size={1.6} /></div>
        <div className="mt14" />
        <EffectCard icon="財" title="재물운 상승" desc="막혔던 돈의 흐름이 풀리길 기원합니다." />
        <StepList label="운명서에 담기는 내용" hanjaNums steps={[{ title: '타고난 재물 그릇', desc: '돈을 모으는 방식' }, { title: '돈이 들어오는 시기', desc: '앞으로 10년' }]} />
        <div className="mt24" />
        <CharacterBubble who="cheongung">천궁도사 말풍선이오.</CharacterBubble>
        <CharacterBubble who="wolha">월하선녀 말풍선이에요.</CharacterBubble>
        <CharacterBubble who="me">사용자 답</CharacterBubble>
        <ChipGroup value={chip} onChange={setChip} options={[{ value: 'money', label: '돈·재물' }, { value: 'work', label: '일·직장' }]} />
        <SegTabs value={seg} onChange={setSeg} tabs={[{ value: 'a', label: '오늘' }, { value: 'b', label: <>이번 주 <span className="lk">✦</span></> }, { value: 'c', label: <>이번 달 <span className="lk">✦</span></> }]} />
        <PremiumLock><div className="freeresult"><p>잠긴 본문 예시입니다. 잠긴 본문 예시입니다.</p></div></PremiumLock>
        <AdSlot />
        <div className="pad mt14"><Skeleton h={24} /><div className="mt8"><Skeleton h={24} w="60%" /></div></div>
        <div className="pad mt14">
          <Button kind="gold" onClick={() => toast('토스트 메시지예요')}>금 버튼 (주 버튼·결제)</Button>
          <div className="mt8" />
          <Button kind="ink" onClick={() => setSheet(true)}>먹색 버튼 (보조) · 바텀시트 열기</Button>
          <div className="mt8" />
          <Button kind="line">선 버튼</Button>
        </div>
      </main>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="바텀시트"><p>내용</p><Button kind="line" onClick={() => setSheet(false)}>닫기</Button></BottomSheet>
    </>
  );
}

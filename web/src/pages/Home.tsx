// 홈 v3 (도사 앱 레이아웃) — 헤더 → 오늘의 운세 카드 → 롤링 배너 → 재미로 보는 운세 2열 → 인기 상품(그리드형 가로 스크롤) → 타로 진입 → 부적 진입 → 알림 받기 → 광고
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader, SectionHeader } from '../components/layout';
import { AdSlot, FreeCard, ProductCard, RollingBanner, TalismanPaper, TodayCard, toCardItem, useToast, type BannerItem } from '../components/ui';
import { usePremium, useApp, useMainProfile } from '../store/app';
import { useTodayFortune } from '../lib/fortune';
import { ALL, BRAND, TALISMANS } from '../lib/catalog';
import { optionalImg } from '../assets/images';
import { kstMonthDay } from '../lib/dates';
import { api, MOCK_MODE } from '../lib/api';

const LOCAL_BANNERS: BannerItem[] = BRAND.banners.map((b) => ({ ...b, img: optionalImg(`banner_${b.link.split('/').pop()}`)?.src }));
// 배너: 서버 연결 시 관리자에서 편집한 banners(slot=home), 아니면 brand.config 기본 10종
function useBanners() {
  const [items, setItems] = useState(LOCAL_BANNERS);
  useEffect(() => {
    if (MOCK_MODE) return;
    api<{ id: string; title: string; copy: string | null; link: string | null; character: string | null; imageUrl: string | null }[]>('/banners?slot=home')
      .then((r) => r.length && setItems(r.map((b) => ({ id: b.id, title: b.title, copy: b.copy ?? '', link: b.link ?? '/', character: b.character ?? 'cheongung', img: b.imageUrl ?? undefined }))))
      .catch(() => {});
  }, []);
  return items;
}
// 인기 상품: 배지(BEST·인기·HOT) 붙은 풀이·타로·사진 상품
const POPULAR = ALL.filter((p) => p.kind !== 'talisman' && ['BEST', '인기', 'HOT'].includes((p as any).badge)).slice(0, 8);

export default function Home() {
  const { profile, isSample } = useMainProfile();
  const premium = usePremium();
  const { purchases, notifyOn, setNotify } = useApp();
  const toast = useToast();
  const f = useTodayFortune(profile);
  const banners = useBanners();
  return (
    <>
      <AppHeader />
      <main className="screen">
        <TodayCard name={profile.name} isSample={isSample} date={`${kstMonthDay()} · ${f.dayPillar.text}일`} total={f.total} stars={f.stars} line={f.oneLine} />

        <SectionHeader en="SPECIAL" title={<>지금 많이 찾는 <em>풀이</em></>} />
        <RollingBanner items={banners} />

        <SectionHeader en="FOR FUN" title="재미로 보는 운세" desc="가볍게 즐기고, 새롭게 발견하는 나의 이야기" more={{ to: '/unse?cat=fun', label: '전체 보기' }} />
        <div className="g2">
          {BRAND.fun.map((x) => <FreeCard key={x.id} to={x.link} hanja={x.hanja} title={x.title} desc={x.copy} />)}
        </div>

        <SectionHeader en="BEST" title={<>인기 <em>풀이</em></>} more={{ to: '/unse', label: '전체 보기' }} />
        <div className="hs">{POPULAR.map((p) => <ProductCard key={p.id} c={toCardItem(p, purchases.some((o) => o.productId === p.id))} mode="scroll" />)}</div>

        <Link to="/tarot" className="tarot-entry">
          <div className="stars" aria-hidden />
          <div className="tx"><small>TAROT</small><b>오늘의 타로</b><span>별빛 아래 카드 한 장, 오늘의 이야기를 들어 봐요</span></div>
          <div className="cards" aria-hidden><i>月</i><i>星</i><i>日</i></div>
        </Link>

        <Link to="/talisman" className="bjentry">
          <div className="in">
            <TalismanPaper t={TALISMANS[8]} />
            <div><small>WISH TALISMAN</small><b>나만의 부적</b><span>간절한 소망을 마음에 담아, 나를 위한 특별한 부적을 만들어 보세요.</span></div>
          </div>
        </Link>

        {!notifyOn && (
          <section className="notify-card">
            <b>매일 아침 오늘의 운세를 받아 보세요</b>
            <span>원하는 시간에 한 줄 운세를 알림으로 보내 드려요</span>
            <button className="btn gold" onClick={() => { setNotify(true); toast('매일 아침 알림을 보내 드릴게요'); }}>알림 받기</button>
          </section>
        )}

        <AdSlot premium={premium} kind="홈 하단 배너" slot="home_banner" />
      </main>
    </>
  );
}

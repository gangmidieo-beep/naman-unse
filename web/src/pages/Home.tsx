// 홈 v4 (대표님 2차 수정) — 헤더 → 오늘의 운세 카드 → 프리미엄 안내 → 지금 많이 찾는 풀이(배너 10, 상품별 그림) → 재미로 보는 "운세"(그림 카드 8)
// → 인기 풀이(6, 가로 스크롤) → 오늘의 타로(남보라 + 금색 카드 3장) → 나만의 부적 → 알림 받기 → 광고
import { enablePush } from '../platform/native';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader, SectionHeader } from '../components/layout';
import { AdSlot, ProductCard, RollingBanner, TodayCard, toCardItem, useToast, type BannerItem } from '../components/ui';
import { PremiumButton } from '../components/PremiumPopup';
import { usePremium, useApp, useMainProfile } from '../store/app';
import { useTodayFortune } from '../lib/fortune';
import { BRAND, productById, type Product } from '../lib/catalog';
import { THUMBS } from '../assets/thumbs';
import { optionalImg, v4 } from '../assets/images';
import { kstMonthDay } from '../lib/dates';
import { api, MOCK_MODE } from '../lib/api';

const LOCAL_BANNERS: BannerItem[] = BRAND.banners.map((b) => ({ ...b, img: optionalImg(`banner_${b.link.split('/').pop()}`)?.src ?? v4(b.image) }));
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
// 인기 풀이 6 (대표님 지정 순서·배지) — 그림은 인물 없는 상품 그림
const POPULAR = BRAND.popular.map((x) => ({ p: productById(x.id) as Product, badge: x.badge })).filter((x) => x.p && x.p.visible !== false);

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
      <main className="screen home4">
        {/* 처음이면 "자세히 보기" → 사주 정보 1회 입력(푸시 동의 포함) → 오늘의 운세 */}
        <TodayCard name={profile.name} isSample={isSample} date={`${kstMonthDay()} · ${f.dayPillar.text}일`} total={f.total} stars={f.stars} line={f.oneLine}
          to={isSample ? '/profile/new?back=/today&first=1' : '/today'} />

        {!premium && <PremiumButton />}

        <SectionHeader en="SPECIAL" title={<>지금 많이 찾는 <em>풀이</em></>} />
        <RollingBanner items={banners} />

        <SectionHeader en="FOR FUN" title={<>재미로 보는 <em>운세</em></>} desc="가볍게 즐기고, 새롭게 발견하는 나의 이야기" more={{ to: '/fun', label: '전체 보기' }} />
        <div className="funcards">
          {BRAND.fun.map((x) => (
            <Link key={x.id} to={x.link} className="funcard">
              <div className="im">{THUMBS[`fun_${x.id}`] && <img src={THUMBS[`fun_${x.id}`]} alt="" loading="lazy" width={480} height={240} />}</div>
              <div className="tx"><b>{x.title}</b><span className="fb">무료</span><p>{x.copy}</p></div>
            </Link>
          ))}
        </div>

        <SectionHeader en="BEST" title={<>인기 <em>풀이</em></>} more={{ to: '/unse', label: '전체 보기' }} />
        <div className="hs pop6">
          {POPULAR.map(({ p, badge }) => <ProductCard key={p.id} c={{ ...toCardItem(p, purchases.some((o) => o.productId === p.id)), badge, img: v4(`pop_${p.id}`) }} mode="scroll" />)}
        </div>

        <Link to="/tarot" className="tarot-w" aria-label="오늘의 타로 — 오늘의 카드 뽑기">
          <img src={v4("home_tarot")} alt="" />
          <div className="tx">
            <small>TAROT <i aria-hidden>✦</i></small>
            <b>오늘의 타로</b>
            <span>카드 한 장이 전하는<br />오늘의 메시지를 만나보세요</span>
            <em>오늘의 카드 뽑기 ›</em>
          </div>
        </Link>

        <Link to="/talisman" className="bj-w" aria-label="나만의 부적 만들기">
          <img src={v4("home_talisman")} alt="" />
          <div className="tx">
            <small>WISH TALISMAN</small>
            <b>나만의 부적</b>
            <span>간절한 소원을 담아<br />나만의 부적을 만들어보세요.</span>
            <em>나만의 부적 만들기 ›</em>
          </div>
        </Link>

        {!notifyOn && (
          <section className="notify-card">
            <b>매일 아침 오늘의 운세를 받아 보세요</b>
            <span>원하는 시간에 한 줄 운세를 알림으로 보내 드려요</span>
            <button className="btn gold" onClick={async () => { const r = await enablePush(); if (r === 'denied') { toast('휴대폰 설정에서 알림을 켜 주세요'); return; } setNotify(true); toast('매일 아침 알림을 보내 드릴게요'); }}>알림 받기</button>
          </section>
        )}

        <AdSlot premium={premium} kind="홈 하단 배너" slot="home_banner" />
      </main>
    </>
  );
}

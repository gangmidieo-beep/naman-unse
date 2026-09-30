// 타로 탭 /tarot — 이 탭만 깊은 밤하늘(먹색→남보라) + 별가루 + 금 선. 오늘의 타로(무료) / 주제별 타로·스프레드(유료) / 내 타로 기록.
// 안내 캐릭터 = 월하선녀(결정필요 D13). 보라 의상 이미지가 오면 _incoming/wolha_tarot.png 로 넣으면 자동 교체.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { tarotDraw, tarotSpread, tarotSide, type TarotCard } from '@naman/content';
import { AdSlot, Button, ProductCard, toCardItem } from '../components/ui';
import { Img } from '../components/Img';
import { useRewarded } from '../components/Rewarded';
import { optionalImg } from '../assets/images';
import { BRAND, TAROTS, displayTitle, productById, type TarotProduct } from '../lib/catalog';
import { isUnlockedToday, useApp, useMainProfile, usePremium } from '../store/app';
import { koDate } from '../lib/dates';
import { track } from '../lib/track';
import { ShareBlock, useShare } from './Fun';

type Drawn = { card: TarotCard; reversed: boolean };

function Guide({ children }: { children: string }) {
  const img = optionalImg('wolha_tarot');
  return (
    <div className="tguide">
      {img ? <img src={img.src} alt="" /> : <Img k="wolhaFace" alt="" />}
      <p><small>월하선녀</small>{children}</p>
    </div>
  );
}

// 카드 앞면 — 이미지(_incoming/tarot_<id>)가 있으면 이미지, 없으면 금 한자 + 영문명
export function TarotFace({ d }: { d: Drawn }) {
  const img = optionalImg(`tarot_${d.card.id}`);
  return img ? <img src={img.src} alt="" className="tface" /> : <><span className={d.reversed ? 'rev' : ''}>{d.card.symbol}</span><small>{d.card.nameEn}</small></>;
}

function TodayTarot() {
  const { profile } = useMainProfile();
  const { unlocked, unlock } = useApp();
  const premium = usePremium();
  const { run, modal } = useRewarded();
  const draw = useMemo(() => tarotDraw(new Date(), profile.id), [profile.id]);
  const dayKey = `tarot:${profile.id}`;
  const saved = [0, 1, 2].find((i) => isUnlockedToday(unlocked, `${dayKey}:${i}`));
  const [pickI, setPickI] = useState<number | null>(saved ?? null);
  const [shuffled, setShuffled] = useState(saved != null);
  const read = premium || isUnlockedToday(unlocked, `${dayKey}:read`);
  const share = useShare();
  const choose = (i: number) => {
    if (pickI != null) return;
    setPickI(i);
    unlock(`${dayKey}:${i}`);
    track('content_view', { content: 'tarot' });
  };
  const c = pickI != null ? draw[pickI] : null;
  const side = c ? tarotSide(c) : null;
  return (
    <section className="tsec" aria-label="오늘의 타로">
      <h2 className="thead"><small>TODAY'S CARD</small>오늘의 타로<em>무료</em></h2>
      <Guide>{c ? `${c.card.nameKo} 카드가 나왔어요. 오늘 당신에게 건네는 이야기를 들어 봐요.` : '마음을 가라앉히고, 끌리는 카드 한 장을 골라 봐요.'}</Guide>
      {!shuffled ? (
        <div className="tdeck">
          <div className="stack" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ transform: `translate(${i * 2}px, ${-i * 2}px)` }} />)}</div>
          <Button kind="gold" onClick={() => setShuffled(true)}>카드 섞고 펼치기</Button>
        </div>
      ) : (
        <div className={`tfan${c ? ' chosen' : ''}`}>
          {draw.map((d, i) => {
            const picked = pickI === i;
            return (
              <button key={i} className={`tcard f${i}${picked ? ' pick' : ''}`} onClick={() => choose(i)} disabled={pickI != null && !picked}
                aria-label={picked ? `${d.card.nameKo}${d.reversed ? ' 역방향' : ''}` : `${i + 1}번째 카드 고르기`}>
                <div className="flipper">
                  <div className="back"><span>{['月', '星', '日'][i]}</span></div>
                  <div className="front">{picked && <TarotFace d={d} />}</div>
                </div>
                {picked && <i className="ray" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
      {c && side && <p className="tname">{c.card.nameKo}<small>{c.card.nameEn} · {c.reversed ? '역방향' : '정방향'}</small></p>}
      {c && side && !read && (
        <div className="pad mt14">
          <Button kind="gold" onClick={() => run(() => unlock(`${dayKey}:read`), 'tarot')}>✦ 카드의 이야기 듣기</Button>
          <div className="adnote">짧은 광고 후 풀이가 열려요 · 프리미엄 회원은 광고 없음</div>
          {modal}
        </div>
      )}
      {c && side && read && (
        <>
          <div className="tread">
            <small>{side.keywords.join(' · ')}</small>
            <b>{side.title}</b>
            {side.message.map((m) => <p key={m}>{m}</p>)}
            <dl>
              <dt>연애</dt><dd>{side.love}</dd>
              <dt>금전</dt><dd>{side.money}</dd>
              <dt>일</dt><dd>{side.work}</dd>
            </dl>
          </div>
          <ShareBlock s={share} title="오늘의 타로" text={`오늘의 카드는 ${c.card.nameKo} — ${side.title}`} path="/tarot" id="tarot">
            <p style={{ fontFamily: 'var(--serif)', fontWeight: 900, fontSize: 24, lineHeight: 1.4 }}>{c.card.nameKo} · {side.title}</p>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.75, marginTop: 16 }}>{side.message.join(' ')}</p>
          </ShareBlock>
        </>
      )}
    </section>
  );
}

function Records() {
  const purchases = useApp((s) => s.purchases);
  const mine = purchases.filter((p) => p.productId.startsWith('tarot_') && p.status === 'paid');
  return (
    <section className="tsec">
      <h2 className="thead"><small>MY TAROT</small>내 타로 기록</h2>
      {mine.length ? (
        <ul className="trec">
          {mine.map((p) => (
            <li key={p.orderId}><Link to={`/reading/${p.orderId}`}><b>{displayTitle(productById(p.productId)!)}</b><span>{koDate(new Date(p.createdAt))}</span></Link></li>
          ))}
        </ul>
      ) : <p className="tempty">아직 받은 타로 리딩이 없어요. 주제별 타로나 스프레드를 골라 보세요.</p>}
    </section>
  );
}

export default function TarotTab() {
  const premium = usePremium();
  const owned = useApp((s) => s.purchases);
  const byGroup = (g: string) => TAROTS.filter((t) => t.group === g && t.visible !== false).sort((a, b) => a.sort - b.sort);
  return (
    <main className="screen tarot-tab">
      <div className="stars" aria-hidden />
      <header className="ttop"><small>月下仙女 · TAROT</small><h1>타로</h1><p>별빛 아래, 카드가 전하는 이야기</p></header>
      <TodayTarot />
      {BRAND.groups.tarot.map((g) => (
        <section className="tsec" key={g}>
          <h2 className="thead"><small>{g === '스프레드' ? 'SPREAD' : 'TOPIC'}</small>{g}</h2>
          {byGroup(g).map((t) => <ProductCard key={t.id} c={toCardItem(t, owned.some((o) => o.productId === t.id))} mode="list" />)}
        </section>
      ))}
      <Records />
      <AdSlot premium={premium} kind="타로 하단" />
    </main>
  );
}

// 유료 타로 결과 — 주문 번호 시드로 뽑은 카드 + 자리별 풀이. 주제별 타로는 주제 문장(연애·재물·일), 스프레드는 카드 메시지.
const TOPIC: Record<string, 'love' | 'money' | 'work'> = { tarot_love: 'love', tarot_reunion: 'love', tarot_money: 'money', tarot_work: 'work' };
export function TarotReading({ p, orderId }: { p: TarotProduct; orderId: string }) {
  const cards = useMemo(() => tarotSpread(`${orderId}:${p.id}`, p.cards), [orderId, p]);
  const [open, setOpen] = useState(0);
  const topic = TOPIC[p.id];
  return (
    <div className="tarot-tab treading">
      <div className="stars" aria-hidden />
      <p className="tlead">카드를 한 장씩 눌러 뒤집어 보세요</p>
      <div className={`tgrid n${p.cards}`}>
        {cards.map((d, i) => (
          <button key={i} className={`tcard sm${i < open ? ' pick' : ''}`} onClick={() => setOpen((n) => Math.max(n, i + 1))} aria-label={`${p.positions[i]} 카드`}>
            <div className="flipper"><div className="back"><span>{i + 1}</span></div><div className="front">{i < open && <TarotFace d={d} />}</div></div>
            <em>{p.positions[i]}</em>
          </button>
        ))}
      </div>
      {open < cards.length && <div className="pad"><Button kind="gold" onClick={() => setOpen(cards.length)}>모두 뒤집기</Button></div>}
      {cards.slice(0, open).map((d, i) => {
        const s = tarotSide(d);
        return (
          <section className="tread" key={i}>
            <small>{i + 1}. {p.positions[i]} · {d.card.nameKo} {d.reversed ? '역방향' : '정방향'}</small>
            <b>{s.title}</b>
            <p>{topic ? s[topic] : s.message.join(' ')}</p>
            {topic && <p>{s.message[0]}</p>}
          </section>
        );
      })}
    </div>
  );
}

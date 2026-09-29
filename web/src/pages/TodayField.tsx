// S4 분야 상세 — 재물·직장=천궁도령, 애정·건강=월하선녀. 요약·첫 문단 무료, 나머지 문단·조언 3개는 프리미엄.
import { Link, Navigate, useParams } from 'react-router-dom';
import { FIELDS, FIELD_LABEL, type Field } from '@naman/content';
import { SubHeader, SectionHeader } from '../components/layout';
import { AdSlot, CharacterBubble, PremiumLock, RareCard, Stars } from '../components/ui';
import { Img } from '../components/Img';
import { useApp, useMainProfile } from '../store/app';
import { useTodayFortune } from '../lib/fortune';
import { FIELD_COLOR } from './Today';
import { newYearTarget } from '../lib/dates';

const DOSA: Field[] = ['wealth', 'work'];
const UPSELL: Record<Field, { to: string; title: string; desc: string; img?: 'dosaCard' | 'sunnyeoCard'; big?: string }> = {
  wealth: { to: '/consult?who=dosa&product=saju_wealth', title: '정통사주 · 재물편', desc: '평생 재물 흐름으로 보기', img: 'dosaCard' },
  love: { to: '/consult?who=sunnyeo&product=gunghap', title: '우리 궁합', desc: '두 사람 인연을 깊이 보기', img: 'sunnyeoCard' },
  work: { to: '/consult?who=dosa&product=saju_work', title: '정통사주 · 직장편', desc: '일이 풀리는 때를 평생 흐름으로', img: 'dosaCard' },
  health: { to: '/consult?who=dosa&product=newyear', title: '신년운세', desc: '한 해 몸과 마음 흐름 보기' },
};

export default function TodayField() {
  const { field } = useParams();
  const { profile } = useMainProfile();
  const premium = useApp((s) => s.premium);
  const f = useTodayFortune(profile);
  if (!FIELDS.includes(field as Field)) return <Navigate to="/today" replace />;
  const k = field as Field;
  const d = f.fields[k];
  const dosa = DOSA.includes(k);
  const paras = dosa && d.detailDosa ? d.detailDosa : d.detail;
  const ny = newYearTarget();
  const up = k === 'health' ? { ...UPSELL.health, title: `${ny.year} 신년운세`, big: ny.pillar.hanja } : UPSELL[k];
  const rest = (
    <>
      {paras.slice(1).map((p, i) => <p className="para" key={i}>{p}</p>)}
      <ul className="advice">
        <li><small>오늘 해 보면 좋은 일</small>{d.advice.do}</li>
        <li><small>오늘은 피해 가요</small>{d.advice.avoid}</li>
        <li><small>{dosa ? '도령의 한마디' : '선녀의 한마디'}</small>{d.advice.word}</li>
      </ul>
    </>
  );
  return (
    <>
      <SubHeader title={`${FIELD_LABEL[k]}운`} />
      <main className="screen">
        <nav className="fieldtabs" aria-label="분야">
          {FIELDS.map((x) => (
            <Link key={x} to={`/today/${x}`} replace className={x === k ? 'on' : ''} style={x === k ? { background: FIELD_COLOR[x] } : undefined}>{FIELD_LABEL[x]}</Link>
          ))}
        </nav>
        <div className="fieldhero">
          <Img k={dosa ? 'dosaBanner' : 'sunnyeoBanner'} eager alt={dosa ? '천궁도령' : '월하선녀'} />
          <div className="shade" />
          <div className="txt">
            <small>{dosa ? '천궁도령' : '월하선녀'} · 오늘의 {FIELD_LABEL[k]}운</small>
            <b>{d.summary}</b>
            <Stars n={d.stars} />
          </div>
        </div>
        <CharacterBubble who={dosa ? 'dosa' : 'sunnyeo'}>{paras[0]}</CharacterBubble>
        {premium ? rest : <PremiumLock label="✦ 이어지는 풀이와 오늘의 조언 3가지는 프리미엄 회원에게 열려요">{rest}</PremiumLock>}
        <AdSlot premium={premium} />
        <SectionHeader en="LIFETIME" title={<>이 분야를 <em>평생 흐름</em>으로 보기</>} />
        <div className="hscroll">
          <RareCard to={up.to} img={up.img} big={up.big} title={up.title} desc={up.desc} />
        </div>
      </main>
    </>
  );
}

/* 엔진 진입점 — 원국(네 기둥)·십신·오행 비율·대운·오늘 일진을 하나의 JSON 으로. 순수 계산, 외부 호출 없음.
   AI 는 이 JSON 을 입력으로 받아 풀이만 한다(원칙 3). 결과지 근거 검증(원칙 4)은 이 JSON 의 값과 대조한다. */
export const ENGINE_VERSION='1.0.0';
import {computePillars} from './pillars.mjs';
import {sipsinChart} from './sipsin.mjs';
import {elementRatio} from './elements.mjs';
import {computeDaeun} from './daeun.mjs';
import {todayRelation} from './today.mjs';
import {STEMS,ELEMENTS,STEM_ELEMENT,STEM_POLARITY} from './tables.mjs';
export {computePillars,sipsinChart,elementRatio,computeDaeun,todayRelation};
// birth: {year,month,day,hour|null,minute} 양력 KST. gender: 'male'|'female'|undefined.
export function computeChart(birth,gender,{now=new Date(),hiddenWeights=false}={}){
 const p=computePillars(birth);
 const dayStem=p.day.stem;
 const dayMaster={char:STEMS[dayStem],element:ELEMENTS[STEM_ELEMENT[dayStem]],polarity:STEM_POLARITY[dayStem]===1?'양':'음',name:STEMS[dayStem]+ELEMENTS[STEM_ELEMENT[dayStem]]};
 const daeun=computeDaeun(p,gender);
 const {currentAt,...daeunPlain}=daeun;
 return {
  engineVersion:ENGINE_VERSION,
  input:{solarDate:`${birth.year}-${birth.month}-${birth.day}`,timeKnown:birth.hour!=null,gender:gender||null},
  pillars:{year:p.year,month:p.month,day:p.day,hour:p.hour},
  sajuYear:p.sajuYear,sajuMonth:p.sajuMonth,jeolgi:p.jeolgi,
  dayMaster,
  sipsin:sipsinChart(p),
  elements:elementRatio(p,{hidden:hiddenWeights}),
  daeun:{...daeunPlain,current:daeun.available?currentAt(now):null},
  today:todayRelation(dayStem,now),
  limits:'한국 표준시 기준, 출생지 경도 보정 없음. 절기는 태양 황경 계산(±15분). 지지 십신은 본기 기준. 대운수는 절입까지의 일수/3.'
 };
}
// 텍스트 근거 목록 — 결과지 evidence 검증용(원칙 4). AI 가 쓴 evidence 값이 이 집합에 있어야 한다.
export function evidenceSet(chart){
 const set=new Set();
 set.add(`dayMaster:${chart.dayMaster.name}`);set.add(`dayMaster:${chart.dayMaster.char}`);
 for(const r of chart.sipsin.rows){if(r.stem.sipsin!=='일간')set.add(`sipsin:${r.pillar}:${r.stem.sipsin}`);set.add(`sipsin:${r.pillar}:${r.branch.sipsin}`);for(const h of r.branch.hidden)set.add(`sipsin:${r.pillar}:${h.sipsin}`)}
 for(const s of chart.sipsin.present)set.add(`sipsin:${s}`);
 for(const [e,v] of Object.entries(chart.elements.ratio))set.add(`element:${e}:${v}`);
 if(chart.daeun.available)for(const c of chart.daeun.cycles){set.add(`daeun:${c.text}`);set.add(`daeun:${c.fromAge}~${c.toAge}:${c.text}`)}
 return set;
}

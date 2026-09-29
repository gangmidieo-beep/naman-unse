/* 오행 비율 — 기본 가중: 천간 1.0, 지지 본기 1.0. 옵션 hidden:true 면 지장간 중기 0.5·여기 0.3 을 더한다.
   백분율은 정수 반올림 후 합이 100 이 되도록 가장 큰 항목에서 보정한다. */
import {ELEMENTS,STEM_ELEMENT,HIDDEN_STEMS} from './tables.mjs';
export function elementRatio(p,{hidden=false}={}){
 const w=[0,0,0,0,0],pillars=[p.year,p.month,p.day,p.hour].filter(Boolean);
 for(const x of pillars){
  w[STEM_ELEMENT[x.stem]]+=1;
  const hs=HIDDEN_STEMS[x.branch];
  w[STEM_ELEMENT[hs[2].stem]]+=1;
  if(hidden){if(hs[1])w[STEM_ELEMENT[hs[1].stem]]+=0.5;w[STEM_ELEMENT[hs[0].stem]]+=0.3}
 }
 const total=w.reduce((a,b)=>a+b,0)||1;
 const pct=w.map(v=>Math.round(v/total*100));
 let diff=100-pct.reduce((a,b)=>a+b,0);if(diff){const i=pct.indexOf(Math.max(...pct));pct[i]+=diff}
 const ratio=Object.fromEntries(ELEMENTS.map((e,i)=>[e,pct[i]]));
 const sorted=[...ELEMENTS].sort((a,b)=>ratio[b]-ratio[a]);
 const dayElement=ELEMENTS[STEM_ELEMENT[p.day.stem]];
 return {ratio,weights:Object.fromEntries(ELEMENTS.map((e,i)=>[e,+w[i].toFixed(1)])),strongest:sorted[0],weakest:sorted[4],missing:ELEMENTS.filter(e=>ratio[e]===0),dayElement,dayElementPct:ratio[dayElement],pillarsCounted:pillars.length};
}

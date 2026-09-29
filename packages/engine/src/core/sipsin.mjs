/* 십신 — 일간 기준으로 다른 글자의 관계. 지지는 지장간 본기(정기) 천간으로 판정한다(통용 방식). */
import {STEM_ELEMENT,STEM_POLARITY,SIPSIN,generates,controls,mainStemOfBranch,HIDDEN_STEMS,STEMS} from './tables.mjs';
export function sipsinIndex(dayStem,otherStem){
 const de=STEM_ELEMENT[dayStem],oe=STEM_ELEMENT[otherStem],same=STEM_POLARITY[dayStem]===STEM_POLARITY[otherStem];
 let base;
 if(de===oe)base=0;                 // 비견/겁재
 else if(generates(de,oe))base=2;   // 식신/상관 (내가 생함)
 else if(controls(de,oe))base=4;    // 편재/정재 (내가 극함)
 else if(controls(oe,de))base=6;    // 편관/정관 (나를 극함)
 else base=8;                       // 편인/정인 (나를 생함)
 return base+(same?0:1);
}
export const sipsinOfStem=(dayStem,otherStem)=>SIPSIN[sipsinIndex(dayStem,otherStem)];
export const sipsinOfBranch=(dayStem,branch)=>SIPSIN[sipsinIndex(dayStem,mainStemOfBranch(branch))];
// 지장간 전체(여기·중기·정기)의 십신 — 세부 풀이용
export const hiddenSipsin=(dayStem,branch)=>HIDDEN_STEMS[branch].map((h,i)=>h?{role:['여기','중기','정기'][i],stem:STEMS[h.stem],days:h.days,sipsin:SIPSIN[sipsinIndex(dayStem,h.stem)]}:null).filter(Boolean);
// 네 기둥 전체 십신 표. 일간 자리는 '일간'.
export function sipsinChart(p){
 const d=p.day.stem,cell=(pillar,label)=>pillar?{pillar:label,stem:{char:pillar.text[0],sipsin:label==='일주'?'일간':sipsinOfStem(d,pillar.stem)},branch:{char:pillar.text[1],sipsin:sipsinOfBranch(d,pillar.branch),hidden:hiddenSipsin(d,pillar.branch)}}:null;
 const rows=[cell(p.hour,'시주'),cell(p.day,'일주'),cell(p.month,'월주'),cell(p.year,'연주')].filter(Boolean);
 const counts=Object.fromEntries(SIPSIN.map(s=>[s,0]));
 for(const r of rows){if(r.stem.sipsin!=='일간')counts[r.stem.sipsin]++;counts[r.branch.sipsin]++}
 // 월지 십신은 격(格)의 출발점이라 따로 표기
 const monthBranch=sipsinOfBranch(d,p.month.branch);
 return {rows,counts,monthBranchSipsin:monthBranch,present:SIPSIN.filter(s=>counts[s]>0),absent:SIPSIN.filter(s=>counts[s]===0)};
}

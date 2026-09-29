/* 오늘의 일진과 일간의 관계 — 오늘의 운세(무료·AI 미사용) 문장 풀 선택에 쓴다. */
import {dayPillarIndex} from './pillars.mjs';
import {STEMS,BRANCHES,pillarText,ELEMENTS,STEM_ELEMENT} from './tables.mjs';
import {sipsinOfStem,sipsinOfBranch} from './sipsin.mjs';
const KST=9*3600000;
export function todayPillar(now=new Date()){const t=new Date(now.getTime()+KST);const y=t.getUTCFullYear(),m=t.getUTCMonth()+1,d=t.getUTCDate();const i=dayPillarIndex(y,m,d);return {date:`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`,stem:i%10,branch:i%12,text:pillarText(i%10,i%12)}}
export function todayRelation(dayStem,now=new Date()){
 const t=todayPillar(now);
 return {...t,stemSipsin:sipsinOfStem(dayStem,t.stem),branchSipsin:sipsinOfBranch(dayStem,t.branch),stemElement:ELEMENTS[STEM_ELEMENT[t.stem]],dayMaster:STEMS[dayStem]+ELEMENTS[STEM_ELEMENT[dayStem]],sameBranchAsDay:null};
}

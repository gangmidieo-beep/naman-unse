/* 대운 — 방향(양남음녀 순행, 음남양녀 역행), 대운수(생일↔절입 일수/3), 10년 단위 간지 8개.
   대운수 통용 환산: 3일=1년, 1일=4개월, 남는 시간은 1시간≈5일. 여기서는 정확한 일수(소수) 를 유지해 년·월로 환산하고,
   표시용 startAge 는 반올림(최소 1). 성별이 없으면 계산하지 않고 이유를 남긴다(원칙 3: 추측 금지). */
import {STEM_POLARITY,pillarText,pillarHanja} from './tables.mjs';
const KST=9*3600000;
export function daeunDirection(yearStem,gender){
 if(gender!=='male'&&gender!=='female')return null;
 const yang=STEM_POLARITY[yearStem]===1;
 return (yang&&gender==='male')||(!yang&&gender==='female')?'forward':'backward';
}
export function computeDaeun(p,gender,{count=8}={}){
 const direction=daeunDirection(p.year.stem,gender);
 if(!direction)return {available:false,reason:'gender_missing',note:'성별이 없어 대운 방향을 정할 수 없습니다.'};
 const birth=new Date(p.birthInstant),prev=new Date(p.jeolgi.prev.at),next=new Date(p.jeolgi.next.at);
 const days=(direction==='forward'?next-birth:birth-prev)/86400000;
 const years=days/3;
 const startAge=Math.max(1,Math.round(years));
 const startYears=Math.floor(years),startMonths=Math.round((years-startYears)*12);
 const step=direction==='forward'?1:-1;
 const cycles=[];
 for(let i=1;i<=count;i++){
  const stem=(((p.month.stem+step*i)%10)+10)%10,branch=(((p.month.branch+step*i)%12)+12)%12;
  const from=startAge+(i-1)*10;
  cycles.push({order:i,text:pillarText(stem,branch),hanja:pillarHanja(stem,branch),stem,branch,fromAge:from,toAge:from+9});
 }
 const birthYear=new Date(birth.getTime()+KST).getUTCFullYear();
 return {available:true,direction,startAge,startExact:{years:startYears,months:startMonths,days:+days.toFixed(2)},anchorJeolgi:direction==='forward'?p.jeolgi.next.name:p.jeolgi.prev.name,cycles,
  currentAt(now=new Date()){const age=new Date(now.getTime()+KST).getUTCFullYear()-birthYear+1;return cycles.find(c=>age>=c.fromAge&&age<=c.toAge)||null},birthYear};
}

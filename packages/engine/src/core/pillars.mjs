/* 네 기둥 계산 — 연·월주는 절기 입절 시각(분 단위)으로, 일주는 60갑자 일수로, 시주는 오서둔으로.
   manseryeok 패키지는 연·월 경계를 날짜 단위 고정표로 처리해 입춘·절입 당일 출생이 틀리고(2025-02-03 23:30 → 을사 무인이어야 하나 갑진 정축),
   절기 데이터도 2026년 값을 모든 해에 복사해 두어 최대 ±13시간 어긋난다(2026-09-27 확인). 그래서 연·월주는 여기서 직접 계산한다.
   시각은 한국 표준시 벽시계 기준, 출생지 경도 보정 없음(기존 정책 유지). 자시는 23:00~00:59 이며 23시대는 같은 날 일간의 자시로 본다(패키지 관행 유지). */
import {surroundingJeolgi} from './solar-terms.mjs';
import {MONTH_STEM_BASE,HOUR_STEM_BASE,pillarText,pillarHanja} from './tables.mjs';
const KST=9*3600000;
// 2000-01-01 은 무오(index 54, 갑자=0) 일. 날짜 차이로 60갑자를 돈다.
const DAY_ANCHOR_UTC=Date.UTC(2000,0,1),DAY_ANCHOR_INDEX=54;
export function dayPillarIndex(y,m,d){const days=Math.round((Date.UTC(y,m-1,d)-DAY_ANCHOR_UTC)/86400000);return (((DAY_ANCHOR_INDEX+days)%60)+60)%60}
const split=i=>({stem:i%10,branch:i%12});
// 연주: 입춘 기준. 그 해 입춘 전이면 전년.
export function yearPillar(sajuYear){const i=(((sajuYear-1984)%60)+60)%60;return split(i)}// 1984 갑자년
// birth: KST 벽시계 {y,m,d,h,min}. h 가 null 이면 정오로 절기 판정(시간 모름).
export function computePillars({year,month,day,hour=null,minute=0}){
 const h=hour==null?12:hour,mi=hour==null?0:minute;
 const instant=new Date(Date.UTC(year,month-1,day,h,mi)-KST);
 const {prev,next}=surroundingJeolgi(instant);
 // 사주 연도: 직전 절(prev)이 속한 해. 소한(sajuMonth 12)은 양력 이듬해 1월에 있으므로 그 경우만 전년으로 본다.
 const prevKST=new Date(prev.date.getTime()+KST);
 const sajuYear=prev.sajuMonth===12?prevKST.getUTCFullYear()-1:prevKST.getUTCFullYear();
 const yp=yearPillar(sajuYear);
 // 월주: 인월(1)부터 sajuMonth 순. 지지 = (sajuMonth+1)%12 → 인=2. 천간 = 오호둔 + (sajuMonth-1)
 const mBranch=(prev.sajuMonth+1)%12,mStem=(MONTH_STEM_BASE[yp.stem]+(prev.sajuMonth-1))%10;
 const di=dayPillarIndex(year,month,day),dp=split(di);
 let hp=null;
 if(hour!=null){const hBranch=Math.floor(((hour+1)%24)/2);const hStem=(HOUR_STEM_BASE[dp.stem]+hBranch)%10;hp={stem:hStem,branch:hBranch}}
 const fmt=p=>p?{text:pillarText(p.stem,p.branch),hanja:pillarHanja(p.stem,p.branch),stem:p.stem,branch:p.branch}:null;
 return {year:fmt(yp),month:fmt({stem:mStem,branch:mBranch}),day:fmt(dp),hour:fmt(hp),sajuYear,sajuMonth:prev.sajuMonth,
  jeolgi:{prev:{name:prev.name,at:prev.date.toISOString()},next:{name:next.name,at:next.date.toISOString()}},birthInstant:instant.toISOString(),timeKnown:hour!=null};
}

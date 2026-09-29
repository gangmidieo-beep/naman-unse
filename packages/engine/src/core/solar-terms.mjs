/* 절기(12절, 節) 입절 시각 계산 — 대운수 산출용.
   manseryeok 패키지는 2020~2030년 절기 데이터만 갖고 있어, 1900~2050 전 구간은 태양 황경을 직접 계산한다.
   알고리즘: Meeus, Astronomical Algorithms ch.25 저정밀 태양 황경(오차 ≈0.01° ≈ 15분). 대운수는 일 단위/3 이라 충분하다.
   테스트는 2020~2030 구간을 패키지 데이터와 대조한다(허용 오차 30분). 결과 시각은 KST(UTC+9). */
const rad=d=>d*Math.PI/180;
const norm=d=>((d%360)+360)%360;
// 절(節) 12개: 태양 황경 → 이름, 사주 월(寅=1 … 丑=12)
export const JEOLGI=[
 {name:'입춘',longitude:315,sajuMonth:1},{name:'경칩',longitude:345,sajuMonth:2},{name:'청명',longitude:15,sajuMonth:3},
 {name:'입하',longitude:45,sajuMonth:4},{name:'망종',longitude:75,sajuMonth:5},{name:'소서',longitude:105,sajuMonth:6},
 {name:'입추',longitude:135,sajuMonth:7},{name:'백로',longitude:165,sajuMonth:8},{name:'한로',longitude:195,sajuMonth:9},
 {name:'입동',longitude:225,sajuMonth:10},{name:'대설',longitude:255,sajuMonth:11},{name:'소한',longitude:285,sajuMonth:12}
];
export function julianDay(date){return date.getTime()/86400000+2440587.5}
export function fromJulianDay(jd){return new Date((jd-2440587.5)*86400000)}
// 겉보기 태양 황경(도), jd 는 UT 기준 율리우스일
export function sunLongitude(jd){
 const T=(jd-2451545.0)/36525;
 const L0=280.46646+36000.76983*T+0.0003032*T*T;
 const M=357.52911+35999.05029*T-0.0001537*T*T;
 const C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(rad(M))+(0.019993-0.000101*T)*Math.sin(rad(2*M))+0.000289*Math.sin(rad(3*M));
 const omega=125.04-1934.136*T;
 return norm(L0+C-0.00569-0.00478*Math.sin(rad(omega)));
}
// 특정 연도(양력)에 태양 황경이 target 이 되는 시각 — 그 해 안에서 가장 가까운 해를 찾는다
export function solarTermTime(year,longitude){
 // 초기 추정: 춘분(황경 0°) ≈ 3/21. 황경은 하루 ≈0.9856° 이동
 const approxDay=80+((longitude-0+360)%360)/0.985647;
 let jd=julianDay(new Date(Date.UTC(year,0,1)))+approxDay;
 // 입춘(315°)·경칩(345°)·소한(285°)은 연초에 오므로 한 해 뒤로 잡힌 경우 되돌린다
 if(longitude>=285)jd-=365.2422;
 for(let i=0;i<8;i++){let diff=longitude-sunLongitude(jd);diff=((diff+180)%360+360)%360-180;jd+=diff/0.985647;if(Math.abs(diff)<1e-6)break}
 return fromJulianDay(jd);
}
const KST=9*3600000;
export function toKST(date){const t=new Date(date.getTime()+KST);return {year:t.getUTCFullYear(),month:t.getUTCMonth()+1,day:t.getUTCDate(),hour:t.getUTCHours(),minute:t.getUTCMinutes(),date}}
// 해당 연도의 12절 입절 시각 (KST), 시간순
export function jeolgiOfYear(year){return JEOLGI.map(j=>({...j,...toKST(solarTermTime(year,j.longitude))})).sort((a,b)=>a.date-b.date)}
// 생일(UTC ms) 기준 직전·직후 절 — 대운수 계산에 쓴다. 연말·연초 경계를 위해 앞뒤 해까지 본다
export function surroundingJeolgi(birth){
 const t=birth.getTime(),y=new Date(t+KST).getUTCFullYear();
 const all=[...jeolgiOfYear(y-1),...jeolgiOfYear(y),...jeolgiOfYear(y+1)].sort((a,b)=>a.date-b.date);
 let prev=null,next=null;for(const j of all){if(j.date.getTime()<=t)prev=j;else{next=j;break}}
 return {prev,next};
}

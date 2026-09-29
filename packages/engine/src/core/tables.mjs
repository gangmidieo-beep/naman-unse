/* 사주 기초 표 — 천간·지지·오행·음양·지장간·월건(오호둔)·시두(오서둔). 전부 상수, 계산 없음. */
export const STEMS=['갑','을','병','정','무','기','경','신','임','계'];
export const STEMS_HANJA=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
export const BRANCHES=['자','축','인','묘','진','사','오','미','신','유','술','해'];
export const BRANCHES_HANJA=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
export const ELEMENTS=['목','화','토','금','수'];
export const ELEMENTS_HANJA=['木','火','土','金','水'];
// 천간 오행 index (목0 화1 토2 금3 수4), 음양(+1 양 / -1 음)
export const STEM_ELEMENT=[0,0,1,1,2,2,3,3,4,4];
export const STEM_POLARITY=[1,-1,1,-1,1,-1,1,-1,1,-1];
// 지지 오행(본기 기준)·음양(지지 자체: 자인진오신술 양)
export const BRANCH_ELEMENT=[4,2,0,0,2,1,1,2,3,3,2,4];
export const BRANCH_POLARITY=[1,-1,1,-1,1,-1,1,-1,1,-1,1,-1];
// 지장간 [여기, 중기, 정기(본기)] — 천간 index, 없으면 null. 일수는 월률분야 통용값.
export const HIDDEN_STEMS=[
 [{stem:8,days:10},null,{stem:9,days:20}],            // 자: 임 / 계
 [{stem:9,days:9},{stem:7,days:3},{stem:5,days:18}],  // 축: 계 신 기
 [{stem:4,days:7},{stem:2,days:7},{stem:0,days:16}],  // 인: 무 병 갑
 [{stem:0,days:10},null,{stem:1,days:20}],            // 묘: 갑 / 을
 [{stem:1,days:9},{stem:9,days:3},{stem:4,days:18}],  // 진: 을 계 무
 [{stem:4,days:7},{stem:6,days:7},{stem:2,days:16}],  // 사: 무 경 병
 [{stem:2,days:10},{stem:5,days:9},{stem:3,days:11}], // 오: 병 기 정
 [{stem:3,days:9},{stem:1,days:3},{stem:5,days:18}],  // 미: 정 을 기
 [{stem:4,days:7},{stem:8,days:7},{stem:6,days:16}],  // 신: 무 임 경
 [{stem:6,days:10},null,{stem:7,days:20}],            // 유: 경 / 신
 [{stem:7,days:9},{stem:3,days:3},{stem:4,days:18}],  // 술: 신 정 무
 [{stem:4,days:7},{stem:0,days:7},{stem:8,days:16}]   // 해: 무 갑 임
];
export const mainStemOfBranch=b=>HIDDEN_STEMS[b][2].stem;
// 오행 상생: 목→화→토→금→수→목. generates(a,b): a 가 b 를 생하는가
export const generates=(a,b)=>(a+1)%5===b;
// 오행 상극: 목→토, 토→수, 수→화, 화→금, 금→목. controls(a,b): a 가 b 를 극하는가
export const controls=(a,b)=>(a+2)%5===b;
// 월건(오호둔): 연간에 따른 인월 천간 — 갑기→병, 을경→무, 병신→경, 정임→임, 무계→갑
export const MONTH_STEM_BASE=[2,4,6,8,0,2,4,6,8,0];
// 시두(오서둔): 일간에 따른 자시 천간 — 갑기→갑, 을경→병, 병신→무, 정임→경, 무계→임
export const HOUR_STEM_BASE=[0,2,4,6,8,0,2,4,6,8];
export const SIPSIN=['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'];
export const pillarText=(s,b)=>STEMS[s]+BRANCHES[b];
export const pillarHanja=(s,b)=>STEMS_HANJA[s]+BRANCHES_HANJA[b];
export const parsePillarText=t=>{const s=STEMS.indexOf(String(t||'')[0]),b=BRANCHES.indexOf(String(t||'')[1]);return s<0||b<0?null:{stem:s,branch:b}};

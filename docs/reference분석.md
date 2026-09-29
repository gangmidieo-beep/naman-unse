# reference 분석 (2026-09-29)

reference/ 는 읽기 전용. 아래는 분석 결과만 적는다.

| 폴더 | 정체 | 규모 |
|---|---|---|
| `reference/jajeong-live` | Next(vinext)+Cloudflare/Railway 사이트 + `service/`(Node, node:sqlite) | 12MB |
| `reference/bimil-saju` | express 프런트 + `service/`(Node 24, node:sqlite) — **최신 엔진·파이프라인 보유** | 1.5GB (대부분 `_to_delete`, `public` 이미지) |

## 1. 만세력 엔진 — 선택: `bimil-saju/service/engine/*.mjs` (v1.0.0)

- jajeong 은 npm `@fullstackfamily/manseryeok`(MIT) 의 `calculateSaju` 를 그대로 호출. 이 패키지는 **입춘·절입 당일 연·월주 오류**, 절기 표가 2026년 값 복사라는 문제가 bimil 쪽 주석으로 확인됨.
- bimil 엔진은 그 문제를 고친 **자체 구현**(태양 황경 Meeus ch.25 로 절입 시각 계산) + `test/engine.test.mjs`(8개 테스트, 경계 포함) → 가장 최신·테스트가 붙은 것. 이것을 이식한다.

| 파일 | 줄 | 역할 |
|---|---|---|
| tables.mjs | 41 | 천간·지지·오행·음양·지장간·오호둔·오서둔·십신 이름 |
| solar-terms.mjs | 45 | 12절 입절 시각(KST, ±15분) |
| pillars.mjs | 31 | 4주 계산(연·월=절입 분 단위, 일=60갑자 일수, 시=오서둔) |
| sipsin.mjs | 26 | 십신(지지는 본기 기준), 지장간 십신 |
| elements.mjs | 19 | 오행 비율(천간1+지지본기1, 옵션 지장간) |
| daeun.mjs | 29 | 대운(양남음녀 순행, 대운수=일수/3) |
| today.mjs | 10 | 오늘 일진 + 일간 대비 십신 |
| index.mjs | 40 | computeChart(birth, gender) → JSON |

### 입력
| 항목 | 형식 | 비고 |
|---|---|---|
| 생년월일시 | `{year,month,day,hour|null,minute}` **양력 KST 벽시계** | 음력은 호출 전에 manseryeok `lunarToSolar(y,m,d,leap)` 로 변환(core.mjs) |
| 양/음력·윤달 | 엔진 밖(core.mjs) | 음력 범위 1900~2050 |
| 성별 | `'male'|'female'|undefined` | 없으면 대운 미계산 |
| 시간 모름 | `hour=null` | 절기 판정은 정오 기준, 시주 null |

### 출력 (computeChart)
| 키 | 내용 |
|---|---|
| pillars.year/month/day/hour | `{text:'경오',hanja:'庚午',stem,branch}` (hour 는 null 가능) |
| sajuYear, sajuMonth, jeolgi | 사주 연도, 인월=1…축월=12, 직전·직후 절 |
| dayMaster | `{char,element,polarity,name}` |
| sipsin | rows(시·일·월·연), counts, monthBranchSipsin, present, absent |
| elements | ratio(%), weights, strongest, weakest, missing, dayElement |
| daeun | direction, startAge, cycles[8], current |
| today | 오늘 일진, stemSipsin, branchSipsin |
| **없는 것** | 12운성, 합·충·형·파·해, 신살, 용신 → 우리 쪽에서 표준 표로 **새로 추가** |

### 자정(23시) 처리
- 자시 = 23:00~00:59. **23시대는 같은 날 일간의 자시**(일주는 넘기지 않음, 시간은 자시) — 패키지 관행 유지. → NOTICE 에 기록.
- 서머타임·경도 보정 **없음**(한국 표준시 벽시계 그대로). → 원본 정책 유지, 결정필요 D9 로 기록.

### 외부 의존
| 대상 | 내용 | 조치 |
|---|---|---|
| DB·네트워크·환경변수 | 엔진 자체엔 없음 | — |
| `@fullstackfamily/manseryeok` 1.0.8 (MIT) | 음력→양력 변환, 테스트 대조용 | 음력 표를 스크립트로 추출해 `packages/engine/data/lunar.json`(1900~2050) 로 고정. 런타임 의존 0. 패키지는 테스트용 devDependency 로만 |
| 절기 데이터 파일 | 없음(계산식) | — |

## 2. 틀로 재사용할 것 (구조만 참고, 코드·문장은 새로)

| 영역 | 위치(bimil-saju/service) | 쓸 곳 |
|---|---|---|
| 관리자 대시보드(방문자·결제요청·성공·매출, KST 일 단위, 테스트 제외) | dashboard.mjs, admin.html | 08 관리자 |
| 이벤트 추적·유입 경로 분류 | analytics.mjs, attribution.mjs, channels.mjs | 05 이벤트 훅 / 08 서버 |
| 결제 콜백 | providers/payment.mjs(인터페이스), providers/payapp.mjs, test/payapp-callback.test.mjs(위조·중복·금액 검증) | 09 PG 인터페이스 패턴만 |
| 풀이 파이프라인 | reading-pipeline.mjs(엔진→장별 JSON→스키마·근거·유사도·문체 검증→재시도), prompts.mjs, quality.mjs, similarity.mjs, evidenceSet() | 11 AI 풀이 |
| 오늘의 운세(AI 없음) | daily.mjs (십신×톤 문장 풀, 결정적 선택) | 04 — 구조 참고, 문장은 전부 새로 |
| 공유·결과 이미지 | share.mjs | 04/05 공유 |
| 테스트 방식 | node:test + 픽스처(fake-model) | vitest 로 동일 패턴 |

## 3. 가져오면 안 되는 것

| 종류 | 위치 | 값(앞 6글자) |
|---|---|---|
| 메타 픽셀 ID | jajeong-live/lib/meta-pixel.ts:6, CHANGES-2026-09-11-meta-pixel.md | 150989*** , 105702*** |
| 카카오 픽셀 ID | jajeong-live/lib/kakao-pixel.ts:5, tests/kakao-pixel.test.mjs | 281781*** |
| PayApp 판매자 아이디 | bimil-saju/docs/deploy-checklist.md:62, docs/handoff-checklist.md:13 | lsj23 (및 문서의 nyh092***, kami66***, kami92***) |
| PayApp 연동키 변수 | jajeong-live/ENVIRONMENT-KEYS.md (PAYAPP_USERID/LINKKEY/LINKVAL — 값은 없음) | — |
| Railway 서브도메인 | bimil-saju/docs/deploy-checklist.md:16~40 | api-pr***, web-pr***, 9jdu4a***, 5kqq44***, uz1ts0*** (.up.railway.app) |
| 도메인 | bimil-saju/docs/*, service/test/admin-session.test.mjs | bimils***.com (www·api) |
| Railway 설정 | jajeong-live/railway.json, service/railway.json, bimil-saju/service/railway.json | 파일 통째로 금지 |
| 브랜드 설정 | jajeong-live/service/brands.mjs, lib/offers.ts, bimil-saju/service/business.json | 상품명·가격·사업자 정보 |
| 풀이·오늘 문장 | daily.mjs, prompts.mjs, report-text.mjs, mock-report.mjs | 문장 재사용 금지(검사 스크립트) |
| API 키 | 코드에 실제 값 없음 확인(테스트 더미만). 운영 키는 각 호스팅 환경변수에만 존재 | — |

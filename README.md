# 나만의 운세 — 설치·배포 안내서

> 사주·운세 **Android 앱 + 웹** 서비스입니다. 이 안내서는 처음 받으신 분이 **화면 순서대로 따라 하면** 서비스를 띄우고 운영할 수 있게 썼습니다.
> 계정·키를 대표님 명의로 옮기는 체크리스트는 [docs/HANDOVER.md](docs/HANDOVER.md) 에 있습니다.

## 0. 한눈에 보기

| 구성 | 위치 | 하는 일 |
|---|---|---|
| 만세력 엔진 | `packages/engine` | 생년월일시 → 사주 원국·오행·십신·대운·토정비결 괘 계산 |
| 문구 DB | `packages/content` | 오늘의 운세·띠별·별자리·타로 78장·꿈해몽 300+·MBTI 등 (AI 없이 동작) |
| 서버 | `server` | 회원·주문·결제(PayApp·Google Play)·유료 풀이 생성·관리자 API |
| 웹 | `web` | 화면 전체 + 관리자(`/admin`). 앱은 이 화면을 Capacitor 로 감쌉니다 |
| 설정 | `brand.config.json`, `.env` | 가격·문구·캐릭터·광고 위치 / 키·주소 |

## 1. 준비물

| 준비물 | 어디서 | 비고 |
|---|---|---|
| Node.js 22 이상 | https://nodejs.org | LTS 버전 설치 |
| Git | https://git-scm.com/download/win | |
| Railway 계정(서버·DB 호스팅) | https://railway.com | 결제 카드 등록 필요, 월 약 $5~20 |
| 도메인 | 가비아 등 | 웹 주소·결제 돌아오는 주소에 사용 |
| PayApp 판매자 계정(웹 결제) | https://seller.payapp.kr | 연동정보: 아이디·연동KEY·연동VALUE |
| Google Play Console(앱) | https://play.google.com/console | 앱 등록·인앱 상품·구독 |
| (선택) Anthropic API 키(유료 풀이 AI) | https://console.anthropic.com | 비용은 `docs/비용추정.md` |

## 2. 내 컴퓨터에서 실행해 보기 (Windows)

```powershell
git clone <저장소 주소> naman-unse
cd naman-unse
copy .env.example .env      # 메모장으로 열어 값 채우기(처음엔 비워 둬도 됨)
npm ci
npm run dev                 # 웹 http://localhost:5391 · 서버 http://localhost:8791
```

- DB 를 따로 설치하지 않아도 됩니다(`DATABASE_URL` 이 비어 있으면 내장 DB 사용).
- `MOCK_MODE=true`(기본) 이면 결제·로그인·AI 가 **가짜로** 동작해 화면 흐름을 끝까지 볼 수 있습니다.
- 관리자 계정 만들기: `npm run admin:create -- 이메일 비밀번호10자이상` → http://localhost:5391/admin

## 3. 환경변수 (`.env` / Railway Variables)

| 이름 | 설명 | 어디서 |
|---|---|---|
| `MOCK_MODE` | `true`=가짜 결제·로그인, `false`=실서비스 (**웹·서버 둘 다** 같게) | — |
| `DATABASE_URL` | PostgreSQL 주소 | Railway Postgres 의 `${{Postgres.DATABASE_URL}}` |
| `PUBLIC_WEB_ORIGIN` | 웹 정식 주소 (예 `https://www.도메인`) | 도메인 연결 후 |
| `API_ORIGIN` | 서버 정식 주소 (예 `https://api.도메인`) | 도메인 연결 후 |
| `JWT_SECRET` | 로그인 토큰 서명용 긴 무작위 문자열 | Railway 에서 `${{secret(48)}}` |
| `ADMIN_EMAIL` · `ADMIN_INIT_PASSWORD` | 첫 배포 때 최고관리자 자동 생성 | 직접 정함(10자 이상) |
| `PG_PROVIDER` | `payapp` | — |
| `PAYAPP_USERID` · `PAYAPP_LINKKEY` · `PAYAPP_LINKVAL` | 웹 결제 | PayApp 판매자 관리자 → 설정 → 연동정보 |
| `GOOGLE_PLAY_PACKAGE_NAME` · `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` · `RTDN_PUBSUB_AUDIENCE` | 앱 결제 서버 검증 | Play Console → API 액세스, Google Cloud Pub/Sub |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET` · `KAKAO_REST_KEY/CLIENT_SECRET` · `NAVER_CLIENT_ID/SECRET` | 간편 로그인(등록한 것만 화면에 나옴) | 구글 클라우드·카카오 developers·네이버 developers |
| `KAKAO_JS_KEY` | 카카오톡 공유 | 카카오 developers → 앱 키 |
| `ADSENSE_CLIENT_ID` · `ADMOB_*` | 웹 광고 / 앱 광고 | 애드센스 · AdMob |
| `READING_AI` · `ANTHROPIC_API_KEY` · `ANTHROPIC_MODEL` | 유료 풀이 AI(`READING_AI=live` 일 때만 호출) | Anthropic 콘솔 |
| `AI_PRICE_IN_PER_M` · `AI_PRICE_OUT_PER_M` | 관리자 화면 원가 계산용 단가(USD/100만 토큰) | 모델 가격표 |

> ⚠ 키 값은 **채팅·메일·코드에 붙이지 말고** Railway Variables 에만 넣으세요.

## 4. Railway 배포

1. Railway 새 프로젝트 → **+ Add → Database → PostgreSQL**
2. **server** 서비스: 이 저장소 연결 → 변수 `RAILWAY_DOCKERFILE_PATH=server/Dockerfile`, `PORT=8791` + 3장의 환경변수 → Networking 에서 도메인(포트 8791)
3. **www**(웹) 서비스: 같은 저장소 → `RAILWAY_DOCKERFILE_PATH=web/Dockerfile`, `MOCK_MODE`, `API_ORIGIN`, `PUBLIC_WEB_ORIGIN` → 도메인(포트 8080)
4. 웹은 빌드할 때 주소가 화면 코드에 들어가므로, **주소를 바꾸면 www 를 다시 배포**하세요.
5. 터미널로 올릴 때: `railway up --service server` / `railway up --service www`
6. 확인: `https://서버주소/health` 가 `{"ok":true}` 이면 정상

## 5. 도메인 연결

- Railway → 서비스 → Settings → Networking → **Custom Domain** 에 `www.도메인`(웹), `api.도메인`(서버) 추가 → 안내되는 CNAME 을 도메인 회사 DNS 에 입력
- 연결 후 `PUBLIC_WEB_ORIGIN`·`API_ORIGIN` 을 정식 주소로 바꾸고 server·www 재배포
- **결제는 반드시 정식 도메인으로 바꾼 뒤** 켜세요(결제 후 돌아오는 주소가 이 값으로 만들어집니다).

## 6. 결제 켜기

**웹(PayApp)**: PayApp 연동정보 3개 + `PG_PROVIDER=payapp` + `MOCK_MODE=false`(웹·서버) → 본인 카드로 최소 금액 1건 결제 → 결과 화면 확인 → 관리자 **결제·구독**에서 환불 → PayApp 관리자에서도 취소 확인.
- 웹 프리미엄은 **이용권**(30일·1년)이며 자동 재결제되지 않습니다. 추가 구매 시 남은 기간 뒤에 이어 붙습니다.

**앱(Google Play)**: Play Console → 수익 창출 → 인앱 상품/구독에 **상품 id 를 `brand.config.json` 의 id 그대로** 등록(구독: `premium_monthly`, `premium_yearly`). 서비스 계정 JSON 을 base64 로 `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` 에, 실시간 알림(RTDN) 주제의 push 주소는 `https://api.도메인/billing/google/rtdn`.

## 7. 관리자 (`/admin`)

| 메뉴 | 할 수 있는 일 |
|---|---|
| 대시보드 | 방문·가입·결제·매출(운명서·인연서·부적·구독), CSV |
| 회원관리 | 회원 검색·구매 이력 |
| 콘텐츠 상품관리 | 가격·할인·배지·문구·이미지·노출 순서 (저장 즉시 앱·웹 반영) |
| 배너·팝업 | 홈 롤링 배너·이벤트·종료 팝업 |
| 결제·구독 | 결제 목록·환불(웹 결제는 PayApp 취소까지 자동) |
| 푸시 알림 · 광고 관리 · 통계 분석 | 예약 푸시, 광고 위치 ON/OFF, 콘텐츠·공유·전환 통계 |

관리자 비밀번호는 5번 틀리면 10분 잠깁니다. 계정 추가: `npm run admin:create -- 이메일 비밀번호 operator`

## 8. 가격·문구 바꾸기

- **가격·할인·배지·노출**: 관리자 → 콘텐츠 상품관리 (가장 쉬움)
- **처음 값(새로 설치할 때)**: `brand.config.json`
- **무료 운세 문구**: `packages/content/data/` 아래 JSON (바꾼 뒤 `npm run check:copy`)
- **이미지**: `web/public/img/_incoming/` 에 정해진 파일명으로 넣고 `npm run make:images` (파일명 규칙 `docs/이미지프롬프트_v2.md`)

## 9. 유료 풀이 AI 켜기

`docs/비용추정.md` 를 보고 결정 → `ANTHROPIC_API_KEY`·`ANTHROPIC_MODEL`·`READING_AI=live` → 테스트 결제 1건으로 품질 확인. 끄려면 `READING_AI` 를 지우면 예시 풀이로 돌아갑니다.

## 10. 앱 빌드 (Android)

| 단계 | 명령·위치 |
|---|---|
| 준비 | Android Studio 설치 https://developer.android.com/studio (JDK 21 포함). 폴더 경로에 **한글이 없어야** 함(예 `C:\projects\naman-unse`) |
| 웹 화면 넣기 | `.env` 에 `MOCK_MODE`·`API_ORIGIN`(정식 서버 주소) 확인 → `npm run app:sync` |
| 아이콘·스플래시 다시 만들기 | 원본 `docs/assets-source/app_icon.png`·`logo_brand.png` 교체 후 `npm run app:assets` |
| 시험용 APK | `npm run app:build:debug` → `app/android/app/build/outputs/apk/debug/app-debug.apk` |
| 스토어용 AAB | 업로드 키(대표님 명의, 분실 금지)를 만든 뒤 환경변수 `NAMAN_KEYSTORE`·`NAMAN_KEYSTORE_PASSWORD`·`NAMAN_KEY_ALIAS`·`NAMAN_KEY_PASSWORD` → `npm run build:release -w app` |
| 광고 | 환경변수 `ADMOB_APP_ID`(앱 빌드) · `VITE_ADMOB_BANNER_ID`(웹 빌드). 비우면 구글 공식 **테스트 광고** |
| 푸시 | Firebase 콘솔에서 Android 앱(패키지명 = appId) 추가 → `google-services.json` 을 `app/android/app/` 에 넣기(git 금지) · 서버에 `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` |
| 앱 id | `com.namanunse.app`(임시) — **스토어 첫 업로드 뒤에는 바꿀 수 없음**. 바꾸려면 `APP_ID` 환경변수 + android 폴더 namespace·applicationId 수정 |

- 앱 결제는 **Google Play 만** 사용(정책). 앱 안에서는 웹 결제(PayApp) 화면·문구가 나오지 않습니다.
- 앱 아이콘 원본: `docs/assets-source/app-icon/` (Play 스토어 512px 포함)

## 11. 점검 명령

```powershell
npm test                    # 단위·통합 테스트
npm run test:e2e            # 화면 시나리오(Playwright)
npm run check:copy          # 문구 검수
npm run check:secrets       # 키·인증서가 저장소에 없는지
```

## 12. 자주 묻는 문제

| 증상 | 확인할 것 |
|---|---|
| 서버 주소가 502 | Railway `PORT=8791` 변수와 도메인 포트(8791)가 같은지 |
| 관리자 로그인 "Failed to fetch" | 서버 `PUBLIC_WEB_ORIGIN` 이 웹 주소와 정확히 같은지(https 포함) |
| 결제 후 결과가 안 뜸 | 서버 로그에 `[payapp] 통보 검증 실패` → 연동KEY·VALUE 다시 복사(공백 주의) |
| 결제창이 카톡에서 안 열림 | 카카오톡 안에서는 카카오페이 창으로 열리도록 되어 있음 — 카드는 기본 브라우저에서 |
| 변수를 바꿨는데 그대로 | 웹 변수는 다시 배포해야 반영(빌드 때 들어감) |

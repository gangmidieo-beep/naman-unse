# 나만의 운세 — 정식 오픈 전환 (도메인 연결 + PayApp 실결제 + AI 풀이 켜기)
# 사용: 작업 폴더에서  powershell -ExecutionPolicy Bypass -File .\deploy\go-live.ps1
# 미리: railway login 후 이 폴더가 Railway 프로젝트에 연결(railway link)돼 있어야 함. 키는 이 창에만 입력(채팅·파일에 적지 않기)
$ErrorActionPreference = "Continue"
function Check($step) { if ($LASTEXITCODE -ne 0) { Write-Host "`n[$step] 단계에서 실패했어요. 위 글씨를 복사해서 개발자에게 보내주세요." -ForegroundColor Red; exit 1 } }
function Plain($s) { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }

Write-Host "`n=== 나만의 운세 정식 오픈 전환 ===" -ForegroundColor Cyan
$domain = (Read-Host "도메인 (예: namanunse.com — www 없이)").Trim().ToLower() -replace '^https?://', '' -replace '^www\.', '' -replace '/.*$', ''
if (-not $domain -or $domain -notmatch '\.') { Write-Host "도메인을 다시 확인해 주세요." -ForegroundColor Red; exit 1 }
$WEB = "https://www.$domain"
$API = "https://api.$domain"
Write-Host "웹: $WEB   서버: $API" -ForegroundColor Gray

Write-Host "`nPayApp 판매자 관리자(seller.payapp.kr) > 설정 > 연동정보 화면을 열어 두세요." -ForegroundColor Yellow
$uid = (Read-Host "PayApp 아이디").Trim()
$lkey = (Plain (Read-Host "연동 KEY (입력해도 화면에 안 보여요)" -AsSecureString)).Trim()
$lval = (Plain (Read-Host "연동 VALUE (입력해도 화면에 안 보여요)" -AsSecureString)).Trim()
if (-not $uid -or -not $lkey -or -not $lval) { Write-Host "PayApp 정보 세 가지를 모두 넣어 주세요." -ForegroundColor Red; exit 1 }

Write-Host "`n유료 풀이용 Anthropic API 키 (console.anthropic.com > API Keys). 비우면 유료 풀이는 '준비 중'으로 막히고 부적·구독만 판매돼요." -ForegroundColor Yellow
$akey = (Plain (Read-Host "Anthropic API 키 (없으면 엔터)" -AsSecureString)).Trim()
$model = "claude-sonnet-5-5"
if ($akey) { $m = (Read-Host "사용할 모델 (엔터 = $model)").Trim(); if ($m) { $model = $m } }

Write-Host "`n[1/4] 도메인 연결 — 아래에 나오는 CNAME·TXT 값을 도메인 구입처 DNS 설정에 그대로 넣어 주세요" -ForegroundColor Yellow
railway domain "www.$domain" --service www --port 8080; Check "웹 도메인"
railway domain "api.$domain" --service server --port 8791; Check "서버 도메인"

Write-Host "`n[2/4] 서버 설정 (실결제 모드)" -ForegroundColor Yellow
$sv = @('--set', 'MOCK_MODE=false', '--set', 'APP_ENV=production', '--set', 'PG_PROVIDER=payapp',
  '--set', "PAYAPP_USERID=$uid", '--set', "PAYAPP_LINKKEY=$lkey", '--set', "PAYAPP_LINKVAL=$lval",
  '--set', "PUBLIC_WEB_ORIGIN=$WEB", '--set', "API_ORIGIN=$API")
if ($akey) { $sv += @('--set', 'READING_AI=live', '--set', "ANTHROPIC_API_KEY=$akey", '--set', "ANTHROPIC_MODEL=$model") }
railway variables --service server @sv; Check "서버 설정"

Write-Host "`n[3/4] 웹 설정 (실결제 화면으로 다시 빌드)" -ForegroundColor Yellow
railway variables --service www --set 'MOCK_MODE=false' --set "API_ORIGIN=$API" --set "PUBLIC_WEB_ORIGIN=$WEB"; Check "웹 설정"

Write-Host "`n[4/4] 확인할 것" -ForegroundColor Yellow
Write-Host " - DNS 를 넣고 10분~몇 시간 뒤 $WEB 이 열리면 성공 (railway domain status www.$domain 로 확인)"
Write-Host " - 루트 주소($domain)는 도메인 구입처에서 $WEB 으로 '포워딩' 설정 (대부분 업체가 루트에는 CNAME 을 못 넣어요)"
Write-Host " - PayApp 판매자 관리자에 결제 통보 주소가 필요하면: $API/pay/payapp/feedback"
Write-Host " - 실제로 부적 1건 결제 → 관리자 화면에서 환불까지 한 번 해보기"
Write-Host "`n완료! 이 창 내용(키는 안 보여요)을 복사해서 개발자에게 보내주세요." -ForegroundColor Green

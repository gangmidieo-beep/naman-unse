# 나만의 운세 — Railway 서버 위치를 싱가포르로 옮기기(한국 사용자 응답 속도 개선)
# 사용: powershell -ExecutionPolicy Bypass -File .\deploy\move-to-singapore.ps1   (railway link 된 폴더에서)
# 서버·웹은 멈춤 없이 옮겨지고, 데이터베이스(Postgres)는 저장소를 복사하느라 몇 분 멈춰요 → 손님이 적은 시간에 실행
$ErrorActionPreference = "Continue"
function Check($step) { if ($LASTEXITCODE -ne 0) { Write-Host "`n[$step] 단계에서 실패했어요. 위 글씨를 복사해서 개발자에게 보내주세요." -ForegroundColor Red; exit 1 } }
foreach ($s in @('server', 'www', 'Postgres')) {
  Write-Host "`n[$s] 싱가포르로 이동" -ForegroundColor Yellow
  railway scale --service $s southeast-asia=1 eu-west=0 us-east=0 us-west=0; Check "$s 이동"
}
Write-Host "`n완료! 5~10분 뒤 사이트가 정상인지 확인하고, 이 창 내용을 개발자에게 보내주세요." -ForegroundColor Green

@echo off
chcp 65001 >nul
REM ============================================================
REM  자정사주(jajeong-live) · 비밀신당(bimil-saju) 코드를 reference 폴더로 "복사"
REM  원본은 건드리지 않습니다. .env / 키 / node_modules / .next / .git 은 빠집니다.
REM  경로가 다르면 아래 두 줄만 메모장으로 고치세요.
REM ============================================================
set JAJEONG=C:\Users\PC\Documents\GitHub\jajeong-live
set BIMIL=C:\Users\PC\Desktop\bimil-saju\bimil-saju\bimil-saju

cd /d "%~dp0"
if not exist "%JAJEONG%" echo [확인] 자정사주 폴더가 없습니다: %JAJEONG%
if not exist "%BIMIL%" echo [확인] 비밀신당 폴더가 없습니다: %BIMIL%

robocopy "%JAJEONG%" "reference\jajeong-live" /E /XF .env .env.* *.key *.pem *.jks *.keystore google-services.json service-account*.json /XD node_modules .next .git build dist .serena .openai .sites-runtime
robocopy "%BIMIL%" "reference\bimil-saju" /E /XF .env .env.* *.key *.pem *.jks *.keystore /XD node_modules .next .git build dist

echo.
echo 복사 완료. reference 폴더를 확인하세요. (reference 는 git 에 올라가지 않습니다)
pause

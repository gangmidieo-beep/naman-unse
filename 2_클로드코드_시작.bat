@echo off
chcp 65001 >nul
REM 나만의 운세 프로젝트 폴더에서 Opus 5.5 로 클로드 코드 시작
cd /d "%~dp0"
if not exist ".git" (
  git init
  git add -A
  git commit -m "chore: 초기 자료(계약서·요구사항·디자인가이드·시안·명령어)"
)
claude --model claude-opus-5-5

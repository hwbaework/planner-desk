@echo off
rem 회사 메일 → mail_inbox.json. 더블클릭 또는 작업 스케줄러로 실행.
chcp 65001 >nul
cd /d "%~dp0"
python mail_sync.py %*
if "%~1"=="" pause

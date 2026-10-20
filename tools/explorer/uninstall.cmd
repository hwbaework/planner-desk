@echo off
chcp 65001 >nul
rem Planner Desk: 탐색기 열기 등록 해제
reg delete "HKCU\Software\Classes\plannerdesk-open" /f >nul 2>&1
del /q "%LOCALAPPDATA%\PlannerDesk\open-path.js" >nul 2>&1
rmdir "%LOCALAPPDATA%\PlannerDesk" >nul 2>&1
echo 해제 완료
pause

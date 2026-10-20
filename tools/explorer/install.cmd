@echo off
chcp 65001 >nul
rem Planner Desk: 열기 버튼 -> 탐색기 (내 계정에만 등록, 관리자 권한 필요 없음)
set "DEST=%LOCALAPPDATA%\PlannerDesk"
if not exist "%DEST%" mkdir "%DEST%"
copy /y "%~dp0open-path.js" "%DEST%\open-path.js" >nul || goto fail
reg add "HKCU\Software\Classes\plannerdesk-open" /ve /d "URL:Planner Desk Open" /f >nul || goto fail
reg add "HKCU\Software\Classes\plannerdesk-open" /v "URL Protocol" /d "" /f >nul || goto fail
reg add "HKCU\Software\Classes\plannerdesk-open\shell\open\command" /ve /d "\"%SystemRoot%\System32\wscript.exe\" \"%DEST%\open-path.js\" \"%%1\"" /f >nul || goto fail
echo 설치 완료. 브라우저에서 처음 [열기]를 누를 때 뜨는 확인창에서 '항상 허용'을 체크하면 다음부터는 바로 열려요.
pause
exit /b 0
:fail
echo 설치 실패
pause
exit /b 1

# Planner Desk · 기획 데스크

IT 기획자 / PMO용 프로젝트 관리 화면. **HTML 파일 하나**로 동작하고, DB 없이 데이터를 HTML 안에 넣어 저장한다.

## 쓰는 법

1. `index.html`을 Chrome/Edge로 연다 (더블클릭).
2. 입력한 내용은 브라우저에 자동 저장된다.
3. **💾 저장 (Ctrl+S)** → 현재 데이터가 들어간 HTML 파일로 저장된다.
   - Chrome/Edge: 저장 위치를 한 번 정하면 그 뒤로는 같은 파일에 자동 저장된다.
   - 저장한 HTML을 다른 PC에서 열어도 데이터가 그대로 보인다.
4. **불러오기**: Planner Desk 백업 HTML/JSON, 또는 예전 `사업관리 대시보드` 백업 HTML(태스크 → WBS 일반업무, 메모 → 메모·회의록)을 가져온다.

## 화면

| 탭 | 하는 일 |
|---|---|
| 대시보드 | 노티 미수신 · 진행 중 전달 · 승인 대기 · 내 검수 대기, 단계별 진척, 확인 필요 목록 |
| 개발 전달·노티 | 기획을 개발에 넘긴 날, 접수·질의·진행·완료 노티 타임라인, 독촉 문구/메일 |
| 산출물 | 수행방법론 P1~P6 산출물 19종: 상태·버전·검토요청·승인·개정 이력 |
| 화면 목록 | 화면설계서 화면 인벤토리, 엑셀 붙여넣기, 화면별 개발 전달 상태 |
| WBS | 단계별 작업, 진척률, 간트 막대, 엑셀 붙여넣기 |
| 메일 수신 | 회신 메일 붙여넣기 / .eml 끌어다 놓기 → `[HO-001]` 코드 · 보낸 사람 · 제목으로 자동 매칭 |
| 메모·회의록 | 프로젝트별 메모, 자동 저장 |

## 노티 경고 규칙 (설정에서 변경)

- **접수 노티 없음**: 전달 후 영업일 2일 넘게 회신 없음 (프로젝트별로 바꿀 수 있음)
- **완료 노티 없음**: 완료 예정일이 지났는데 완료 노티 없음
- **진행 공유 없음**: 마지막 응답 뒤 영업일 5일 넘게 소식 없음
- **승인 회신 없음**: 산출물 검토요청 후 영업일 3일 넘게 승인 없음
- **내 검수 대기**: 완료 노티를 받았는데 2일 넘게 기획 검수를 안 함

## 개발

```bash
npx --yes http-server@14.1.1 -p 5178 -c-1
```

데이터 구조: `index.html` 안의 `emptyState()` 참고. 저장 파일은 `var EMBEDDED_DATA = {...}` 한 줄만 바뀐다.

## 하이웍스 메일 연동 (POP3S, 읽기 전용)

하이웍스는 IMAP 대신 POP3S(`pop3s.hiworks.com:995`)를 제공한다. 메일을 지우지 않고 읽기만 한다.

1. 하이웍스 웹메일 → 환경설정 → POP3/SMTP 사용을 켠다 (관리자가 막았다면 IT팀에 문의).
2. `tools/sync_mail.bat`을 한 번 실행하면 `tools/mail_config.json`이 생긴다. `user`에 메일 주소를 넣는다.
   - 비밀번호는 환경변수 `HIWORKS_PASSWORD`에 넣는 것을 추천한다 (`setx HIWORKS_PASSWORD "..."`). 비워두면 실행할 때 물어본다.
   - `dev_senders`에 개발자 메일 주소를 넣으면 코드가 없는 메일도 가져온다.
3. 연결 확인: `tools\sync_mail.bat --test`
4. 동기화: `tools\sync_mail.bat` → 저장소 루트에 `mail_inbox.json` 생성
5. Planner Desk → 메일 수신 → **동기화 파일 불러오기** → 자동 매칭 확인 → 반영

주기 실행 (30분마다):

```bash
schtasks /Create /SC MINUTE /MO 30 /TN "PlannerDesk 메일 동기화" /TR "\"C:\Users\RMS\Desktop\java\planner-desk\tools\sync_mail.bat\" --quiet"
```

`mail_config.json`, `.mail_state.json`, `mail_inbox.json`은 `.gitignore`로 커밋하지 않는다.

# 화면을 React로 옮기는 규칙

웹판(`src/`)은 오프라인판 코드(`src/legacy/engine.js`, 원본 `offline/index.html`)를 그대로 돌리면서 화면을 하나씩 React로 바꾼다.
`src/views/<이름>.jsx`가 `export const tabs = ["탭 키"]`와 기본 내보내기(컴포넌트)를 두면, 그 탭은 오프라인판 `render()`가 본문 `#view`를 비우고 React가 그린다. 왼쪽 메뉴·경로·창(모달)·토스트는 아직 오프라인판 코드가 그린다.

## 목표

오프라인판 `renderXxx()`가 만든 HTML과 **같은 화면, 같은 동작**. 새 기능·문구·디자인을 넣지 않는다.

## 쓰는 법

- 데이터: `const { S } = useStore();` (`src/lib/store.js`). `S`는 오프라인판과 같은 객체 하나이고, 고치면 `useStore()`를 쓰는 컴포넌트가 다시 그려진다. `S.ui`는 화면 상태(탭·필터·접기)다.
- 로직: `import * as E from "../legacy/engine.js";` 의 함수를 그대로 쓴다 (`E.computeAlerts`, `E.workItems`, `E.flowSteps`, `E.today` …). **같은 계산을 다시 짜지 않는다.**
- 고치기: 오프라인판 onclick 등이 부르던 함수를 그대로 부른다 (`E.setTask(id, "status", v)`, `E.editTask(id)`, `E.flowMove(...)` …). 이 함수들이 `S`를 고치고 `commit()`/`render()` 하면 React도 다시 그려진다.
- 화면 상태만 바꾸던 코드(`S.ui.x = v; persistUI(); render()`)는 그대로: `S.ui.x = v; E.persistUI(); E.render();`
- 창(모달): `E.editTask(id)`처럼 오프라인판 함수를 그대로 연다. 창은 이번에 옮기지 않는다.
- 모양: 오프라인판과 **같은 태그·클래스 이름**을 쓴다 (`card`, `card-h`, `t`, `badge b-green`, `kpi` … — CSS는 `src/legacy/legacy.css`). 오프라인판의 `style="..."` 은 Tailwind 유틸리티 클래스로 바꾸는 것을 기본으로 하되, 계산된 값(색·폭·위치)은 `style={{...}}`.
- 공통 부품: `src/components/ui.jsx` — `PageHead`, `Badge`, `TypeIcon`, `PriIcon`, `EpicTag`, `ChangeInput`, `Raw`.
  - `Raw`는 오프라인판 도우미가 만든 **아이콘 SVG 같은 작은 조각**에만. 화면 구조·목록·표를 `Raw`로 넣지 않는다.
  - 오프라인판 화면 함수가 쓰던 HTML 문자열 도우미(`alertRow`, `calPill`, `taskViaHtml` …)는 자기 화면 파일 안에 JSX 컴포넌트로 다시 만든다.

## 오프라인판 → JSX 바꿀 때

| 오프라인판 | JSX |
|---|---|
| `class=` | `className=` |
| `onclick="f('a')"` | `onClick={() => E.f("a")}` |
| `onclick="event.stopPropagation();f()"` | `onClick={(e) => { e.stopPropagation(); E.f(); }}` |
| `this.value` / `this.checked` / `this` | `e.target.value` / `e.target.checked` / `e.currentTarget` |
| `event` 를 넘기던 곳 (`calDrag(event, id)`, `boardDrop(event, ...)`) | `e.nativeEvent` |
| 글·날짜·숫자 칸의 `onchange` | `<ChangeInput value={..} onCommit={(v) => ...} />` (칸을 벗어나거나 Enter일 때만 저장 — React `onChange`는 글자마다 불림) |
| `select`·체크박스의 `onchange`, 검색칸의 `oninput` | React `onChange` |
| `ondragstart`·`ondragover`·`ondrop` 등 | 같은 이름의 React 핸들러, `data-*` 속성도 그대로 |
| 그린 뒤 DOM을 만지던 코드 (`setTimeout(() => $("x").scrollLeft = …)`, `wbsFreeze()`, `bindNoteEditor()`) | `useEffect` 안에서 |

- 문서 전체에 걸린 오프라인판 이벤트(타임라인 막대 끌기 `mousedown`, 검색 닫기 등)는 클래스·`data-*`로 대상을 찾으니 마크업을 그대로 둔다.
- `React.memo`·객체 동일성에 기대는 최적화는 쓰지 않는다 (S의 항목은 그 자리에서 고쳐진다).
- `key`는 항목 `id`.

## 확인 (끝내기 전에 꼭)

```bash
node tools/smoke.mjs "planner-desk_울산인천.html" <내 탭 키 …>
node tools/smoke.mjs "261020_1308_울산·인천_업무관리.html" <내 탭 키 …>
```

- 전체·프로젝트별로 오프라인판 함수의 **글자 내용**과 React 화면의 글자 내용을 비교한다. 둘 다 `오류 없음`이어야 한다.
- 글자 비교로는 동작을 확인할 수 없으니, 오프라인판 함수에 있는 `on…=` 속성을 하나하나 JSX 핸들러로 옮겼는지 직접 대조한다.
- `npx vite build`는 다른 화면이 작업 중이면 실패할 수 있으니 돌리지 않는다.

---

# 창(모달)을 React로 옮기는 규칙

`src/modals/<이름>.jsx`가 아래 셋을 두면, 오프라인판에서 그 함수를 부를 때(화면 버튼이든 오프라인판 코드 안이든) 같은 인자로 React 창이 열린다 (`tools/make-engine.cjs`가 함수 맨 앞에 넘김 한 줄을 넣어 둠).

```jsx
export const opens = ["editTask"];                          // 오프라인판 함수 이름
export const samples = (S) => [["editTask", S.tasks[0]?.id], ["editTask"]];   // 비교용: [함수 이름, 인자 …]
export default function TaskModal({ args: [id], name }) { … return <Modal title=… buttons=…>…</Modal>; }
```

- 틀은 `src/components/Modal.jsx`의 `<Modal title wide buttons>` — 오프라인판 `openModal`과 같은 마크업. `buttons`는 오프라인판과 같은 `{ l, cls, fn }`, 취소처럼 "작성 중이면 묻고 닫기"는 `{ l: "취소", close: true }`. 닫기는 `closeModal()` (`src/lib/modal.js`).
- `openForm(title, fields, obj, onSave, extraBtns, extraHtml, extraPos)`으로 만들던 창은 칸 정의(fields)를 그대로 JSX 칸으로 그린다: 같은 클래스(`form`, `full`, `form-split`, `fs-main`, `fs-side`, `form-sec`, `date-pair`, `check`, `ro-box` …)와 같은 순서·라벨·placeholder. 조건 칸(`show`)은 상태로 보이고 숨긴다. 저장 버튼은 오프라인판 openForm의 저장 처리(필수값 확인 → 시작일·종료일 확인 → onSave → 닫기)와 같게.
- 저장 로직(onSave 안의 코드)은 오프라인판 그대로 옮긴다: `S`를 고치고 `E.commit()`(또는 원래 부르던 `E.persist()`/`E.render()`). 다른 계산·도우미는 `E.`로 부른다.
- 창 안에서 다른 창을 여는 버튼은 그 함수를 그대로 부른다 (`E.editTask(id)` → React 창이면 React로, 아니면 오프라인판 창으로 열림).
- 창 안의 입력칸은 창이 열려 있는 동안 사용자가 고치는 값이므로 `useState`로 들고 있다가 저장 때 쓴다 (ChangeInput 불필요). 창이 바로바로 저장하던 칸(기록 추가·삭제 등)은 오프라인판처럼 바로 저장.
- 오프라인판이 창 DOM을 직접 고치던 도우미(`$("…").innerHTML = …`로 창 일부를 다시 그림)는 React 상태로 다시 그린다.
- 문구·라벨·placeholder·버튼 이름은 그대로. hint 문구도 오프라인판에 있으면 그대로 둔다(새로 만들지 않음).

확인: `node --max-semi-space-size=4 tools/smoke.mjs "<데이터 파일>" m:<함수 이름> …` — samples의 각 경우로 오프라인판 창과 React 창을 열어 글자 내용(입력칸 값 제외, textarea 내용 포함)을 비교한다. 두 데이터 파일 모두 `오류 없음`.

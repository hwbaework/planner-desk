import { useStore } from "../lib/store.js";
import * as E from "../legacy/engine.js";

const CONN = { online: ["서버에 저장됨", ""], connecting: ["연결 중", ""], reconnecting: ["다시 연결 중", "dirty"], offline: ["연결 끊김 · 다시 연결되면 저장", "dirty"] };

// 상단바: 오프라인판과 같은 자리·모양 (id는 오프라인판 코드가 찾는 이름 그대로)
export default function TopBar() {
  const { conn, pending } = useStore();
  const [label, cls] = pending && conn === "online" ? ["저장 중", ""] : CONN[conn] || CONN.offline;
  return (
    <header className="top">
      <div>
        <div className="brand" onClick={() => E.goHome()} title="홈 (전체 보기 대시보드)" style={{ cursor: "pointer" }}>
          <img src="/favicon.svg" alt="" />Planner Desk
        </div>
        <div className="today" id="todayLabel"></div>
      </div>
      <div className="gsearch">
        <svg className="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input id="gq" type="text" placeholder="검색 (Ctrl+K) — 업무·전달·산출물·데이터·화면·테스트·메모" autoComplete="off"
          onInput={(e) => E.gSearch(e.target.value)} onKeyDown={(e) => E.gKey(e.nativeEvent)} onFocus={(e) => E.gSearch(e.target.value)} />
        <div id="gres" className="gres"></div>
      </div>
      <div className="spacer"></div>
      <span className={`save-ind ${cls}`}>{label}{pending && conn !== "online" ? ` · ${pending}건 대기` : ""}</span>
      <button className="btn primary" onClick={() => E.quickCreate()} title="어디서든 바로 만들기 (C)">
        <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg><span>만들기</span>
      </button>
      <button className="btn" onClick={() => E.openReport()} title="주간보고 초안">
        <svg className="ico" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg><span>주간보고</span>
      </button>
      <input type="file" id="importFile" accept=".html,.htm,.json,.txt" style={{ display: "none" }} onChange={(e) => E.importFile(e.nativeEvent)} />
      <button className="btn ghost icon" onClick={() => E.toggleTheme()} title="화이트 / 다크 전환" id="themeBtn"></button>
      <button className="btn ghost icon" onClick={() => E.openSettings()} title="설정 · 불러오기 · 내보내기">
        <svg className="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
      </button>
    </header>
  );
}

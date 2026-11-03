import { useStore, setUI, update } from "../lib/store.js";
import { today, wd } from "../lib/date.js";

const CONN = { online: ["저장됨", "text-faint"], connecting: ["연결 중", "text-faint"], reconnecting: ["다시 연결 중", "text-warn"], offline: ["연결 끊김", "text-danger"] };

export default function TopBar({ onSettings }) {
  const { S, conn, pending } = useStore();
  const [label, cls] = pending && conn === "online" ? ["저장 중", "text-faint"] : CONN[conn] || CONN.offline;
  const dark = S.settings.theme === "dark";
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-panel px-[18px] py-2.5">
      <div className="w-[224px] flex-none">
        <div className="flex cursor-pointer items-center gap-2 text-[15px] font-bold" title="홈 (전체 보기 대시보드)"
          onClick={() => { setUI({ pid: "all", tab: "dash" }); scrollTo(0, 0); }}>
          <img src="/favicon.svg" alt="" className="size-[26px]" />Planner Desk
        </div>
        <div className="text-xs text-dim">오늘 {today()} ({wd(today())})</div>
      </div>
      <div className="flex-1" />
      <span className={`text-[12.5px] whitespace-nowrap ${cls}`}>
        {label}{pending && conn !== "online" ? ` · 보낼 변경 ${pending}건` : ""}
      </span>
      <button className="btn ghost px-2" title="화이트 / 다크 전환"
        onClick={() => update((s) => { s.settings.theme = dark ? "light" : "dark"; }, { undo: false })}>
        <svg className="ico" viewBox="0 0 24 24">
          {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>
            : <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />}
        </svg>
      </button>
      <button className="btn ghost px-2" title="설정 · 가져오기 · 내보내기" onClick={onSettings}>
        <svg className="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
      </button>
    </header>
  );
}

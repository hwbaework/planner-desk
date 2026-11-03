import { useEffect, useState } from "react";
import { useStore, setUI, undo } from "./lib/store.js";
import { TABS, proj } from "./lib/model.js";
import TopBar from "./components/TopBar.jsx";
import Side from "./components/Side.jsx";
import Settings from "./components/Settings.jsx";
import Toasts from "./components/Toasts.jsx";

const LABEL = Object.fromEntries(TABS);

// 아직 옮기지 않은 화면
function NotYet({ tab }) {
  return (
    <div className="card p-6 text-dim">
      <b className="text-text">{LABEL[tab]}</b> 화면은 아직 옮기는 중이에요.
    </div>
  );
}

export default function App() {
  const { S, ui } = useStore();
  const [settings, setSettings] = useState(false);
  const pid = ui.pid !== "all" && proj(S, ui.pid) ? ui.pid : null;

  useEffect(() => {
    document.documentElement.dataset.theme = S.settings.theme === "dark" ? "dark" : "light";
    document.body.style.zoom = Number(S.settings.fontScale) || 1;
  }, [S.settings.theme, S.settings.fontScale]);

  // 되돌리기 (Ctrl+Z, 입력 중이 아닐 때)
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !typing) { e.preventDefault(); undo(); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const tab = LABEL[ui.tab] ? ui.tab : "dash";

  return (
    <>
      <TopBar onSettings={() => setSettings(true)} />
      <div className={`grid min-h-[calc(100vh-53px)] ${ui.sideFold ? "grid-cols-[64px_minmax(0,1fr)]" : "grid-cols-[232px_minmax(0,1fr)]"}`}>
        <Side />
        <main className="min-w-0 px-[22px] pt-3.5 pb-10">
          <nav className="mb-3 flex items-center gap-1.5 text-[13px] text-faint">
            <span className="cursor-pointer hover:underline" onClick={() => setUI({ pid: "all" })}>프로젝트</span>
            <span>/</span>
            <span className="cursor-pointer hover:underline" onClick={() => setUI({ tab: "dash" })}>{pid ? proj(S, pid).name : "전체 보기"}</span>
            <span>/</span>
            <b className="text-text">{LABEL[tab]}</b>
          </nav>
          <NotYet tab={tab} />
        </main>
      </div>
      {settings && <Settings onClose={() => setSettings(false)} />}
      <Toasts />
    </>
  );
}

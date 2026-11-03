import { useEffect } from "react";
import { onToast } from "./lib/store.js";
import * as E from "./legacy/engine.js";
import TopBar from "./components/TopBar.jsx";

// 화면 틀. 왼쪽 메뉴·경로·본문·창(모달)은 오프라인판 코드(src/legacy/engine.js)가 id로 찾아 그린다.
// React는 이 틀을 한 번만 그리고 그 안(#side, #view …)은 건드리지 않는다.
export default function App() {
  useEffect(() => {
    E.boot(); E.render();
    return onToast((t) => E.toast(t.text));
  }, []);

  return (
    <>
      <TopBar />
      <div className="shell">
        <aside className="side" id="side"></aside>
        <main>
          <div id="bannerArea"></div>
          <nav className="tabs" id="tabs"></nav>
          <section id="view"></section>
        </main>
      </div>
      <div className="modal-bg" id="modalBg" onMouseDown={(e) => { if (e.target === e.currentTarget) E.tryCloseModal(); }}>
        <div className="modal" id="modal">
          <div className="modal-h">
            <h2 id="modalTitle"></h2>
            <button className="btn ghost icon" onClick={() => E.tryCloseModal()} title="닫기 (Esc)">
              <svg className="ico" viewBox="0 0 24 24"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
          <div className="modal-b" id="modalBody"></div>
          <div className="modal-f" id="modalFoot"></div>
        </div>
      </div>
      <div id="toast"></div>
    </>
  );
}

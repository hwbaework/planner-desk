import { useEffect } from "react";
import { useStore } from "./lib/store.js";
import { VIEWS } from "./views/index.js";
import * as E from "./legacy/engine.js";
import TopBar from "./components/TopBar.jsx";
import Side, { Crumbs } from "./components/Side.jsx";
import { ModalHost } from "./components/Modal.jsx";
import Toast from "./components/Toast.jsx";
import "./modals/index.js";

// React로 옮긴 화면: 오프라인판 render()가 #view를 비워 두면 여기서 그림
function ReactView() {
  const { ui } = useStore();
  const V = VIEWS[ui.tab];
  return V ? <V key={ui.tab} /> : null;
}

// 화면 틀. 아직 옮기지 않은 화면 본문(#view)·창(모달)·토스트는 오프라인판 코드(src/legacy/engine.js)가 id로 찾아 그린다.
// React는 그 칸 안은 건드리지 않는다.
export default function App() {
  useEffect(() => {
    E.boot(); E.render();
  }, []);

  return (
    <>
      <TopBar />
      <div className="shell">
        <Side />
        <main>
          <div id="bannerArea"></div>
          <Crumbs />
          <section id="view"></section>
          <ReactView />
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
      <ModalHost />
      <Toast />
    </>
  );
}

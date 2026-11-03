import { useEffect } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { TypeIcon } from "../components/ui.jsx";
import { Run } from "./kit/form.jsx";

// 만들기 (오프라인판 quickCreate). 숫자 키 1~8로 항목 고르기는 이 창에서 처리
export const opens = ["quickCreate"];
export const samples = () => [["quickCreate"]];

const ICON = { ms: "event", risk: "bug", req: "doc", note: "doc" };
const pickQuick = (i) => { closeModal(); E.QUICK[i][3](); };

function QuickCreate() {
  const { S } = useStore();
  useEffect(() => {
    const onKey = (e) => {
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
      if (inField || e.ctrlKey || e.metaKey || e.altKey || !/^[1-8]$/.test(e.key)) return;
      const i = Number(e.key) - 1;
      if (!E.QUICK[i]) return;
      e.preventDefault(); pickQuick(i);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  return (
    <Modal title="만들기" buttons={[{ l: "취소", close: true }]}>
      <div className="small muted" style={{ marginBottom: 8 }}>{S.ui.pid !== "all" ? E.projName(S.ui.pid) + "에" : "첫 프로젝트에 (창에서 바꿀 수 있어)"} 만들어. 단축키: 화면 어디서든 <b>C</b></div>
      {E.QUICK.map(([k, l, d], i) => (
        <div key={k} className="mrow" style={{ cursor: "pointer" }} onClick={() => pickQuick(i)}>
          <TypeIcon kind={ICON[k] || k} /><span className="nm"><b>{l}</b></span><span className="small muted">{d}</span><span className="small muted mono">{i + 1}</span>
        </div>
      ))}
    </Modal>
  );
}

export default function QuickCreateModal() {
  if (!E.activeProjects().length) return <Run fn={() => E.editProject()} />;
  return <QuickCreate />;
}

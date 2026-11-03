import { useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";

// 요구사항 붙여넣기 (오프라인판 bulkReqs)
export const opens = ["bulkReqs"];
export const samples = () => [["bulkReqs"]];

export default function BulkReqs() {
  const { S } = useStore();
  const [text, setText] = useState("");
  const pid = S.ui.pid;
  const add = () => {
    let add = 0, upd = 0; const missing = new Set();
    text.split(/\r?\n/).map((l) => l.split("\t").map((c) => c.trim())).filter((r) => r[1]).forEach(([code, title, kind, source, scr]) => {
      const codes = String(scr || "").split(/[,\s]+/).filter(Boolean);
      const screenIds = codes.map((c) => { const f = S.screens.find((x) => x.projectId === pid && x.code === c); if (!f) missing.add(c); return f?.id; }).filter(Boolean);
      const ex = code && S.reqs.find((r) => r.projectId === pid && r.code === code);
      if (ex) { Object.assign(ex, { title, kind: E.REQ_KIND.includes(kind) ? kind : ex.kind, source: source || ex.source, screenIds: [...new Set([...(ex.screenIds || []), ...screenIds])] }); upd++; }
      else { S.reqs.push({ id: E.uid("rq"), projectId: pid, code: code || E.nextReqCode(), title, kind: E.REQ_KIND.includes(kind) ? kind : "기능", source: source || "", status: "접수", priority: "mid", receivedAt: E.today(), screenIds }); add++; }
    });
    E.syncReqSeq(); E.commit(); closeModal();
    E.toast(`추가 ${add} · 갱신 ${upd}${missing.size ? ` · 화면 목록에 없는 화면ID: ${[...missing].slice(0, 5).join(", ")}` : ""}`);
  };
  return (
    <Modal title="요구사항 붙여넣기" buttons={[{ l: "취소", close: true, fn: closeModal }, { l: "추가", cls: "primary", fn: add }]}>
      <p className="small muted" style={{ marginBottom: 8 }}>요구사항 정의서 엑셀에서 열 순서대로 복사 (탭 구분): <b>REQ ID · 요구사항 · 구분 · 출처 · 반영 화면ID(쉼표로 여러 개)</b>. REQ ID를 비우면 자동 번호. 같은 REQ ID는 갱신.</p>
      <textarea id="bulkText" style={{ minHeight: 220 }} className="mono" value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

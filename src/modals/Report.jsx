import { useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { Modal } from "../components/Modal.jsx";

// 주간보고 초안 (오프라인판 openReport — 글은 buildReport, 인쇄는 printReport 그대로)
export const opens = ["openReport"];
export const samples = () => [["openReport"], ["openReport", -1]];

export default function ReportModal({ args: [wk = 0] }) {
  const { S } = useStore();
  const [txt, setTxt] = useState(() => {
    const pids = S.ui.pid === "all" ? E.activeProjects().map((p) => p.id) : [S.ui.pid];
    return E.buildReport(pids, wk);
  });
  return (
    <Modal title="주간보고 초안" wide buttons={[
      { l: "인쇄·PDF", cls: "left", fn: () => E.printReport(txt) },
      { l: ".txt 저장", cls: "left", fn: () => E.download(E.fileName("txt", "주간보고"), txt, "text/plain") },
      { l: "복사", cls: "primary", fn: () => E.copyText(txt) },
    ]}>
      {/* 기간을 바꾸면 오프라인판처럼 창을 새로 연다 (고친 글은 새 기간 초안으로 바뀜) */}
      <div className="seg" style={{ marginBottom: 10 }}>
        {[[0, "이번 주"], [-1, "지난 주"]].map(([k, l]) => <button key={k} className={k === wk ? "on" : ""} onClick={() => E.openReport(k)}>{l}</button>)}
      </div>
      <div className="small muted" style={{ marginBottom: 6 }}>{S.ui.pid === "all" ? "전체 프로젝트" : E.projName(S.ui.pid)} 기준 · 금주 실적 → 이슈 → 차주 계획. 고쳐서 복사하면 돼.</div>
      <textarea id="rep" className="mono" style={{ minHeight: 420 }} value={txt} onChange={(e) => setTxt(e.target.value)} />
    </Modal>
  );
}

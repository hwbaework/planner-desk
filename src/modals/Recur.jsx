import { useRef, useState } from "react";
import { useStore } from "../lib/store.js";
import { Modal } from "../components/Modal.jsx";
import { Bail, useForm, useFirstFocus } from "./Task.jsx";
import * as E from "../legacy/engine.js";

// 정기 업무 창 (오프라인판 editRecur)
export const opens = ["editRecur"];
export const samples = (S) => [
  ["editRecur", S.recurring[0]?.id],
  ["editRecur", S.recurring.find((r) => r.freq === "monthly")?.id],
  ["editRecur", S.recurring.find((r) => r.freq !== "monthly")?.id],
  ["editRecur"],
];

export default function RecurModal({ args: [id] }) {
  const { S } = useStore();
  if (!E.activeProjects().length) return <Bail msg="프로젝트를 먼저 만들어줘" />;
  if (id && !S.recurring.some((x) => x.id === id)) return null;
  return <RecurForm id={id} />;
}

function RecurForm({ id }) {
  const { S } = useStore();
  const bodyRef = useRef(null);
  const [r] = useState(() => (id ? S.recurring.find((x) => x.id === id) : { freq: "weekly", day: 3, projectId: S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0].id }));
  const [view] = useState(() => Object.assign({}, r, { wday: r.freq === "weekly" ? String(r.day) : "3", mday: r.freq === "monthly" ? r.day : 1 }));
  const [fields] = useState(() => [
    { k: "title", l: "정기 업무", t: "text", full: true, req: true, ph: "예: 주간업무 보고" },
    { k: "projectId", l: "프로젝트", t: "select", opts: E.activeProjects().map((p) => [p.id, p.name]) },
    { k: "freq", l: "주기", t: "select", opts: [["weekly", "매주"], ["monthly", "매월"]] },
    { k: "wday", l: "요일", t: "select", opts: [..."일월화수목금토"].map((d, i) => [String(i), d + "요일"]), show: ["freq", "weekly"] },
    { k: "mday", l: "매월 며칠", t: "number", show: ["freq", "monthly"] },
    { k: "nextDue", l: "다음 예정일", t: "date", hint: "비우면 주기로 자동 계산" },
    { k: "recipient", l: "수신 / 보고 대상", t: "text" },
    { k: "path", l: "파일 경로", t: "text", full: true },
    { k: "memo", l: "메모", t: "textarea", side: true },
  ]);
  const form = useForm(fields, view);
  useFirstFocus(bodyRef);
  const onSave = (v) => {
    v.day = v.freq === "monthly" ? Math.max(1, Math.min(31, Number(v.mday) || 1)) : Number(v.wday) || 0;
    delete v.wday; delete v.mday;
    if (!v.nextDue) v.nextDue = E.recurFirst(v);
    if (id) Object.assign(r, v); else S.recurring.push(Object.assign({ id: E.uid("r"), history: [], lastDone: "" }, v));
    E.commit();
  };
  const buttons = (id ? [{ l: "삭제", cls: "danger left", fn: () => { if (confirm("정기 업무를 삭제할까?")) { S.recurring = S.recurring.filter((x) => x.id !== id); E.commit(); E.closeModal(); E.toast("삭제했어", true); } } }] : [])
    .concat([{ l: "취소", close: true }, { l: "저장", cls: "primary", fn: () => form.submit(onSave) }]);
  return (
    <Modal title={id ? "정기 업무" : "정기 업무 추가"} wide buttons={buttons} bodyRef={bodyRef}>
      <div className="form-split" id="fForm">
        <div className="fs-main"><div className="form">{fields.filter((f) => !f.side).map((f) => form.cell(f))}</div></div>
        <div className="fs-side">{fields.filter((f) => f.side).map((f) => form.cell(f))}</div>
      </div>
    </Modal>
  );
}

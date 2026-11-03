import { useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { OpenForm } from "./_openForm.jsx";

// 기능 (오프라인판 editFunc)
export const opens = ["editFunc"];
export const samples = (S) => {
  const placed = (S.funcs || []).find((f) => f.wbsId && f.code);
  const leaf = S.wbs.find((w) => w.code && (w.screenIds || []).length);
  return [["editFunc", S.funcs?.[0]?.id], ["editFunc", placed?.id], ["editFunc", null, leaf?.id], ["editFunc"]];
};

export default function FuncModal({ args: [id, wid] }) {
  const { S } = useStore();
  // 새 기능: 열 때 한 번만 기본값
  const [init] = useState(() => {
    if (id) return null;
    const w0 = S.wbs.find((x) => x.id === wid);
    const scs = w0 ? (w0.screenIds || []).map((i) => S.screens.find((z) => z.id === i)).filter(Boolean) : [];
    return { review: "검토 전", wbsId: w0?.id || "", owner: scs.find((z) => z.dev)?.dev || (w0 && E.wbsFuncs(w0).slice(-1)[0]?.owner) || "" };
  });
  const f = id ? S.funcs.find((x) => x.id === id) : init;
  if (!f) return null;
  const pid = id ? f.projectId : S.ui.pid;
  const T = E.wbsTree(pid), leafOpts = E.wbsSelectOpts(pid).filter(([wid2]) => { const w = S.wbs.find((x) => x.id === wid2); return w && !(T.kids[w.code] || []).length; });
  const fields = [
    ...(id && f.code ? [{ k: "_code", l: "번호", t: "ro", v: f.code }] : []),
    { k: "name", l: "기능명", t: "text", full: true, req: true },
    { k: "wbsId", l: "화면 배치", t: "select", opts: [["", "미배치"], ...leafOpts] },
    { k: "owner", l: "담당자", t: "text" },
    { k: "review", l: "개발 검토", t: "select", opts: E.FUNC_REVIEW },
    { k: "reviewNote", l: "개발 의견", t: "text" },
    { k: "desc", l: "기능 정의", t: "textarea", full: true },
    { k: "data", l: "데이터 (API)", t: "textarea", full: true },
  ];
  const onSave = (v) => {
    const o = id ? f : Object.assign({ id: E.uid("fn"), projectId: pid, code: "", createdAt: new Date().toISOString() });
    const moved = o.wbsId !== v.wbsId;
    Object.assign(o, v, { updatedAt: new Date().toISOString() });
    // 배치하면 그 화면 번호로 (KAN-101-F001), 풀면 번호 없음
    if (moved || (o.wbsId && !o.code)) { const w = S.wbs.find((x) => x.id === o.wbsId); o.code = ""; if (w) o.code = E.nextFuncCode(w); }
    if (!id) S.funcs.push(o);
    if (o.wbsId) S.ui.funcWbs = o.wbsId;
    E.commit();
  };
  const del = () => { if (confirm(`「${f.name}」 기능을 지울까?`)) { S.funcs = S.funcs.filter((x) => x.id !== id); E.commit(); E.closeModal(); E.toast("삭제했어", true); } };
  return (
    <OpenForm title={id ? "기능" : "기능 추가"} fields={fields} obj={f} onSave={onSave}
      extraBtns={id ? [{ l: "삭제", cls: "danger left", fn: del }] : []} />
  );
}

import { useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { OpenForm } from "./_openForm.jsx";

// WBS 작업 (오프라인판 editWBS)
export const opens = ["editWBS"];
export const samples = (S) => {
  const coded = S.wbs.find((w) => w.code && S.wbs.some((x) => x.projectId === w.projectId && x.code && E.wbsParentCode(x.code) === w.code));
  const withTasks = S.wbs.find((w) => w.code && E.wbsTasksOf(w).length);
  const phaseW = S.wbs.find((w) => !w.code);
  const p = S.projects[0]?.id;
  return [
    ["editWBS", S.wbs[0]?.id],
    ["editWBS", coded?.id], ["editWBS", withTasks?.id], ["editWBS", phaseW?.id],
    ["editWBS"], ["editWBS", null, ""], ["editWBS", null, "P1", p],
    ["editWBS", null, "", coded?.projectId, coded?.code],
  ];
};

// workItems 의 click (창 열기)
function workOpen(it) {
  const x = it.x;
  if (it.kind === "req") return E.editReq(x.id);
  if (it.kind === "task") return E.editTask(x.id);
  if (it.kind === "ho") { const t = E.taskOfHO(x); return t ? E.editTask(t.id) : E.adoptHO(x.id); }
  if (it.kind === "data") return E.openData(x.id);
}

// 관련 업무: 일반 · 협의 · 기획 · 개발 · 테스트 · 완료 칸 (오프라인판 wbsTaskBoard)
function TaskBoard({ w }) {
  const list = E.wbsTasksOf(w), FL = E.flowSteps();
  if (!list.length) return <span className="muted small">-</span>;
  const cols = [["일반", (it) => it.flow < 0 && !E.workDone(it)], ...FL.map((n, i) => [n, (it) => (E.workDone(it) ? i === FL.length - 1 : it.flow === i)])].filter(([n, f]) => n !== "일반" || list.some(f));
  return (
    <div className="wbs-tk-in" style={{ gridTemplateColumns: `repeat(${cols.length},minmax(160px,1fr))` }}>
      {cols.map(([n, f]) => { const its = list.filter(f);
        return (
          <div key={n} className="wbs-tk-col"><div className="wbs-tk-h">{n} <span className="muted">{its.length}</span></div>
            {its.map((it, i) => (
              <div key={it.x.id || i} className={`wbs-tk-i ${E.workDone(it) ? "is-done" : ""}`}
                onClick={() => { E.closeModal(); window._modalBack = () => E.editWBS(w.id); workOpen(it); }}>
                {it.code ? <span className="code-tag">{it.code}</span> : null} {it.title}
              </div>
            ))}
          </div>
        ); })}
    </div>
  );
}

const ScreenChips = ({ w }) => {
  const list = (w.screenIds || []).map((id) => E.S.screens.find((s) => s.id === id)).filter(Boolean);
  if (!list.length) return null;
  return list.map((s, i) => (
    <span key={s.id}>{i ? " " : ""}<span className="chip-ref" style={{ cursor: "pointer" }} onClick={() => E.editScreen(s.id)} title={s.menu || ""}>{s.code} {s.name}</span></span>
  ));
};

export default function WbsModal({ args: [id, phaseId, pid, parentCode] }) {
  const { S } = useStore();
  // 새 작업: 열 때 한 번만 (번호 미리 보기)
  const [init] = useState(() => {
    if (id) return null;
    const w = { phase: phaseId ?? "", progress: 0, projectId: pid || (S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0]?.id) };
    const tmp = { id: "__new", projectId: w.projectId, code: E.wbsNextChild(w.projectId, parentCode || "") };
    S.wbs.push(tmp); const roWid = E.wbsIdMap(w.projectId)[tmp.id] || ""; S.wbs.pop();
    return { w, roCode: tmp.code, roWid };
  });
  const w = id ? S.wbs.find((x) => x.id === id) : init.w;
  if (!w) return null;
  const hasKids = !!(w.code && S.wbs.some((x) => x.projectId === w.projectId && x.code && E.wbsParentCode(x.code) === w.code));
  const menuWbs = !id || !!w.code;
  const roCode = id ? w.code || "" : init.roCode, roWid = id ? w.wid || "" : init.roWid;
  const cols = E.wbsCols(w.projectId);
  const screens = <ScreenChips w={w} />;
  const fields = [
    ...(roCode ? [{ k: "_code", l: "WBS 번호", t: "ro", v: roCode }, { k: "_wid", l: "ID", t: "ro", v: roWid }] : []),
    { k: "title", l: "작업 (메뉴·화면·업무)", t: "text", full: true, req: true },
    { k: "owner", l: "담당", t: "text", full: !(menuWbs && id) },
    ...(menuWbs && id ? [{ k: "_prog", l: "진척", t: "ro", v: `${(E.wbsTree(w.projectId).roll.get(w.id) || {}).progress || 0}%` },
      { k: "_screens", l: "화면", t: "html", full: true, html: (w.screenIds || []).some((sid) => S.screens.some((s) => s.id === sid)) ? screens : null }] : []),
    ...(menuWbs ? [] : [{ k: "phase", l: "수행 단계", t: "select", opts: [["", "일반 업무 / 미분류"], ...E.PHASES.map((p) => [p.id, `${p.id} ${p.name}`])] },
      { k: "note", l: "비고 (차년도 등)", t: "text" }]),
    { k: ["start", "end"], l: "기간", t: "period" },
    ...(menuWbs && cols.length ? [{ k: "_cfsec", l: "", t: "sec" }] : []),
    ...(menuWbs ? cols.map((c) => ({ k: "cf." + c.id, l: c.name, t: "text", v: (w.cf || {})[c.id] || "" })) : []),
    ...(menuWbs || hasKids ? [] : [{ k: "progress", l: "진척률(%)", t: "number" }]),
    ...(menuWbs ? [] : [{ k: "docIds", l: "이 작업의 산출물", t: "multi", opts: S.docs.filter((d) => d.projectId === w.projectId).map((d) => [d.id, `${d.phase || ""} ${d.name} (${d.status})`]) },
      { k: "newDoc", l: "산출물 새로 만들어 연결", t: "text" }]),
    ...(menuWbs || hasKids ? [] : [{ k: "screenIds", l: "연결 화면", t: "multi", full: true, opts: S.screens.filter((s) => s.projectId === w.projectId).map((s) => [s.id, `${s.code} ${s.name}${s.menu ? " · " + s.menu : ""}`]) }]),
    { k: "memo", l: "메모", t: "textarea", side: true },
  ];
  const obj = Object.assign({}, w, { docIds: E.wbsDocs(w).filter((x) => x.doc).map((x) => x.doc.id), newDoc: "" });

  const onSave = (v) => {
    if (v.progress !== undefined) v.progress = Math.max(0, Math.min(100, Number(v.progress) || 0));
    // 컬럼 값은 cf로 모음
    Object.keys(v).filter((k) => k.startsWith("cf.")).forEach((k) => { v.cf = Object.assign({}, w.cf, v.cf, { [k.slice(3)]: v[k] }); delete v[k]; });
    // WBS 번호는 자동: 수정은 그대로, 새로 만들면 맨 뒤 (하위 추가면 그 아래 맨 뒤)
    v.code = id ? w.code : E.wbsNextChild(w.projectId, parentCode || "");
    if (v.code && !/^\d+(\.\d+)*$/.test(v.code)) { E.toast("WBS 번호는 1.2.1 처럼 숫자와 점으로"); return false; }
    if (v.code && S.wbs.some((x) => x.id !== id && x.projectId === w.projectId && x.code === v.code)) { E.toast(`${v.code} 번호가 이미 있어`); return false; }
    // 산출물 새로 만들기 → 산출물 목록에 추가하고 이 작업에 연결
    String(v.newDoc || "").split(",").map((x) => x.trim()).filter(Boolean).forEach((name) => {
      const d = { id: E.uid("d"), projectId: w.projectId, phase: v.phase || "", name, status: "미착수", version: "v0.1", owner: v.owner || "", plan: v.end || "", requestedAt: "", approvedAt: "", approver: "", path: "", memo: "", history: [], order: 99 };
      S.docs.push(d); v.docIds = [...(v.docIds || []), d.id];
    });
    delete v.newDoc;
    const auto = E.wbsDocs(Object.assign({}, w, { docIds: undefined })).filter((x) => x.doc).map((x) => x.doc.id).sort().join();
    if (!v.code && (!id || v.docIds.slice().sort().join() === auto)) delete v.docIds;   // 수행 단계 작업은 기본과 같으면 저장 안 함 (작업명 바뀌면 따라감)
    // 번호를 바꾸면(위·아래 단계로 이동) 하위 항목도 같이 옮김. ID는 그대로
    if (id && w.code && v.code && v.code !== w.code) {
      const kids = S.wbs.filter((x) => x.projectId === w.projectId && x.code && x.code.startsWith(w.code + "."));
      const clash = kids.map((k) => v.code + k.code.slice(w.code.length)).find((c) => S.wbs.some((x) => x.projectId === w.projectId && x.code === c && !kids.includes(x)));
      if (clash || v.code.startsWith(w.code + ".")) { E.toast(clash ? `${clash} 번호가 이미 있어` : "자기 하위로는 옮길 수 없어"); return false; }
      kids.forEach((k) => (k.code = v.code + k.code.slice(w.code.length)));
    }
    let casc = 0;
    if (id) {
      const ov = { owner: w.owner || "", cf: Object.assign({}, w.cf) };
      Object.assign(w, v);
      casc += E.wbsCascade(w, "owner", ov.owner, w.owner || "");
      E.wbsCols(w.projectId).forEach((c) => (casc += E.wbsCascade(w, "cf." + c.id, ov.cf[c.id] || "", (w.cf || {})[c.id] || "")));
    } else S.wbs.push(Object.assign({ id: E.uid("w"), projectId: w.projectId }, v));
    if (casc) setTimeout(() => E.toast(`하위 ${casc}개도 같이 바꿨어`, true), 0);
    E.wbsAutoIds(w.projectId);
    E.commit();
  };

  const del = () => {
    const sub = w.code ? S.wbs.filter((x) => x.projectId === w.projectId && x.code && x.code.startsWith(w.code + ".")) : [];
    if (!confirm(sub.length ? `이 작업과 하위 작업 ${sub.length}개를 함께 삭제할까?` : "작업을 삭제할까?")) return;
    const delIds = new Set([id, ...sub.map((x) => x.id)]);
    const goneSc = new Set(S.wbs.filter((x) => delIds.has(x.id)).flatMap((x) => x.screenIds || []));
    S.wbs = S.wbs.filter((x) => !delIds.has(x.id));
    S.screens = S.screens.filter((x) => !goneSc.has(x.id));
    S.handoffs.forEach((h) => { if ((h.screenIds || []).some((y) => goneSc.has(y))) h.screenIds = h.screenIds.filter((y) => !goneSc.has(y)); });
    S.funcs.forEach((f) => { if (delIds.has(f.wbsId)) { f.wbsId = ""; f.code = ""; } });
    // 지운 자리는 뒤 번호가 당겨 채우고 ID도 다시 매김
    if (w.code) { E.wbsCloseGap(w.projectId, E.wbsParentCode(w.code)); E.wbsAutoIds(w.projectId); }
    E.commit(); E.closeModal(); E.toast("삭제했어", true);
  };

  const nTk = menuWbs && id ? E.wbsTasksOf(w).length : 0;
  return (
    <OpenForm title={id ? "WBS 작업" : parentCode ? "하위 작업 추가" : "WBS 작업 추가"} fields={fields} obj={obj} onSave={onSave}
      extraBtns={id ? [{ l: "삭제", cls: "danger left", fn: del }] : []}
      extra={nTk ? <><div className="sec-t">관련 업무 {nTk}</div><TaskBoard w={w} /></> : null} />
  );
}

import { useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { Modal } from "../components/Modal.jsx";
import { OpenForm } from "./_openForm.jsx";

// 화면 (오프라인판 editScreen) · 화면 목록 붙여넣기 (bulkScreens)
export const opens = ["editScreen", "bulkScreens"];
export const samples = (S) => [["editScreen", S.screens[0]?.id], ["editScreen", S.screens[S.screens.length - 1]?.id], ["editScreen"], ["bulkScreens"]];

// 화면은 메뉴(WBS) 아래에만 있음: 새 화면 = 고른 메뉴 아래 WBS 항목 + 화면, ID는 WBS ID 그대로
function EditScreen({ id }) {
  const { S } = useStore();
  const pid = S.ui.pid;
  const [init] = useState(() => (id ? null : { status: "작성중", owner: S.settings.me }));
  const s = id ? S.screens.find((x) => x.id === id) : init;
  if (!s) return null;
  const w = id ? S.wbs.find((x) => (x.screenIds || []).includes(id)) : null;
  const parents = E.wbsSelectOpts(pid).filter(([wid]) => { const x = S.wbs.find((y) => y.id === wid); return x && x.code.split(".").length < E.WBS_MAX_DEPTH; });
  const fields = [
    ...(id ? [{ k: "_code", l: "화면ID", t: "ro", v: s.code }] : [{ k: "_parent", l: "위치 (어느 메뉴 아래)", t: "select", req: true, opts: [["", "-"], ...parents] }]),
    { k: "name", l: "화면명", t: "text", req: true, full: !id },
    { k: "status", l: "설계 상태", t: "select", opts: E.SCREEN_ST },
    { k: "owner", l: "기획 담당", t: "text" },
    { k: "dev", l: "개발 담당", t: "text" },
    { k: "url", l: "화면 URL", t: "text", full: true },
    { k: "path", l: "화면설계서 위치 (이 화면만 따로 있을 때)", t: "text", full: true },
    { k: "memo", l: "비고", t: "textarea", side: true },
  ];
  const onSave = (v) => {
    if (id) {
      Object.assign(s, v);
      if (w && v.name) w.title = v.name;   // 화면명 = WBS 작업명
    } else {
      const par = S.wbs.find((x) => x.id === v._parent); delete v._parent;
      if (!par) { E.toast("위치를 골라줘"); return false; }
      const sc = Object.assign({ id: E.uid("s"), projectId: pid, history: [] }, v);
      const nw = { id: E.uid("w"), projectId: pid, code: E.wbsNextChild(pid, par.code), title: v.name, phase: "", start: "", end: "", progress: 0, owner: "", memo: "", screenIds: [sc.id] };
      S.wbs.push(nw); E.wbsAutoIds(pid); sc.code = nw.wid || ""; S.screens.push(sc);
    }
    E.commit();
  };
  const del = () => { if (confirm("화면을 삭제할까?")) { S.screens = S.screens.filter((x) => x.id !== id); S.wbs.forEach((x) => { if (x.screenIds) x.screenIds = x.screenIds.filter((y) => y !== id); }); E.commit(); E.closeModal(); E.toast("삭제했어", true); } };
  return (
    <OpenForm title={id ? "화면" : "화면 추가"} fields={fields} obj={s} onSave={onSave}
      extraBtns={id ? [{ l: "삭제", cls: "danger left", fn: del }] : []} />
  );
}

function BulkScreens() {
  const { S } = useStore();
  const [text, setText] = useState("");
  const add = () => {
    const pid = S.ui.pid; let add = 0, upd = 0;
    text.split(/\r?\n/).map((l) => l.split("\t").map((c) => c.trim())).filter((r) => r[0] && r[1]).forEach(([code, name, menu, owner, dev]) => {
      const ex = S.screens.find((s) => s.projectId === pid && s.code === code);
      if (ex) { Object.assign(ex, { name, menu: menu || ex.menu, owner: owner || ex.owner, dev: dev || ex.dev }); upd++; }
      else { S.screens.push({ id: E.uid("s"), projectId: pid, code, name, menu: menu || "", owner: owner || S.settings.me, dev: dev || "", status: "작성중", version: "v0.1" }); add++; }
    });
    E.commit(); E.closeModal(); E.toast(`추가 ${add} · 갱신 ${upd}`);
  };
  return (
    <Modal title="화면 목록 붙여넣기" buttons={[{ l: "취소", close: true }, { l: "추가", cls: "primary", fn: add }]}>
      <p className="small muted" style={{ marginBottom: 8 }}>엑셀에서 열 순서대로 복사해 붙여넣기 (탭 구분): <b>화면ID · 화면명 · 메뉴경로 · 기획담당 · 개발담당</b> — 뒤쪽 열은 생략 가능. 같은 화면ID는 갱신.</p>
      <textarea id="bulkText" style={{ minHeight: 240 }} className="mono" placeholder={"SCR-001\t로그인\t공통 > 로그인\nSCR-002\t회원가입\t회원 > 가입"}
        value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

export default function ScreenModal({ args, name }) {
  return name === "bulkScreens" ? <BulkScreens /> : <EditScreen id={args[0]} />;
}

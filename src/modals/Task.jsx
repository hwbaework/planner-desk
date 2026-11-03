import { useEffect, useReducer, useRef, useState } from "react";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { Raw } from "../components/ui.jsx";
import * as E from "../legacy/engine.js";

// 업무 창 (오프라인판 editTask: openForm + 진행 기록)
export const opens = ["editTask"];
export const samples = (S) => {
  const has = (f) => S.tasks.find(f)?.id;
  return [
    ["editTask", S.tasks[0]?.id],
    ["editTask", has((t) => (t.log || []).length > 2)],
    ["editTask", has((t) => t.hoId && S.handoffs.some((h) => h.id === t.hoId))],
    ["editTask", has((t) => t.riskId && S.risks.some((r) => r.id === t.riskId))],
    ["editTask", has((t) => t.noteId && S.notes.some((n) => n.id === t.noteId))],
    ["editTask", has((t) => E.memoDated(t.memo).length)],
    ["editTask", has((t) => t.kind === "req")],
    ["editTask", has((t) => (t.log || []).some((e) => e.link || e.to))],
    ["editTask"],
    ["editTask", null, { status: "대기", projectId: S.projects[0]?.id }],
    ["editTask", null, { start: E.today(), due: E.addDays(E.today(), 7) }],
    ["editTask", null, { kind: "recur" }],
    ["editTask", null, { kind: "req" }],
    ["editTask", null, { stage: "기획" }],
    ["editTask", null, { stage: "" }],
  ];
};

// 오프라인판에서 열자마자 toast 하고 끝나던 경우 (창 없음)
export function Bail({ msg }) {
  useEffect(() => { E.toast(msg); closeModal(); }, []);
  return null;
}

// ── 오프라인판 openForm 의 칸 정의(fields)를 그대로 그리는 도우미 ──
const NO_KEY = ["ro", "html", "raw", "sec"];
const optsOf = (f) => f.opts.map((o) => (Array.isArray(o) ? o : [o, o]));
const initOf = (f, obj) => {
  const v = obj[f.k] !== undefined && obj[f.k] !== null && obj[f.k] !== "" ? obj[f.k] : f.v ?? "";
  if (f.t === "check") return !!v;
  if (f.t === "select") { const ov = optsOf(f).map(([x]) => String(x)); return ov.includes(String(v)) ? String(v) : ov[0] ?? ""; }   // 맞는 항목이 없으면 브라우저처럼 첫 항목
  return String(v);
};
export function useForm(fields, obj) {
  const [vals, setVals] = useState(() => Object.fromEntries(fields.filter((f) => !NO_KEY.includes(f.t)).map((f) => [f.k, initOf(f, obj)])));
  const set = (k, v) => setVals((o) => ({ ...o, [k]: v }));
  // 조건 칸: 기준 칸 값이 맞을 때만 보임 (기준 칸이 없으면 보임)
  const test = (k, want) => { if (!(k in vals)) return true; return want.startsWith("!") ? vals[k] !== want.slice(1) : vals[k] === want; };
  const cell = (f, full = f.full) => {
    if (f.t === "check") return <div className="full" key={f.k}><label className="check"><input type="checkbox" data-k={f.k} data-check="1" checked={!!vals[f.k]} onChange={(e) => set(f.k, e.target.checked)} /> {f.l}</label></div>;
    let input;
    const on = (e) => set(f.k, e.target.value);
    if (f.t === "textarea") input = <textarea data-k={f.k} placeholder={f.ph || ""} value={vals[f.k]} onChange={on} />;
    else if (f.t === "select") input = <select data-k={f.k} value={vals[f.k]} onChange={on}>{optsOf(f).map(([ov, ol]) => <option key={ov} value={ov}>{ol}</option>)}</select>;
    else if (f.t === "ro") input = <input type="text" value={initOf(f, obj)} disabled className="mono" />;
    else input = <input type={f.t} data-k={f.k} value={vals[f.k]} placeholder={f.ph || ""} onChange={on} />;
    const shown = !f.show || (test(f.show[0], f.show[1]) && (!f.show[2] || test(f.show[2], f.show[3])));
    return (
      <div key={f.k} className={full ? "full" : ""} style={shown ? undefined : { display: "none" }}>
        <label>{f.l}{f.req ? <> <span className="req">*</span></> : null}</label>{input}{f.hint ? <div className="hint">{f.hint}</div> : null}
      </div>
    );
  };
  // 오프라인판 저장 버튼: 값 모으기 → 필수값 → 시작일·종료일 → onSave → 닫기. 닫았으면 true
  const submit = (onSave) => {
    const v = {};
    fields.filter((f) => !NO_KEY.includes(f.t)).forEach((f) => (v[f.k] = f.t === "check" ? !!vals[f.k] : String(vals[f.k] ?? "").trim()));
    const miss = fields.find((f) => f.req && !v[f.k]);
    if (miss) { E.toast(`${miss.l} 입력 필요`); return false; }
    if (v.start && ((v.end && v.start > v.end) || (v.due && v.start > v.due))) { E.toast("시작일이 종료일보다 늦을 수 없어"); return false; }
    if (onSave(v) === false) return false;
    E.closeModal(); return true;
  };
  return { vals, set, cell, submit };
}
// 열면 첫 칸에 커서 (오프라인판 openForm)
export function useFirstFocus(ref) {
  useEffect(() => { const t = setTimeout(() => ref.current?.querySelector("[data-k]")?.focus(), 30); return () => clearTimeout(t); }, []);
}

export default function TaskModal({ args: [id, preset] }) {
  const { S } = useStore();
  if (!E.activeProjects().length) return <Bail msg="프로젝트를 먼저 만들어줘" />;
  if (id && !S.tasks.some((t) => t.id === id)) return null;
  return <TaskForm id={id} preset={preset} />;
}

function TaskForm({ id, preset }) {
  const { S } = useStore();
  const [, bump] = useReducer((n) => n + 1, 0);
  const bodyRef = useRef(null);
  const [fresh] = useState(() => (id ? null : Object.assign({ status: "진행중", priority: "mid", start: E.today(), projectId: S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0].id }, preset || {})));
  const [back] = useState(() => !!window._modalBack);
  const x = id ? S.tasks.find((t) => t.id === id) || fresh || {} : fresh;
  const fromNote = x.noteId && S.notes.find((n) => n.id === x.noteId);
  const devHO = id && x.hoId ? S.handoffs.find((h) => h.id === x.hoId) : null;
  const [fields] = useState(() => [
    ...(id && x.code ? [{ k: "_code", l: "번호", t: "ro", v: x.code }] : []),
    { k: "kind", l: "구분", t: "select", opts: [["task", "업무"], ["req", "요구사항"], ...(id ? [] : [["recur", "정기 업무"]])], v: x.kind || "task" },
    ...(id ? [] : [{ k: "_issue", l: "이슈로도 등록", t: "check" }]),
    { k: "title", l: "업무", t: "text", full: true, req: true, ph: "예: 협력사 자료 회신 확인" },
    { k: "projectId", l: "프로젝트", t: "select", opts: E.activeProjects().map((p) => [p.id, p.name]) },
    { k: "status", l: "상태", t: "select", opts: E.TASK_ST },
    ...(devHO ? [{ k: "_hoSt", l: `단계 · ${devHO.code}`, t: "select", opts: [...E.flowSteps().slice(E.flowIdx("개발")).map((n) => [n, n]), ["보류", "보류"]] }] : []),
    ...(devHO ? [] : [{ k: "stage", l: "단계", t: "select", opts: [...E.flowSteps().slice(0, E.flowIdx("개발") + 1).map((n) => [n, n]), ["", "업무"]] }]),
    { k: "priority", l: "우선순위", t: "select", opts: E.PRI },
    { k: "wbsId", l: "관련 WBS (메뉴·페이지)", t: "select", opts: [["", "-"], ...E.wbsSelectOpts(x.projectId)] },
    { k: "owner", l: "담당", t: "text", ph: "예: 홍길동 과장" },
    { k: "start", l: "시작일", t: "date" },
    { k: "due", l: "마감일", t: "date", hint: "캘린더에 표시됨" },
    { k: "link", l: "링크 (메일·문서·폴더)", t: "text", full: true, ph: "메일 제목·주소, https://..., \\\\server\\폴더 — 붙여넣기", hint: "어디서 온 일인지 근거. 목록에서 눌러 열거나 복사" },
    // 구분이 정기 업무일 때만
    ...(id ? [] : [{ k: "freq", l: "주기", t: "select", opts: [["weekly", "매주"], ["monthly", "매월"]], show: ["kind", "recur"] },
      { k: "wday", l: "요일", t: "select", opts: [..."일월화수목금토"].map((d, i) => [String(i), d + "요일"]), v: "3", show: ["kind", "recur", "freq", "weekly"] },
      { k: "mday", l: "매월 며칠", t: "number", v: 1, show: ["kind", "recur", "freq", "monthly"] },
      { k: "nextDue", l: "다음 예정일", t: "date", show: ["kind", "recur"] },
      { k: "recipient", l: "수신 / 보고 대상", t: "text", show: ["kind", "recur"] }]),
    { k: "memo", l: "받은 내용 / 메모", t: "textarea", side: true, ph: "받았을 때의 요청 내용, 배경, 참고사항" },
  ].map((f) => (!id && ["_issue", "status", "stage", "priority", "wbsId", "owner", "start", "due"].includes(f.k) ? Object.assign({}, f, { show: ["kind", "!recur"] }) : f)));
  const obj = devHO ? Object.assign({}, x, { _hoSt: devHO.status === "hold" ? "보류" : E.flowSteps()[E.hoFlow(devHO)] }) : x;
  const form = useForm(fields, obj);
  useFirstFocus(bodyRef);
  // 진행 기록 입력칸
  const [tlAt, setTlAt] = useState(() => E.today());
  const [tlTo, setTlTo] = useState("");
  const [tlLink, setTlLink] = useState("");
  const [tlText, setTlText] = useState("");
  const [editing, setEditing] = useState(null);
  const tlExtra = () => { const to = tlTo.trim(), link = tlLink.trim(); return Object.assign({}, to ? { to } : {}, link ? { link } : {}); };

  const onSave = (v) => {
    const hs = v._hoSt; delete v._hoSt;
    if (devHO && hs) E.setHOStep(devHO, hs);
    // 구분이 요구사항·이슈면 그쪽으로 저장 (업무 화면에서는 같은 한 줄로 보임)
    const kind = v.kind; delete v.kind;
    v.kind = kind === "req" ? "req" : undefined;   // 구분: 업무 / 요구사항 (같은 업무, 표시만 다름)
    if (!id && kind === "recur") {   // 정기 업무로 저장 (정기 업무 창과 같은 값)
      const r = { id: E.uid("r"), title: v.title, projectId: v.projectId, freq: v.freq || "weekly", recipient: v.recipient || "", path: v.link || "", memo: v.memo || "", history: [], lastDone: "" };
      r.day = r.freq === "monthly" ? Math.max(1, Math.min(31, Number(v.mday) || 1)) : Number(v.wday) || 0;
      r.nextDue = v.nextDue || E.recurFirst(r); S.recurring.push(r); E.commit(); E.toast("정기 업무 추가했어"); return;
    }
    ["freq", "wday", "mday", "nextDue", "recipient"].forEach((k) => delete v[k]);
    // 이슈로도 등록: 이슈를 만들고 이 업무와 연결 (이슈에서 업무 단계·완료가 보이고, 업무에는 출처 이슈)
    const issueR = !id && v._issue ? E.workAddIssue(v) : null;
    if (issueR) { v.riskId = issueR.id; E.logTask(issueR, "comment", "업무 추가하면서 이슈로 등록"); }
    delete v._issue;
    v.updatedAt = new Date().toISOString();
    const pend = tlText.trim();
    if (id) {
      const prev = x.status, chg = [["owner", "담당"], ["due", "마감"], ["link", "링크"], ["stage", "단계"]].filter(([k]) => k in v && (x[k] || "") !== (v[k] || "")).map(([k, l]) => `${l}: ${x[k] || "없음"} → ${v[k] || "없음"}`);
      if (chg.length) E.logTask(x, "status", chg.join(" · "));
      Object.assign(x, v); E.markDone(x, prev); if (prev !== x.status) E.logTask(x, "status", `${prev} → ${x.status}`); if (pend) E.logTask(x, "comment", pend, tlAt || E.today(), tlExtra());
    } else { const n = Object.assign({ id: E.uid("t") }, v); E.markDone(n, ""); if (pend) E.logTask(n, "comment", pend, tlAt || E.today(), tlExtra()); S.tasks.push(n); }
    if (issueR) issueR.taskId = (S.tasks.find((t) => t.riskId === issueR.id) || {}).id || "";
    E.commit();
  };
  const save = () => form.submit(onSave);
  // 오프라인판 formSaveThen: 저장해서 창이 닫혔으면 다음 동작
  const saveThen = (fn) => { if (save()) fn(); };

  const toggleLogPane = () => { S.ui.logFold = S.ui.logFold ? 0 : 1; E.persistUI(); bump(); };
  const addTaskLog = () => {
    const text = tlText.trim(); if (!text) { E.toast("내용을 적어줘"); return; }
    E.logTask(x, "comment", text, tlAt || E.today(), tlExtra()); x.updatedAt = new Date().toISOString(); E.persist();
    setTlText(""); setTlLink(""); setEditing(null); bump(); E.toast("기록했어");
  };
  const delTaskLog = (lid) => { x.log = (x.log || []).filter((e) => e.id !== lid); E.persist(); setEditing(null); bump(); };
  const saveTaskLog = (lid, at, text) => {
    const e = (x.log || []).find((z) => z.id === lid); if (!e) return;
    const tx = text.trim(); if (!tx) { E.toast("내용을 적어줘"); return; }
    e.text = tx; e.at = at || e.at; x.updatedAt = new Date().toISOString(); E.persist();
    setEditing(null); bump(); E.toast("수정했어");
  };

  const risk = x.riskId && S.risks.find((r) => r.id === x.riskId);
  const dated = id ? E.memoDated(x.memo).length : 0;
  const side = fields.filter((f) => f.side);
  const buttons = (back ? [{ l: "← WBS로", cls: "left", fn: E.closeModal }] : []).concat(id ? [{ l: "삭제", cls: "danger left", fn: () => { if (confirm("업무를 삭제할까?")) { S.tasks = S.tasks.filter((t) => t.id !== id); E.commit(); E.closeModal(); E.toast("삭제했어", true); } } }] : [])
    .concat([{ l: "취소", close: true }, { l: "저장", cls: "primary", fn: save }]);

  return (
    <Modal title={id ? "업무" : "업무 추가"} wide buttons={buttons} bodyRef={bodyRef}>
      <div className={`form-split log-split three ${S.ui.logFold ? "folded" : ""}`} id="fForm">
        <div className="fs-main">
          <div className="form">{fields.filter((f) => !f.side).map((f) => form.cell(f))}</div>
          <div className="log-in">
            {risk ? <div className="small mt-3">출처 이슈: <a href="#" onClick={(e) => { e.preventDefault(); E.closeModal(); E.editRisk(risk.id); }}>{risk.code} {risk.title}</a> <Raw html={E.devImpactBadge(risk)} /></div> : null}
            {fromNote ? <div className="small mt-3">출처 회의록: <a href="#" onClick={(e) => { e.preventDefault(); E.closeModal(); S.ui.pid = fromNote.projectId; S.ui.noteId = fromNote.id; E.selTab("notes"); }}>{fromNote.title || fromNote.date}</a></div> : null}
            <div className="sec-t log-h">진행 기록{id ? <>
              <button className="btn sm" onClick={toggleLogPane} title="오른쪽 기록 접기/펴기">{S.ui.logFold ? "기록 펴기" : "기록 접기"}</button>
              <button className="btn sm" onClick={addTaskLog} title="적은 내용을 기록에 추가">+ 추가</button>
              <button className="btn primary sm" onClick={() => saveThen(() => E.flowNext(x.id))} title="저장하고 다음 단계로">{E.flowNextLabel(x)}</button>
            </> : null}</div>
            <div className="evform tlform">
              <input type="date" id="tlAt" value={tlAt} onChange={(e) => setTlAt(e.target.value)} />
              <input type="text" id="tlTo" placeholder="누구에게" value={tlTo} onChange={(e) => setTlTo(e.target.value)} />
              <input type="text" id="tlLink" placeholder="메일 제목·링크" value={tlLink} onChange={(e) => setTlLink(e.target.value)} />
              <textarea id="tlText" placeholder="예: 자료 요청 메일 보냄, 금요일 회신 예정" value={tlText} onChange={(e) => setTlText(e.target.value)} />
            </div>
            {dated ? <div className="small muted -mt-1.5 mb-2">메모에 날짜별 진행사항이 {dated}줄 있어. <a href="#" onClick={(e) => { e.preventDefault(); saveThen(() => E.splitMemoToLog(x.id)); }}>진행 기록으로 옮기기</a></div> : null}
          </div>
        </div>
        <div className="fs-mid">{side.map((f) => form.cell(f, true))}</div>
        <div className="fs-side log-side">
          <div className="sec-t">기록</div>
          {id ? <ul className="tl" id="taskLog"><TaskLog x={x} editing={editing} setEditing={setEditing} onDel={delTaskLog} onSave={saveTaskLog} /></ul> : <div className="muted small">저장하면 여기에 쌓여</div>}
        </div>
      </div>
    </Modal>
  );
}

// 오프라인판 taskLogHtml + editTaskLog(그 자리에서 고치기)
function TaskLog({ x, editing, setEditing, onDel, onSave }) {
  const l = [...(x.log || [])].sort((a, b) => (b.at + (b.ts || "")).localeCompare(a.at + (a.ts || "")));
  if (!l.length) return <li><div className="x muted">아직 기록이 없어</div></li>;
  const lk = (u) => (/^https?:\/\//i.test(u) ? <a href={u} target="_blank" rel="noopener">{u}</a> : <span className="link" onClick={() => E.copyText(u, "복사됨")} title="눌러서 복사">{u}</span>);
  return l.map((e) => (
    <li key={e.id} className={e.type === "status" ? "mine" : "resp"} data-lid={e.id}>
      {editing === e.id ? <LogEdit e={e} onSave={(at, tx) => onSave(e.id, at, tx)} onCancel={() => setEditing(null)} /> : <>
        <div className="h"><b>{e.type === "status" ? "변경" : "기록"}</b> · {e.at} ({E.wd(e.at)}){e.to ? <> · → <b>{e.to}</b></> : null}
          <span className="log-act">
            <button className="ico-btn" onClick={() => setEditing(e.id)} title="수정" aria-label="수정" dangerouslySetInnerHTML={{ __html: E.ICO_EDIT }} />
            <button className="ico-btn del" onClick={() => onDel(e.id)} title="삭제" aria-label="삭제" dangerouslySetInnerHTML={{ __html: E.ICO_DEL }} />
          </span></div>
        <div className="x">{e.text}</div>{e.link ? <div className="small">{lk(e.link)}</div> : null}
      </>}
    </li>
  ));
}
function LogEdit({ e, onSave, onCancel }) {
  const [at, setAt] = useState(e.at || ""), [tx, setTx] = useState(e.text || "");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="log-edit"><input type="date" value={at} className="le-at" onChange={(ev) => setAt(ev.target.value)} /><textarea className="le-tx" ref={ref} value={tx} onChange={(ev) => setTx(ev.target.value)} />
      <div><button className="btn sm primary" onClick={() => onSave(at, tx)}>저장</button> <button className="btn sm" onClick={onCancel}>취소</button></div></div>
  );
}

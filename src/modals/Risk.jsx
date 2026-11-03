import { useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { useForm, isWide, formButtons, Run } from "./kit/form.jsx";

// 이슈 (오프라인판 editRisk — 진행 기록 칸은 taskLogHtml/addTaskLog/editTaskLog/saveTaskLog/delTaskLog/toggleLogPane 를 React 상태로)
export const opens = ["editRisk"];
export const samples = (S) => [
  ["editRisk", S.risks[0]?.id],
  ["editRisk", S.risks.find((r) => (r.log || []).length)?.id],
  ["editRisk", S.risks.find((r) => E.riskTask(r))?.id],
  ["editRisk", S.risks.find((r) => r.wbsId)?.id],
  ["editRisk"],
  ["editRisk", null, { type: "이슈", impact: "M", prob: "H", projectId: S.projects[0]?.id, srcRef: "task:x", title: "업무 지연: 시험", desc: "10/20 예정이던 업무 항목이 3일 지났어" }],
];

const Ico = ({ html, ...rest }) => <button {...rest} dangerouslySetInnerHTML={{ __html: html }} />;

// 오프라인판 taskLogHtml (+ 그 자리에서 고치는 editTaskLog/saveTaskLog)
function LogList({ x, bump }) {
  const [edit, setEdit] = useState(null);   // { lid, at, text }
  const l = [...(x.log || [])].sort((a, b) => (b.at + (b.ts || "")).localeCompare(a.at + (a.ts || "")));
  const lk = (u) => /^https?:\/\//i.test(u) ? <a href={u} target="_blank" rel="noopener">{u}</a> : <span className="link" onClick={() => E.copyText(u, "복사됨")} title="눌러서 복사">{u}</span>;
  const save = (e) => {
    const tx = edit.text.trim(); if (!tx) { E.toast("내용을 적어줘"); return; }
    e.text = tx; e.at = edit.at || e.at; x.updatedAt = new Date().toISOString(); E.persist();
    setEdit(null); bump(); E.toast("수정했어");
  };
  const del = (lid) => { x.log = (x.log || []).filter((e) => e.id !== lid); E.persist(); bump(); };
  if (!l.length) return <ul className="tl" id="taskLog"><li><div className="x muted">아직 기록이 없어</div></li></ul>;
  return (
    <ul className="tl" id="taskLog">
      {l.map((e) => edit?.lid === e.id ? (
        <li key={e.id} className={e.type === "status" ? "mine" : "resp"} data-lid={e.id}>
          <div className="log-edit">
            <input type="date" value={edit.at} className="le-at" onChange={(ev) => setEdit({ ...edit, at: ev.target.value })} />
            <textarea className="le-tx" autoFocus value={edit.text} onChange={(ev) => setEdit({ ...edit, text: ev.target.value })} />
            <div><button className="btn sm primary" onClick={() => save(e)}>저장</button> <button className="btn sm" onClick={() => setEdit(null)}>취소</button></div>
          </div>
        </li>
      ) : (
        <li key={e.id} className={e.type === "status" ? "mine" : "resp"} data-lid={e.id}>
          <div className="h"><b>{e.type === "status" ? "변경" : "기록"}</b> · {e.at} ({E.wd(e.at)}){e.to ? <> · → <b>{e.to}</b></> : null}
            {" "}<span className="log-act">
              <Ico className="ico-btn" html={E.ICO_EDIT} onClick={() => setEdit({ lid: e.id, at: e.at, text: e.text })} title="수정" aria-label="수정" />
              <Ico className="ico-btn del" html={E.ICO_DEL} onClick={() => del(e.id)} title="삭제" aria-label="삭제" />
            </span>
          </div>
          <div className="x">{e.text}</div>
          {e.link ? <div className="small">{lk(e.link)}</div> : null}
        </li>
      ))}
    </ul>
  );
}

function RiskForm({ id, preset }) {
  const { S } = useStore();
  const [r] = useState(() => id ? S.risks.find((x) => x.id === id) : Object.assign({ type: "이슈", status: "오픈", level: "중", raisedAt: E.today(), projectId: S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0].id }, preset || {}));
  const [fold, setFold] = useState(!!S.ui.logFold);
  const [, setVer] = useState(0);
  const bump = () => setVer((n) => n + 1);
  // 진행 기록 입력칸 (tlAt · tlTo · tlLink · tlText)
  const [tl, setTl] = useState(() => ({ at: E.today(), to: "", link: "", text: "" }));
  const setT = (k) => (e) => setTl((o) => ({ ...o, [k]: e.target.value }));
  const tlExtra = () => { const to = tl.to.trim(), link = tl.link.trim(); return Object.assign({}, to ? { to } : {}, link ? { link } : {}); };

  const toggleLogPane = () => { S.ui.logFold = S.ui.logFold ? 0 : 1; E.persistUI(); setFold(!!S.ui.logFold); };
  const addLog = () => {
    const text = tl.text.trim(); if (!text) { E.toast("내용을 적어줘"); return; }
    E.logTask(r, "comment", text, tl.at || E.today(), tlExtra()); r.updatedAt = new Date().toISOString(); E.persist();
    setTl((o) => ({ ...o, text: "", link: "" })); E.toast("기록했어");
  };

  const rt = id && E.riskTask(r), st = rt && E.riskTaskState(r);
  const fields = [
    ...(id ? [{ k: "_code", l: "번호", t: "ro", v: r.code }] : []),
    { k: "title", l: "제목", t: "text", full: true, req: true },
    { k: "projectId", l: "프로젝트", t: "select", opts: E.activeProjects().map((p) => [p.id, p.name]) },
    { k: "status", l: "상태", t: "select", opts: E.RISK_ST },
    { k: "level", l: "중요도", t: "select", opts: E.RISK_LV },
    { k: "wbsId", l: "관련 WBS (메뉴·페이지)", t: "select", opts: [["", "-"], ...E.wbsSelectOpts(r.projectId)] },
    { k: "owner", l: "담당", t: "text" },
    { k: "due", l: "대응 기한", t: "date" },
    { k: "raisedAt", l: "등록일", t: "date" },
    ...(rt ? [{ k: "_task", l: "연결 업무", t: "html", full: true, html: (
      <>
        <span className="chip-ref" style={{ cursor: "pointer", ...(st.done ? { color: "var(--ok)", borderColor: "var(--ok)" } : {}) }}
          onClick={(e) => { e.stopPropagation(); closeModal(); E.editTask(st.t.id); }}>업무 · {st.stage}</span>
        {" "}<span className="small">{rt.title}</span>
      </>
    ) }] : []),
    { k: "desc", l: "내용 / 원인", t: "textarea", side: true },
    { k: "plan", l: "대응 방안", t: "textarea", side: true },
  ];
  const form = useForm(fields, r, (v) => {
    if (v.status === "완료" && r.status !== "완료") v.closedAt = E.today();
    if (id && r.status !== v.status) E.logTask(r, "status", `${r.status} → ${v.status}`);
    if (id && (r.level || "중") !== v.level) E.logTask(r, "status", `중요도: ${r.level || "중"} → ${v.level}`);
    const pend = tl.text.trim();
    let o = r;
    if (id) Object.assign(r, v); else { o = Object.assign({ id: E.uid("ri"), code: E.nextRiskCode(), log: [] }, r.srcRef ? { srcRef: r.srcRef } : {}, v); S.risks.push(o); }
    if (pend) E.logTask(o, "comment", pend, tl.at || E.today(), tlExtra());
    E.commit();
  });
  const extraBtns = id ? [
    { l: "삭제", cls: "danger left", fn: () => { if (confirm("삭제할까?")) { S.risks = S.risks.filter((x) => x.id !== id); E.commit(); closeModal(); E.toast("삭제했어", true); } } },
    // 오프라인판 formSaveThen: 먼저 저장해서 창이 닫혔을 때만 다음 동작
    ...(E.riskTask(r) ? [] : [{ l: "업무로 넘기기 →", cls: "left", fn: () => { if (form.save()) E.riskToTask(id); } }]),
  ] : [];

  const side = fields.filter((f) => f.side);
  return (
    <Modal title={id ? "이슈" : "이슈 등록"} wide={isWide(fields)} buttons={formButtons(extraBtns, form.save)}>
      <div className={`form-split log-split three ${fold ? "folded" : ""}`} id="fForm" ref={form.formRef}>
        <div className="fs-main">
          <div className="form">{fields.filter((f) => !f.side).map(form.cell)}</div>
          <div className="log-in">
            <div className="sec-t log-h">진행 기록{id ? <><button className="btn sm" onClick={toggleLogPane}>{fold ? "기록 펴기" : "기록 접기"}</button><button className="btn sm" onClick={addLog}>+ 추가</button></> : null}</div>
            <div className="evform tlform">
              <input type="date" id="tlAt" value={tl.at} onChange={setT("at")} />
              <input type="text" id="tlTo" placeholder="누구에게" value={tl.to} onChange={setT("to")} />
              <input type="text" id="tlLink" placeholder="메일 제목·링크" value={tl.link} onChange={setT("link")} />
              <textarea id="tlText" value={tl.text} onChange={setT("text")} />
            </div>
          </div>
        </div>
        <div className="fs-mid">{side.map((f) => form.cell({ ...f, full: true }))}</div>
        <div className="fs-side log-side">
          <div className="sec-t">기록</div>
          {id ? <LogList x={r} bump={bump} /> : <div className="muted small">저장하면 여기에 쌓여</div>}
        </div>
      </div>
    </Modal>
  );
}

export default function RiskModal({ args: [id, preset] }) {
  if (!E.activeProjects().length) return <Run fn={() => E.toast("프로젝트를 먼저 만들어줘")} />;
  return <RiskForm id={id} preset={preset} />;
}

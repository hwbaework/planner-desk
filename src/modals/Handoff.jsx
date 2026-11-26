import { useEffect, useRef, useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { Badge, ChangeInput, Raw, IconBtn } from "../components/ui.jsx";
import { FormModal } from "./_formFields.jsx";

// 개발 전달 상세(openHO) · 등록/편집(editHO)
export const opens = ["openHO", "editHO"];
export const samples = (S) => {
  const pid = S.projects[0]?.id;
  const busy = S.handoffs.find((h) => h.events.length > 2 && (h.docIds.length || h.screenIds.length)) || S.handoffs.find((h) => h.events.length > 2);
  const linked = S.handoffs.find((h) => (h.reqIds || []).length || h.taskId);
  const withLink = S.handoffs.find((h) => h.link || h.cc || h.toEmail);
  return [
    ["openHO", S.handoffs[0]?.id], ["openHO", busy?.id], ["openHO", linked?.id], ["openHO", withLink?.id],
    ["openHO", S.handoffs[0]?.id, "ack"], ["openHO", S.handoffs[S.handoffs.length - 1]?.id, "reject"],
    ["editHO", S.handoffs[0]?.id], ["editHO", busy?.id],
    ["editHO", null, { projectId: pid }],
    ["editHO", null, { screenIds: S.screens.filter((s) => s.projectId === pid).slice(0, 1).map((s) => s.id), projectId: pid, title: "화면 개발 전달" }],
    ["editHO"],
  ];
};

export default function Handoff({ args, name }) {
  return name === "editHO" ? <EditHO args={args} /> : <OpenHO args={args} />;
}

// ── editHO ──
function EditHO({ args: [id, preset] }) {
  const { S } = useStore();
  const [x] = useState(() => (id ? S.handoffs.find((h) => h.id === id) : Object.assign({ docIds: [], screenIds: [] }, preset || {})));
  const noProj = !E.activeProjects().length;
  useEffect(() => { if (noProj) { E.toast("프로젝트를 먼저 만들어줘"); closeModal(); } }, []);
  if (noProj || !x) return null;
  const onSave = (v) => {
    if (id) { Object.assign(x, v); E.relinkScreens(); }
    else {
      const tk0 = x.taskId && S.tasks.find((t) => t.id === x.taskId);
      const h = Object.assign({ id: E.uid("h"), code: tk0?.code || E.nextHOCode(v.projectId), status: "sent", events: [] }, x.taskId ? { taskId: x.taskId } : {}, v);
      if (x.taskId) { const tk = S.tasks.find((t) => t.id === x.taskId); if (tk) { tk.hoId = h.id; tk.updatedAt = new Date().toISOString(); E.logTask(tk, "comment", `개발로 전달 — ${h.code}`); } }
      h.events.push({ id: E.uid("e"), at: h.sentAt || E.today(), ts: new Date().toISOString(), type: "sent", text: "기획 전달" + (h.to ? ` → ${h.to}` : "") });
      S.handoffs.push(h);
      h.screenIds.forEach((sid) => { const s = S.screens.find((z) => z.id === sid); if (s) { s.hoId = h.id; s.lastSentVer = s.version || ""; s.lastSentAt = new Date().toISOString(); } });
      setTimeout(() => E.openHO(h.id), 0);
    }
    E.commit();
  };
  const del = { l: "삭제", cls: "danger left", fn: () => { if (confirm("이 전달 건을 삭제할까?")) { S.handoffs = S.handoffs.filter((h) => h.id !== id); E.relinkScreens(); E.commit(); closeModal(); E.toast("삭제했어", true); } } };
  return <FormModal title={id ? `전달 건 편집 · ${x.code}` : "개발 전달 등록"} fields={E.hoFields(x)} obj={x} onSave={onSave} extraBtns={id ? [del] : []} />;
}

// ── openHO ──
const QUICK = [["question", "질의 받음"], ["answer", "답변함"], ["progress", "진행 공유 받음"], ["done", "개발 완료 → 테스트"], ["verified", "테스트 완료"], ["reject", "반려/재작업"], ["nudge", "독촉함"], ["note", "메모"]];
const defTypeOf = (st) => ({ sent: "ack", ack: "progress", dev: "done", done: "verified" })[st] || "note";

// 오프라인판 reqChips
function ReqChips({ ids }) {
  const { S } = useStore();
  return (ids || []).map((rid) => S.reqs.find((r) => r.id === rid)).filter(Boolean).map((r) => (
    <span key={r.id}>{" "}<span className="chip-ref" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); E.editReq(r.id); }} title={r.title}>{r.code}</span></span>
  ));
}
// 오프라인판 flowOrigin
function FlowOrigin({ h }) {
  const { S } = useStore();
  const t = E.taskOfHO(h), d = E.dataOfTask(t);
  const hasReq = (h.reqIds || []).some((rid) => S.reqs.some((r) => r.id === rid));
  if (!t && !d) return hasReq ? <><div className="l">요구사항</div><div><ReqChips ids={h.reqIds} /></div></> : null;
  return (
    <>
      <div className="l">흐름</div>
      <div>
        {d ? <><span className="link" onClick={() => E.openData(d.id)}>협의: {d.name}</span> → </> : null}
        {t ? <><span className="link" onClick={() => E.editTask(t.id)}>기획: {t.title}</span>{(t.log || []).length ? <> <span className="muted small">기록 {t.log.length}</span></> : null} → </> : null}
        <b>개발</b>
      </div>
    </>
  );
}

const bannerStyle = (a) => (a.level === "mine" ? { background: "var(--accentw)", color: "var(--accent)", borderColor: "var(--accent)" } : a.level === "danger" ? { background: "var(--dangerw)", color: "var(--danger)", borderColor: "var(--danger)" } : undefined);

function OpenHO({ args: [id, presetType] }) {
  const { S } = useStore();
  const x = S.handoffs.find((h) => h.id === id);
  // 진행 기록 입력칸 (오프라인판은 기록·상태 변경 뒤 창을 다시 열어 입력칸을 처음 상태로 돌림)
  const blank = (type) => ({ type, at: E.today(), text: "" });
  const [ev, setEv] = useState(() => blank(presetType || defTypeOf(x?.status)));
  const reset = () => setEv(blank(defTypeOf(x.status)));
  const textRef = useRef(null);
  useEffect(() => { if (!x) closeModal(); else if (presetType) { const t = setTimeout(() => textRef.current?.focus(), 30); return () => clearTimeout(t); } }, []);
  if (!x) return null;

  const refsDocs = x.docIds.map((i) => S.docs.find((d) => d.id === i)).filter(Boolean);
  const refsScs = x.screenIds.map((i) => S.screens.find((s) => s.id === i)).filter(Boolean);
  const lr = E.lastEvent(x, E.RESP_EV);
  const al = E.computeAlerts(x.projectId).filter((a) => a.ref[1] === x.id);
  const evs = [...x.events].sort((a, b) => (b.at + (b.ts || "")).localeCompare(a.at + (a.ts || "")));

  const addEvent = () => {
    const type = ev.type, at = ev.at || E.today(), text = ev.text.trim();
    E.pushEvent(x, { type, at, text });
    E.commit(); reset(); E.toast(`${E.evLabel(type)} 기록됨`);
  };
  const delEvent = (eid) => { if (!confirm("이 기록을 지울까?")) return; x.events = x.events.filter((e) => e.id !== eid); E.recomputeHOStatus(x); E.commit(); reset(); };
  const setStatus = (st) => { E.setHOStatus(x.id, st, false); reset(); };

  return (
    <Modal title={`[${x.code}] ${x.title}`} wide buttons={[
      { l: "편집", cls: "left", fn: () => E.editHO(x.id) },
      { l: "독촉 문구 복사", fn: () => E.copyNudge(x.id) },
      { l: "독촉 메일", fn: () => E.mailNudge(x.id) },
      { l: "전달 메일 작성", fn: () => E.mailSend(x.id) },
      { l: "닫기", cls: "primary", close: true, fn: closeModal },
    ]}>
      <div className="form-split">
        <div className="fs-main">
          {al.map((a, i) => <div key={i} className="banner" style={bannerStyle(a)}><b>{a.kind}</b> {a.desc}</div>)}
          <div className="info">
            <div className="l">상태</div>
            <div>
              <Badge cls={E.HO_CLS[x.status]}>{E.hoStLabel(x.status)}</Badge>{" "}
              <select className="inline" value={E.hoSimple(x.status)} onChange={(e) => setStatus(e.target.value)}>
                {E.HO_SIMPLE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div className="l">프로젝트</div><div>{E.projName(x.projectId)}</div>
            <FlowOrigin h={x} />
            <div className="l">수신</div>
            <div>{x.to || "-"} {x.toEmail ? <span className="muted">&lt;{x.toEmail}&gt;</span> : null}{x.cc ? <div className="small muted">CC {x.cc}</div> : null}</div>
            <div className="l">전달 / 완료예정</div>
            <div>{x.sentAt || "-"} → {x.dueDate ? <>{x.dueDate} <b>{E.dday(x.dueDate)}</b></> : "미정"}</div>
            <div className="l">마지막 응답</div>
            <div>{lr ? `${lr.at} · ${E.evLabel(lr.type)} (${E.calDays(lr.at)}일 전)` : <><span style={{ color: "var(--danger)" }}>아직 없음</span> · 전달 후 영업일 {E.bizDays(x.sentAt)}일</>}</div>
            {refsDocs.length || refsScs.length ? <>
              <div className="l">연결</div>
              <div>
                {refsDocs.map((d) => <span key={d.id} className="chip-ref" style={{ cursor: "pointer" }} onClick={() => E.editDoc(d.id)}>문서 {d.name} {d.version || ""}</span>)}
                {refsScs.map((s) => <span key={s.id} className="chip-ref">화면 {s.code} {s.name}</span>)}
              </div>
            </> : null}
            {x.link ? <>
              <div className="l">문서</div>
              <div className="mono small" style={{ wordBreak: "break-all" }}>{x.link} <IconBtn icon="copy" title="복사" onClick={() => E.copyText(x.link)} /></div>
            </> : null}
          </div>
          <div className="quick">
            {QUICK.map(([k, l]) => <button key={k} className="btn sm" onClick={() => { setEv((o) => ({ ...o, type: k })); textRef.current?.focus(); }}>{l}</button>)}
          </div>
          <div className="evform">
            <select id="evType" value={ev.type} onChange={(e) => setEv((o) => ({ ...o, type: e.target.value }))}>
              {E.EV_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input type="date" id="evAt" value={ev.at} onChange={(e) => setEv((o) => ({ ...o, at: e.target.value }))} />
            <textarea id="evText" ref={textRef} placeholder="내용 (예: 10/20 완료 예정이라고 함)" value={ev.text} onChange={(e) => setEv((o) => ({ ...o, text: e.target.value }))} />
            <button className="btn primary" onClick={addEvent}>기록</button>
          </div>
          <div className="sec-t">진행 기록</div>
          <ul className="tl">
            {evs.map((e) => (
              <li key={e.id} className={E.RESP_EV.includes(e.type) ? "resp" : e.type === "reject" ? "bad" : "mine"}>
                <div className="h"><b>{E.evLabel(e.type)}</b> · {e.at} ({E.wd(e.at)}){" "}
                  <button className="ico-btn del" onClick={() => delEvent(e.id)} title="삭제" aria-label="삭제"><Raw html={E.ICO_DEL} style={{ display: "contents" }} /></button>
                </div>
                {e.text ? <div className="x">{e.text}</div> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="fs-side">
          <div><label>전달 내용 / 요청사항</label><ChangeInput as="textarea" placeholder="메모" value={x.memo || ""} onCommit={(v) => E.setMemo("handoffs", x.id, v)} /></div>
        </div>
      </div>
    </Modal>
  );
}

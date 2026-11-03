import { useEffect, useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { Badge, ChangeInput, Raw } from "../components/ui.jsx";
import { FormModal } from "./_formFields.jsx";

// 데이터 협의: 등록/편집(editData) · 상세(openData) · 붙여넣기(bulkData)
export const opens = ["editData", "openData", "bulkData"];
export const samples = (S) => {
  const pid = S.projects[0]?.id;
  // 비교용: 데이터 항목이 하나도 없으면 상세 창을 열 수 없으니 시험 항목을 하나 둔다 (저장하지 않음 — smoke 에서만 불림)
  if (!S.datas.length && pid) {
    const note = S.notes.find((n) => n.projectId === pid);
    S.datas.push({ id: "da_sample", projectId: pid, org: "참여기관 A", name: "태양광 발전량", contact: "홍길동 대리", method: "API", cycle: "15분", status: "합의",
      requestedAt: "2026-09-01", agreedAt: "2026-09-10", dueDate: "2026-10-01", lastReceivedAt: "", usage: "상황실 대시보드", spec: "일시, 발전량(kWh)\nCSV", memo: "메모 예시",
      log: [{ id: "l1", at: "2026-09-10", ts: "2026-09-10T01:00:00.000Z", type: "회의", text: "합의", noteId: note?.id || "" }, { id: "l2", at: "2026-09-12", ts: "", type: "수신", text: "" }] });
  }
  const busy = S.datas.find((d) => d.log.length > 1);
  const noted = S.datas.find((d) => d.log.some((l) => l.noteId));
  const late = S.datas.find((d) => d.dueDate && ["합의", "수신 중"].includes(d.status));
  return [
    ["openData", S.datas[0]?.id], ["openData", busy?.id], ["openData", noted?.id], ["openData", late?.id], ["openData", S.datas[S.datas.length - 1]?.id],
    ["editData", S.datas[0]?.id], ["editData", busy?.id],
    ["editData"], ["editData", null, { status: "협의 중", projectId: pid }],
    ["bulkData"],
  ];
};

export default function Data({ args, name }) {
  if (name === "openData") return <OpenData args={args} />;
  if (name === "bulkData") return <BulkData />;
  return <EditData args={args} />;
}

// 오프라인판 projTag
const ProjTag = ({ id }) => <span className="ptag"><i style={{ background: E.projColor(id) }}></i>{E.projName(id)}</span>;

// ── editData ──
function EditData({ args: [id, preset] }) {
  const { S } = useStore();
  const noProj = !E.activeProjects().length;
  const [x] = useState(() => (noProj ? null : id ? S.datas.find((d) => d.id === id)
    : Object.assign({ status: "협의 전", method: "미정", cycle: "미정", requestedAt: E.today(), projectId: S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0].id, org: S.ui.dataOrg || "" }, preset || {})));
  useEffect(() => { if (noProj) { E.toast("프로젝트를 먼저 만들어줘"); closeModal(); } else if (!x) closeModal(); }, []);
  if (!x) return null;
  const onSave = (v) => {
    if (id) Object.assign(x, v);
    else { const n = Object.assign({ id: E.uid("da"), log: [] }, v); S.datas.push(n); setTimeout(() => E.openData(n.id), 0); }
    E.commit();
  };
  const del = { l: "삭제", cls: "danger left", fn: () => { if (confirm("데이터 항목을 삭제할까?")) { S.datas = S.datas.filter((d) => d.id !== id); E.commit(); closeModal(); E.toast("삭제했어", true); } } };
  return <FormModal title={id ? "데이터 항목 편집" : "데이터 항목 추가"} fields={E.dataFields(x)} obj={x} onSave={onSave} extraBtns={id ? [del] : []} />;
}

// ── openData ──
function OpenData({ args: [id] }) {
  const { S } = useStore();
  const x = S.datas.find((d) => d.id === id);
  // 진행 기록 입력칸 (오프라인판은 기록·상태 변경 뒤 창을 다시 열어 처음 상태로 돌림)
  const blank = () => ({ type: E.DATA_LOG[0], at: E.today(), text: "", noteId: "" });
  const [lg, setLg] = useState(blank);
  const reset = () => setLg(blank());
  useEffect(() => { if (!x) closeModal(); }, []);
  if (!x) return null;

  const notes = S.notes.filter((n) => n.projectId === x.projectId).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const logs = [...x.log].sort((a, b) => (b.at + (b.ts || "")).localeCompare(a.at + (a.ts || "")));
  const al = E.computeAlerts(x.projectId).filter((a) => a.ref[1] === x.id);

  const addLog = () => {
    const type = lg.type, at = lg.at || E.today(), text = lg.text.trim(), noteId = notes.length ? lg.noteId : "";
    if (!text && !noteId) { E.toast("내용을 적어줘"); return; }
    x.log.push({ id: E.uid("l"), at, ts: new Date().toISOString(), type, text, noteId });
    if (type === "수신" && (!x.lastReceivedAt || at > x.lastReceivedAt)) x.lastReceivedAt = at;
    if (x.status === "협의 전" && ["회의", "메일", "전화", "공문"].includes(type)) x.status = "협의 중";
    E.commit(); reset(); E.toast("진행 기록 추가");
  };
  const delLog = (lid) => { if (!confirm("이 기록을 지울까?")) return; x.log = x.log.filter((l) => l.id !== lid); E.commit(); reset(); };
  const received = () => {
    x.lastReceivedAt = E.today(); if (["합의", "협의 중", "협의 전"].includes(x.status)) x.status = "수신 중";
    x.log.push({ id: E.uid("l"), at: E.today(), ts: new Date().toISOString(), type: "수신", text: "데이터 수신 확인" }); E.commit(); reset();
  };

  return (
    <Modal title={`${x.org ? x.org + " · " : ""}${x.name}`} wide buttons={[
      { l: "편집", cls: "left", fn: () => E.editData(x.id) },
      ...(x.taskId && S.tasks.some((t) => t.id === x.taskId) ? [] : [{ l: `${E.flowSteps()[1]} →`, cls: "left", fn: () => { closeModal(); E.dataToPlan(x.id); } }]),
      { l: "수신 확인", fn: received },
      { l: "닫기", cls: "primary", close: true, fn: closeModal },
    ]}>
      <div className="form-split">
        <div className="fs-main">
          {al.map((a, i) => <div key={i} className="banner" style={a.level === "danger" ? { background: "var(--dangerw)", color: "var(--danger)", borderColor: "var(--danger)" } : undefined}><b>{a.kind}</b> {a.desc}</div>)}
          <div className="info">
            <div className="l">상태</div>
            <div>
              <Badge cls={E.DATA_CLS[x.status] || "gray"}>{x.status}</Badge>{" "}
              <select className="inline" value={x.status} onChange={(e) => { E.setData(x.id, "status", e.target.value); reset(); }}>
                {E.DATA_ST.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="l">프로젝트</div><div><ProjTag id={x.projectId} /></div>
            <div className="l">제공 기관</div><div><b>{x.org || "-"}</b> {x.contact ? <span className="muted">· {x.contact}</span> : null}</div>
            <div className="l">방식 · 주기</div><div>{x.method || "-"} · {x.cycle || "-"}</div>
            <div className="l">요청 → 합의</div><div>{x.requestedAt || "-"} → {x.agreedAt || "미합의"}</div>
            <div className="l">수신</div>
            <div>예정 {x.dueDate ? <>{x.dueDate} <b>{x.status !== "수신 완료" ? E.dday(x.dueDate) : ""}</b></> : "미정"} · 최근 수신 {x.lastReceivedAt || "없음"}</div>
            {x.usage ? <><div className="l">활용처</div><div>{x.usage}</div></> : null}
            {x.spec ? <><div className="l">데이터 명세</div><div style={{ whiteSpace: "pre-wrap" }}>{x.spec}</div></> : null}
          </div>
          <div className="sec-t">진행 기록 ({logs.length})</div>
          <div className="evform">
            <select id="dlType" value={lg.type} onChange={(e) => setLg((o) => ({ ...o, type: e.target.value }))}>
              {E.DATA_LOG.map((k) => <option key={k}>{k}</option>)}
            </select>
            <input type="date" id="dlAt" value={lg.at} onChange={(e) => setLg((o) => ({ ...o, at: e.target.value }))} />
            <textarea id="dlText" placeholder="예: 3차 컨소시엄 회의 — 15분 단위 CSV로 매일 09시 제공 합의" value={lg.text} onChange={(e) => setLg((o) => ({ ...o, text: e.target.value }))} />
            <button className="btn primary" onClick={addLog}>기록</button>
          </div>
          {notes.length ? (
            <div className="evform" style={{ gridTemplateColumns: "1fr auto", marginTop: -6 }}>
              <select id="dlNote" value={lg.noteId} onChange={(e) => setLg((o) => ({ ...o, noteId: e.target.value }))}>
                <option value="">회의록 연결 (선택)</option>
                {notes.map((n) => <option key={n.id} value={n.id}>{n.date || ""} · {n.title || "(제목 없음)"}</option>)}
              </select>
              <span className="small muted" style={{ alignSelf: "center" }}>기록에 회의록을 붙여둘 수 있어</span>
            </div>
          ) : null}
          <ul className="tl">
            {logs.map((e) => {
              const n = e.noteId && S.notes.find((z) => z.id === e.noteId);
              return (
                <li key={e.id} className={e.type === "수신" ? "resp" : e.type === "회의" ? "mine" : ""}>
                  <div className="h"><b>{e.type || "기록"}</b> · {e.at} ({E.wd(e.at)}){" "}
                    <button className="ico-btn del" onClick={() => delLog(e.id)} title="삭제" aria-label="삭제"><Raw html={E.ICO_DEL} style={{ display: "contents" }} /></button>
                  </div>
                  {e.text ? <div className="x">{e.text}</div> : null}
                  {n ? <div className="small"><a href="#" onClick={(ev) => { ev.preventDefault(); closeModal(); S.ui.noteId = n.id; E.selTab("notes"); }}>회의록: {n.title || n.date}</a></div> : null}
                </li>
              );
            })}
            {logs.length ? null : <li><div className="x muted">아직 진행 기록이 없어</div></li>}
          </ul>
        </div>
        <div className="fs-side">
          <div><label>메모 / 이슈</label><ChangeInput as="textarea" placeholder="메모" value={x.memo || ""} onCommit={(v) => E.setMemo("datas", x.id, v)} /></div>
        </div>
      </div>
    </Modal>
  );
}

// ── bulkData ──
function BulkData() {
  const { S } = useStore();
  const [text, setText] = useState("");
  const noProj = !E.activeProjects().length;
  useEffect(() => { if (noProj) { E.toast("프로젝트를 먼저 만들어줘"); closeModal(); } }, []);
  if (noProj) return null;
  const pid = S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0].id;
  const add = () => {
    let n = 0;
    text.split(/\r?\n/).map((l) => l.split("\t").map((c) => c.trim())).filter((r) => r[1]).forEach(([org, name, contact, method, cycle, due]) => {
      S.datas.push({ id: E.uid("da"), projectId: pid, org: org || "", name, contact: contact || "", method: method || "미정", cycle: cycle || "미정", status: "협의 전", requestedAt: E.today(), dueDate: E.normDate(due), log: [] });
      n++;
    });
    E.commit(); closeModal(); E.toast(`${n}개 추가`);
  };
  return (
    <Modal title="데이터 항목 붙여넣기" buttons={[{ l: "취소", close: true, fn: closeModal }, { l: "추가", cls: "primary", fn: add }]}>
      <p className="small muted" style={{ marginBottom: 8 }}>엑셀에서 열 순서대로 복사 (탭 구분): <b>제공 기관 · 데이터 항목 · 담당자 · 제공 방식 · 주기 · 수신 예정일</b>. 뒤쪽 열은 생략 가능. 프로젝트: <b>{E.projName(pid)}</b></p>
      <textarea id="bulkText" style={{ minHeight: 220 }} className="mono" placeholder={"참여기관 A\t태양광 발전량\t홍길동 대리\tAPI\t15분\t2026-11-01"} value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

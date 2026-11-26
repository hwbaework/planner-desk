import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { PageHead, TypeIcon, PriIcon, Raw } from "../components/ui.jsx";

// 오프라인판 renderTasks (업무 · 정기 업무). 업무 창·정기 업무 창·CSV 가져오기는 오프라인판 창 그대로
export const tabs = ["tasks", "ho"];

// ── 오프라인판 도우미 → JSX ──
const ProjTag = ({ id }) => <span className="ptag"><i style={{ background: E.projColor(id) }}></i>{E.projName(id)}</span>;
const CodeTag = ({ c }) => (c ? <span className="code-tag">{c}</span> : null);

function FlowPipe({ i }) {
  return <span className="pipe">{E.flowSteps().map((l, k) => <i key={k} className={k < i ? "past" : k === i ? "on" : ""}>{l}</i>)}</span>;
}

function TaskVia({ x }) {
  if (!x.via && !x.link) return null;
  const isUrl = /^https?:\/\//i.test(x.link || "");
  const ln = x.link
    ? isUrl
      ? <a href={x.link} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} title={x.link} aria-label="링크 열기"><Raw html={E.ICO_LINK} style={{ display: "contents" }} /></a>
      : <span className="link" onClick={(e) => { e.stopPropagation(); E.copyText(x.link, "복사됨"); }} title={"복사: " + x.link} aria-label="링크 복사"><Raw html={E.ICO_LINK} style={{ display: "contents" }} /></span>
    : null;
  return <>{" "}<span className="chip-ref">{x.via || "출처"}{ln ? <>{" · "}{ln}</> : null}</span></>;
}

function ReqChips({ ids }) {
  return (ids || []).map((id) => E.S.reqs.find((r) => r.id === id)).filter(Boolean).map((r) => (
    <span key={r.id}>{" "}<span className="chip-ref cursor-pointer" onClick={(e) => { e.stopPropagation(); E.editReq(r.id); }} title={r.title}>{r.code}</span></span>
  ));
}

function HoTcChip({ h }) {
  const tcs = E.S.tcs.filter((c) => (h.screenIds || []).includes(c.screenId)); if (!tcs.length) return null;
  const n = (r) => tcs.filter((c) => c.result === r).length;
  return <>{" "}<span className="chip-ref" title="연결 화면의 테스트 케이스">TC Pass {n("Pass")}/{tcs.length}{n("Fail") ? ` · Fail ${n("Fail")}` : ""}</span></>;
}

function FlowNextBtn({ kind, x }) {
  const n = E.flowNextName(kind, x); if (!n) return null;
  return <button className="next" onClick={() => E.flowAdvance(kind, x.id)}>{n === "개발" ? "개발로 전달" : n} →</button>;
}

// workItems의 next (다음 단계 버튼)
function WorkNext({ w }) {
  const x = w.x;
  if (w.kind === "req") return x.status === "확정"
    ? <button className="next" onClick={() => E.reqToDev(x.id)}>개발로 전달 →</button>
    : <button className="next" onClick={() => E.setReq(x.id, "status", "확정")}>기획 →</button>;
  if (w.kind === "task") return x.stage ? <FlowNextBtn kind="task" x={x} /> : null;
  if (w.kind === "ho") return E.isOpenHO(x) ? <FlowNextBtn kind="ho" x={x} /> : null;
  if (w.kind === "data") return <button className="next" onClick={() => E.dataToPlan(x.id)}>{E.flowSteps()[1]} →</button>;
  return null;
}

// workItems의 stSel (상태 고르기)
function WorkStSel({ w }) {
  const x = w.x;
  if (w.kind === "req") return (
    <select className="inline" value={x.status} onChange={(e) => E.setReq(x.id, "status", e.target.value)}>
      {E.REQ_ST.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
  if (w.kind === "task") return (
    <>
      {E.isFutureTask(x) ? <span className="chip-ref" title="시작 전">예정 {E.shortD(x.start)}</span> : null}
      <select className="inline" value={x.status} onChange={(e) => E.setTask(x.id, "status", e.target.value)}>
        {E.TASK_ST.map((s) => <option key={s}>{s}</option>)}
      </select>
    </>
  );
  if (w.kind === "ho") {
    const cur = x.status === "hold" ? "보류" : E.flowSteps()[E.hoFlow(x)];
    return (
      <select className="inline" value={cur} onChange={(e) => { E.setHOStep(E.S.handoffs.find((h) => h.id === x.id), e.target.value); E.commit(); }}>
        {[...E.flowSteps().slice(E.flowIdx("개발")), "보류"].map((n) => <option key={n}>{n}</option>)}
      </select>
    );
  }
  if (w.kind === "data") return (
    <select className="inline" value={x.status} onChange={(e) => E.setData(x.id, "status", e.target.value)}>
      {E.DATA_ST.map((s) => <option key={s}>{s}</option>)}
    </select>
  );
  return null;
}

// workItems의 click (창 열기)
function workOpen(w) {
  const x = w.x;
  if (w.kind === "req") return E.editReq(x.id);
  if (w.kind === "task") return E.editTask(x.id);
  if (w.kind === "ho") { const t = E.taskOfHO(x); return t ? E.editTask(t.id) : E.adoptHO(x.id); }
  if (w.kind === "data") return E.openData(x.id);
}

const dragData = (e) => e.dataTransfer.getData("text/plain").split(":");

// ── 단계 보드 (오프라인판 flowBoard) ──
function FlowBoard({ list, pid }) {
  const FL = E.flowSteps(), cols = [[-2, "정기 업무"], [-1, "일반 업무"], ...FL.map((l, i) => [i, l])], t = E.today();
  return (
    <div className="board flow-board" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(118px, 1fr))` }}>
      {cols.map(([i, l]) => {
        const last = FL.length - 1, colOf = (w) => (E.workDone(w) ? last : w.flow);
        let items = i === -2 ? [] : E.boardSort(list.filter((w) => (i === -1 ? w.flow < 0 && w.open : colOf(w) === i)));
        const recs = i === -2 ? E.S.recurring.filter((r) => (pid ? r.projectId === pid : !E.proj(r.projectId)?.archived)).sort((a, b) => (E.recurNext(a) || "9").localeCompare(E.recurNext(b) || "9")) : [];
        if (i === FL.length - 1) items = items.slice().sort((a, b) => E.workDoneAt(b).localeCompare(E.workDoneAt(a))).slice(0, 12);
        return (
          <div key={i} className="col"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drop-to"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("drop-to")}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("drop-to"); const d = dragData(e); if (d.length === 2) E.flowMove(d[0], d[1], i); }}>
            <div className="col-h"><b>{l}</b> <span className="muted small">{items.length + recs.length}</span></div>
            {items.map((w) => {
              const x = w.x, late = w.open && w.due && w.due < t, icon = E.stageIcon(w);
              return (
                <div key={w.kind + x.id} className={`kcard ${i === FL.length - 1 ? "is-done" : ""}`} draggable="true"
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", `${w.kind}:${x.id}`); e.currentTarget.classList.add("dragging"); }}
                  onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("drop-before"); }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("drop-before")}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove("drop-before"); e.currentTarget.closest(".col").classList.remove("drop-to");
                    const d = dragData(e); if (d.length === 2 && !(d[0] === w.kind && d[1] === x.id)) E.flowDropBefore(d[0], d[1], i, w.kind, x.id);
                  }}
                  onClick={() => workOpen(w)}>
                  {pid ? null : <div className="small"><ProjTag id={x.projectId} /></div>}
                  <div className="tt"><TypeIcon kind={icon} /> <CodeTag c={w.code} /> {w.title}{" "}</div>
                  <div className="small muted">
                    {w.st || ""}{w.who ? <>{" · "}<b>{w.who}</b></> : null}
                    {w.due ? <>{" · "}<span className={late ? "text-[var(--danger)] font-bold" : ""}>{E.shortD(w.due)}</span></> : w.open ? <>{" · "}<span className="no-due">마감 없음</span></> : null}
                    {" "}
                  </div>
                  {w.next && w.open ? <div className="mt-1.5" onClick={(e) => e.stopPropagation()}><WorkNext w={w} /></div> : null}
                </div>
              );
            })}
            {recs.map((r) => {
              const nx = E.recurNext(r);
              return (
                <div key={"recur" + r.id} className="kcard" draggable="true"
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", `recur:${r.id}`); e.currentTarget.classList.add("dragging"); }}
                  onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}
                  onClick={() => E.editRecur(r.id)}>
                  {pid ? null : <div className="small"><ProjTag id={r.projectId} /></div>}
                  <div className="tt"><TypeIcon kind="recur" /> {r.title}{" "}</div>
                  <div className="small muted">{E.recurLabel(r)}{nx ? ` · ${E.shortD(nx)}` : ""}</div>
                </div>
              );
            })}
            {i === -2 ? <button className="add" onClick={() => E.editTask(null, { kind: "recur" })}>+ 추가</button> : null}
            {i === -1 || (i >= 0 && i < FL.indexOf("개발") + 1) ? <button className="add" onClick={() => E.editTask(null, { stage: i === -1 ? "" : FL[i] })}>+ 추가</button> : null}
          </div>
        );
      })}
    </div>
  );
}

// ── 목록 한 줄 ──
function WorkRow({ w, pid, alerts, t }) {
  const S = E.S;
  const x = w.x, late = w.open && w.due && w.due < t;
  const tk = w.kind === "task" ? x : w.kind === "ho" ? E.taskOfHO(x) : null, dw = tk && w.open ? E.dataWait(tk) : null;
  const icon = E.stageIcon(w);
  const wb = w.kind === "task" && x.wbsId ? S.wbs.find((z) => z.id === x.wbsId) : null;
  return (
    <tr className={`row-click ${E.workDone(w) ? "is-done" : ""} ${!w.open ? "opacity-55" : ""}`} onClick={(e) => E.rowClick(e.nativeEvent, () => workOpen(w))}>
      {pid ? null : <td className="nowrap"><ProjTag id={x.projectId} /></td>}
      <td className="tc-title">
        {" "}<div className="link" onClick={() => workOpen(w)}>
          <TypeIcon kind={icon} /><CodeTag c={w.code} />{x.kind === "req" ? <span className="chip-ref">요구사항</span> : null}
          <span className="tlabel">{x.extKey ? <><span className="mono small muted">{x.extKey}</span>{" "}</> : null}{w.title}</span>
        </div>
        {w.flow >= 0 ? <>{" "}<FlowPipe i={w.flow} /></> : null}
        {w.stage ? <>{" "}<span className="chip-ref">{w.stage}</span></> : null}
        {w.kind === "task" ? <TaskVia x={x} /> : null}
        {w.kind === "ho" ? <><ReqChips ids={x.reqIds} /><HoTcChip h={x} /></> : w.kind === "data" ? <ReqChips ids={x.reqId ? [x.reqId] : []} /> : null}
        {w.kind === "ho" ? alerts.filter((a) => a.ref[1] === x.id).map((a, n) => <span key={n} className="late-tag">{a.kind}</span>) : null}
        {dw ? <span className="late-tag cursor-pointer" onClick={() => E.openData(dw.id)} title={`${dw.org || ""} · ${dw.status}`}>데이터 대기</span> : null}
        {wb ? <>{" "}<span className="chip-ref cursor-pointer" onClick={() => E.editWBS(wb.id)} title="관련 WBS">{wb.code} {wb.title}</span></> : null}
      </td>
      <td>{" "}<WorkStSel w={w} /></td>
      <td className="nowrap small tc-opt">{" "}{w.pri ? <PriIcon p={w.pri} /> : null}{w.pri ? ({ high: "높음", mid: "보통", low: "낮음" }[w.pri] || "") : ""}</td>
      <td className="nowrap tc-opt">{" "}{w.start ? <>{E.shortD(w.start)}{w.open ? <>{" "}<span className="muted small">{E.calDays(w.start)}일째</span></> : null}</> : <span className="muted">-</span>}</td>
      <td className={`nowrap ${late ? "text-[var(--danger)] font-bold" : ""}`}>{" "}{w.due ? <>{E.shortD(w.due)} <span className={`small ${late ? "" : "muted"}`}>{w.open ? E.dday(w.due) : ""}</span></> : <span className="muted">-</span>}</td>
      <td className="small">{" "}{w.who || ""}</td>
    </tr>
  );
}

export default function Tasks() {
  const { S } = useStore();
  const view = S.ui.workView || "list";
  const pid = S.ui.pid === "all" ? null : S.ui.pid;
  const f = "open", q = (S.ui.taskQ || "").toLowerCase(), t = E.today();
  const kinds = { req: 1, task: 1, ho: 1, data: 1 };
  const alerts = E.computeAlerts(pid);
  const wk = (w) => (w.kind === "task" && w.x.kind === "req" ? "req" : w.kind);
  const all = E.workItems(pid).filter((w) => kinds[wk(w)] !== 0);
  const hit = (w) => ((w.code || "") + w.title + (w.who || "") + w.text).toLowerCase().includes(q);
  let list = all.filter((w) => (f === "all" ? true : f === "open" ? w.open : f === "done" ? !w.open : w.kind === "task" && w.x.status === f));
  if (q) list = list.filter(hit);
  const pr = { high: 0, mid: 1, low: 2 };
  list.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (pr[a.pri] ?? 1) - (pr[b.pri] ?? 1));
  let doneL = all.filter(E.workDone);
  if (q) doneL = doneL.filter(hit);
  doneL = doneL.sort((a, b) => E.workDoneAt(b).localeCompare(E.workDoneAt(a)));
  list = list.concat(q ? doneL : doneL.slice(0, 12));
  const memoN = S.tasks.filter((x) => E.inScope(x) && E.memoDated(x.memo).length).length;

  const head = (
    <PageHead title="업무 관리" meta={pid ? E.projName(pid) : "전체 프로젝트"} actions={<>
      {memoN ? <button className="btn" onClick={() => E.splitAllMemos()} title="메모의 '6월 9일 기준 …' 줄을 날짜별 진행 기록으로">메모 → 진행 기록 ({memoN}건)</button> : null}
      {S.reqs.some(E.inScope) ? <button className="btn" onClick={() => E.selTab("reqs")}>요구사항 추적표</button> : null}
      <button className="btn primary" onClick={() => E.editTask()}>+ 업무 추가</button>
    </>} />
  );
  const filters = (
    <div className="filters">
      <div className="seg">
        {[["list", "목록"], ["flow", "단계 보드"]].map(([k, l]) => (
          <button key={k} className={view === k ? "on" : ""} onClick={() => { S.ui.workView = k; E.persistUI(); E.render(); }}>{l}</button>
        ))}
        {" "}
      </div>
      <input className="search" placeholder="업무 검색" defaultValue={S.ui.taskQ || ""}
        onChange={(e) => { S.ui.taskQ = e.target.value; clearTimeout(window._q); window._q = setTimeout(() => E.render(), 250); }} />
    </div>
  );

  if (view === "flow") {   // 보드는 완료까지 보여줌 (검색만)
    let bl = all;
    if (q) bl = bl.filter((w) => (w.title + (w.who || "") + w.text).toLowerCase().includes(q));
    return <>{head}{filters}<FlowBoard list={bl} pid={pid} /></>;
  }

  const recs = S.recurring.filter(E.inScope).sort((a, b) => (E.recurNext(a) || "9").localeCompare(E.recurNext(b) || "9"));
  return (
    <>
      {head}{filters}
      <div className="card"><div className="tbl-wrap"><table className="t tcards">
        <thead><tr>{pid ? null : <th>프로젝트</th>}<th>업무</th><th>상태</th><th>우선</th><th>시작일</th><th>마감</th><th>담당</th></tr></thead>
        <tbody>
          {list.length ? list.map((w) => <WorkRow key={w.kind + w.x.id} w={w} pid={pid} alerts={alerts} t={t} />)
            : <tr><td colSpan={7} className="empty">해당하는 일이 없어</td></tr>}
        </tbody>
      </table></div></div>
      <div className="card">
        <div className="card-h">
          <h3>정기 업무</h3><span className="sub">{recs.length}건</span>
          <div className="actions"><button className="btn sm" onClick={() => E.editTask(null, { kind: "recur" })}>+ 정기 업무</button></div>
          {" "}
        </div>
        <div className="tbl-wrap"><table className="t tcards">
          <thead><tr>{pid ? null : <th>프로젝트</th>}<th>정기 업무</th><th>주기</th><th>다음 예정</th><th>수신</th></tr></thead>
          <tbody>
            {recs.length ? recs.map((r) => {
              const nx = E.recurNext(r);
              return (
                <tr key={r.id}>
                  {pid ? null : <td className="nowrap"><ProjTag id={r.projectId} /></td>}
                  <td className="tc-title">{" "}<span className="link" onClick={() => E.editRecur(r.id)}>{r.title}</span>
                    {r.path ? <>{" "}<button className="btn sm ghost" title={r.path} onClick={() => E.copyText(r.path, "경로 복사됨")}>경로</button></> : null}</td>
                  <td className="nowrap">{" "}{E.recurLabel(r)}</td>
                  <td className="nowrap">{" "}{nx ? <>{E.shortD(nx)} <span className="small muted">{E.dday(nx)}</span></> : "-"}</td>
                  <td className="small">{" "}{r.recipient || ""}</td>
                </tr>
              );
            }) : <tr><td colSpan={5} className="empty">정기 업무 없음 (주간보고 등)</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}

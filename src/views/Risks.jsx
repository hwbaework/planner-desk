import { useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { PageHead, Badge, TypeIcon } from "../components/ui.jsx";

export const tabs = ["risks"];


// 오프라인판 projTag
function ProjTag({ id }) {
  return <span className="ptag"><i style={{ background: E.projColor(id) }}></i>{E.projName(id)}</span>;
}
// 오프라인판 codeTag
const CodeTag = ({ c }) => (c ? <span className="code-tag">{c}</span> : null);

// 오프라인판 riskTaskChip
function RiskTaskChip({ r }) {
  const st = E.riskTaskState(r); if (!st) return null;
  return (
    <span className="chip-ref" style={{ cursor: "pointer", ...(st.done ? { color: "var(--ok)", borderColor: "var(--ok)" } : {}) }}
      onClick={(e) => { e.stopPropagation(); E.closeModal(); E.editTask(st.t.id); }}>업무 · {st.stage}</span>
  );
}

// 오프라인판 dblEdit(…,'owner','risks'): 더블클릭 → 그 자리에서 입력 (Enter·바깥 클릭 저장, Esc 취소)
function OwnerCell({ r }) {
  const [edit, setEdit] = useState(false);
  const fin = (save, inp) => {
    setEdit(false);
    const nv = inp.value.trim(), ov = r.owner || "";
    if (save && nv !== ov) { r.owner = nv; r.updatedAt = new Date().toISOString(); E.commit(); }
  };
  return (
    <td className="small nowrap dbl-edit" onDoubleClick={() => { clearTimeout(window._rowT); setEdit(true); }}>
      {edit ? (
        <input className="dbl-inp" defaultValue={r.owner || ""} autoFocus onFocus={(e) => e.target.select()}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") { e.currentTarget.dataset.cancel = "1"; e.currentTarget.blur(); } }}
          onBlur={(e) => fin(e.currentTarget.dataset.cancel !== "1", e.currentTarget)} />
      ) : <>{r.owner || ""}</>}
    </td>
  );
}

function RiskRow({ r, pid, t }) {
  const [lv, lc] = E.riskLevel(r), late = r.status !== "완료" && r.due && r.due < t;
  const done = r.status === "완료";
  return (
    <tr className={`row-click ${done ? "is-done" : ""}`} onClick={(e) => E.rowClick(e.nativeEvent, () => E.editRisk(r.id))} style={done ? { opacity: 0.55 } : undefined}>
      {pid ? null : <td className="nowrap"><ProjTag id={r.projectId} /></td>}
      <td>
        <TypeIcon kind="bug" /><CodeTag c={r.code} /><span className="link" onClick={() => E.editRisk(r.id)}>{r.title}</span>{"  "}<RiskTaskChip r={r} />
        {r.desc ? <div className="small muted clamp1">{r.desc}</div> : null}
      </td>
      <td className="nowrap"><Badge cls={lc}>{lv}</Badge></td>
      <td className="small">{r.plan ? <span className="clamp1">{r.plan}</span> : <span className="muted">-</span>}</td>
      <OwnerCell r={r} />
      <td className="nowrap" style={late ? { color: "var(--danger)", fontWeight: 700 } : undefined}>
        {r.due ? <>{E.shortD(r.due)}{!done ? <>{" "}<span className={`small ${late ? "" : "muted"}`}>{E.dday(r.due)}</span></> : null}</> : <span className="muted">-</span>}
      </td>
      <td><select className="inline" value={r.status} onChange={(e) => E.setRisk(r.id, "status", e.target.value)}>{E.RISK_ST.map((x) => <option key={x}>{x}</option>)}</select></td>
    </tr>
  );
}

// 오프라인판 riskBoard
function RiskBoard({ list, pid }) {
  const t = E.today();
  return (
    <div className="board flow-board" style={{ gridTemplateColumns: `repeat(${E.RISK_ST.length}, minmax(150px, 1fr))` }}>
      {E.RISK_ST.map((st) => {
        let items = list.filter((r) => r.status === st).sort((a, b) => E.riskScore(b) - E.riskScore(a) || (a.due || "9").localeCompare(b.due || "9"));
        if (st === "완료") items = items.sort((a, b) => (b.closedAt || "").localeCompare(a.closedAt || "")).slice(0, 12);
        return (
          <div className="col" key={st}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drop-to"); }}
            onDragLeave={(e) => e.currentTarget.classList.remove("drop-to")}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("drop-to"); const d = e.dataTransfer.getData("text/plain"); if (d.startsWith("risk:")) E.setRisk(d.slice(5), "status", st); }}>
            <div className="col-h"><b>{st}</b> <span className="muted small">{items.length}</span></div>
            {items.map((r) => {
              const [lv, lc] = E.riskLevel(r), late = st !== "완료" && r.due && r.due < t;
              const chip = E.riskTaskState(r);
              return (
                <div key={r.id} className={`kcard ${st === "완료" ? "is-done" : ""}`} draggable="true"
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", "risk:" + r.id); e.currentTarget.classList.add("dragging"); }}
                  onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}
                  onClick={() => E.editRisk(r.id)}>
                  {pid ? null : <div className="small"><ProjTag id={r.projectId} /></div>}
                  <div className="tt"><TypeIcon kind="bug" /> <CodeTag c={r.code} /> {r.title}</div>
                  <div className="small muted">
                    <Badge cls={lc}>{lv}</Badge>
                    {r.owner ? <> · <b>{r.owner}</b></> : null}
                    {r.due ? <> · <span style={late ? { color: "var(--danger)", fontWeight: 700 } : undefined}>{E.shortD(r.due)}</span></> : null}
                  </div>
                  {chip ? <div style={{ marginTop: 4 }}><RiskTaskChip r={r} /></div> : null}
                </div>
              );
            })}
            {st === "오픈" ? <button className="add" onClick={() => E.editRisk()}>+ 추가</button> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function Risks() {
  const { S } = useStore();
  const pid = S.ui.pid === "all" ? null : S.ui.pid, t = E.today();
  // 목록: 진행 중(중요도·기한 순) + 아래에 최근 완료 12개, 검색하면 완료까지 전부
  const q = (S.ui.riskQ || "").toLowerCase(), hit = (r) => !q || (r.code + r.title + (r.desc || "") + (r.plan || "") + (r.owner || "")).toLowerCase().includes(q);
  const mine = S.risks.filter(E.inScope).filter(hit);
  const openL = mine.filter((r) => r.status !== "완료").sort((a, b) => E.riskScore(b) - E.riskScore(a) || (a.due || "9").localeCompare(b.due || "9"));
  const doneL = mine.filter((r) => r.status === "완료").sort((a, b) => (b.closedAt || b.updatedAt || "").localeCompare(a.closedAt || a.updatedAt || ""));
  const list = openL.concat(q ? doneL : doneL.slice(0, 12));
  const view = S.ui.riskView || "list";
  return (
    <>
      <PageHead title="이슈 · 리스크" meta={pid ? E.projName(pid) : "전체"} actions={<button className="btn primary" onClick={() => E.editRisk()}>+ 이슈 추가</button>} />
      <div className="filters">
        <div className="seg">{[["list", "목록"], ["board", "상태 보드"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => { S.ui.riskView = k; E.persistUI(); E.render(); }}>{l}</button>)}</div>
        <input className="search" placeholder="이슈 검색" defaultValue={S.ui.riskQ || ""}
          onChange={(e) => { S.ui.riskQ = e.target.value; clearTimeout(window._q); window._q = setTimeout(() => E.render(), 250); }} />
      </div>
      {view === "board" ? <RiskBoard list={mine} pid={pid} /> : (
        <div className="card"><div className="tbl-wrap"><table className="t">
          <thead><tr>{pid ? null : <th>프로젝트</th>}<th>이슈</th><th>중요도</th><th>대응 방안</th><th>담당</th><th>기한</th><th>상태</th></tr></thead>
          <tbody>
            {list.length ? list.map((r) => <RiskRow key={r.id} r={r} pid={pid} t={t} />) : <tr><td colSpan={7} className="empty">등록된 이슈가 없어</td></tr>}
          </tbody>
        </table></div></div>
      )}
    </>
  );
}

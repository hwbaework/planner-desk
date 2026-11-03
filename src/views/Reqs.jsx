import { useStore } from "../lib/store.js";
import * as E from "../legacy/engine.js";
import { PageHead } from "../components/ui.jsx";
import { NeedProject } from "./Screens.jsx";

// 요구사항 추적표: 구분이 요구사항인 업무 → 화면 → 테스트 (오프라인판 renderReqs)
export const tabs = ["reqs"];

export default function Reqs() {
  const { S } = useStore();
  if (S.ui.pid === "all") return <><PageHead title="요구사항 추적표" meta="" /><NeedProject what="요구사항" /></>;
  const pid = S.ui.pid, q = (S.ui.reqQ || "").toLowerCase();
  let list = E.reqTasks(pid).map((t) => ({ ...t, screenIds: E.reqScreens(t) }));
  if (q) list = list.filter((r) => ((r.code || "") + r.title + (r.memo || "") + (r.link || "")).toLowerCase().includes(q));
  list.sort((a, b) => String(a.code).localeCompare(String(b.code), "ko", { numeric: true }));
  const work = E.workItems(pid);
  const stName = (t) => {
    const w = work.find((x) => (x.kind === "task" ? x.x.id === t.id : x.kind === "ho" && x.x.id === t.hoId));
    return w ? (E.workDone(w) ? "완료" : w.flow < 0 ? "일반" : E.flowSteps()[w.flow]) : t.stage || "-";
  };
  const Muted = () => <span className="muted">-</span>;

  return (
    <>
      <PageHead title="요구사항 추적표" meta={E.projName(pid)} actions={<>
        <button className="btn" onClick={() => E.selTab("tasks")}>← 업무</button>
        <button className="btn" onClick={() => E.exportReqCsv()}>CSV</button>
        <button className="btn primary" onClick={() => E.editTask(null, { kind: "req" })}>+ 요구사항</button>
      </>} />
      <div className="filters">
        <input className="search" placeholder="요구사항 검색" defaultValue={S.ui.reqQ || ""}
          onInput={(e) => { S.ui.reqQ = e.target.value; clearTimeout(window._q); window._q = setTimeout(() => E.render(), 250); }} />
      </div>
      <div className="card"><div className="tbl-wrap"><table className="t">
        <thead><tr><th>요구사항</th><th>단계</th><th>관련 WBS</th><th>반영 화면</th><th>테스트</th></tr></thead>
        <tbody>
          {list.length ? list.map((r) => {
            const tr = E.reqTrace(r), w = r.wbsId && S.wbs.find((x) => x.id === r.wbsId);
            return (
              <tr key={r.id} className="row-click" onClick={(e) => E.rowClick(e.nativeEvent, () => E.editTask(r.id))}>
                <td>{r.code ? <span className="code-tag">{r.code}</span> : null}<span className="link" onClick={() => E.editTask(r.id)}>{r.title}</span></td>
                <td className="small nowrap">{stName(r)}</td>
                <td className="small nowrap">{w ? `${w.wid || w.code} ${w.title}` : <Muted />}</td>
                <td>{tr.screens.length ? tr.screens.map((sc) => <span key={sc.id} className="chip-ref">{sc.code}</span>) : <Muted />}</td>
                <td className="nowrap small">{tr.tcs.length
                  ? <>{tr.pass}/{tr.tcs.length} Pass{tr.fail ? <> <span className="font-bold text-(--danger)">Fail {tr.fail}</span></> : null}</>
                  : <Muted />}</td>
              </tr>
            );
          }) : <tr><td colSpan={5} className="empty">요구사항이 없어</td></tr>}
        </tbody>
      </table></div></div>
    </>
  );
}

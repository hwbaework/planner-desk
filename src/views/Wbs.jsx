import { useEffect, useRef } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { PageHead, ChangeInput, IconBtn } from "../components/ui.jsx";

export const tabs = ["wbs"];

// 오프라인판 needProject
function NeedProject({ what }) {
  const ps = E.activeProjects();
  return (
    <div className="card">
      <div className="card-h"><h3>{what}은(는) 프로젝트별로 관리해</h3><span className="sub">왼쪽에서 프로젝트를 고르거나 아래에서 선택</span></div>
      <div className="card-b">
        {ps.length ? ps.map((p) => (
          <div key={p.id} className="proj" onClick={() => E.selProject(p.id)}><span className="dot" style={{ background: p.color }}></span><span className="nm">{p.name}</span></div>
        )) : <div className="empty">프로젝트가 없어. ＋ 프로젝트 추가부터.</div>}
      </div>
    </div>
  );
}

// 오프라인판 scrStSel
function ScrStSel({ w }) {
  return (
    <select className={`inline scr-st ${w.scrSt ? "s-" + w.scrSt : ""}`} value={w.scrSt || ""} onChange={(e) => E.setWBS(w.id, "scrSt", e.target.value)}>
      <option value="">-</option>
      {E.SCR_ST.map((x) => <option key={x}>{x}</option>)}
    </select>
  );
}

// 접기 버튼 (하위 없으면 빈 자리)
function FoldBtn({ has, folded, fk }) {
  if (!has) return <span className="inline-block w-[24px]"></span>;
  return (
    <button className="tl-fold" onClick={() => E.wbsFold(fk)} title={folded ? "펼치기" : "접기"}>
      <svg className="ico" viewBox="0 0 24 24" style={{ width: 16, height: 16, margin: 0 }}><path d={folded ? "m9 18 6-6-6-6" : "m6 9 6 6 6-6"} /></svg>
    </button>
  );
}

// 간트 눈금 (오프라인판 renderWBS 안의 ruler)
function rulerData(r0, r1, scale, span) {
  const top = [], bot = [], ticks = [], qOnly = span > 750;
  let d = E.parseD(r0); const end = E.parseD(r1), md = (x) => `${String(x.getMonth() + 1).padStart(2, "0")}/${String(x.getDate()).padStart(2, "0")}`;
  const isoWeek = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); };
  const r0d = E.parseD(r0), wk0 = new Date(r0d.getFullYear(), r0d.getMonth(), r0d.getDate() - r0d.getDay());
  while (d <= end) {
    const iso = E.fmtD(d), dd = d.getDate(), dow = d.getDay();
    const pw = Math.floor((d - wk0) / (7 * 864e5)) + 1, newYear = d.getMonth() === 0 && dd <= 7;
    if (scale === "all" && dd === 1) {
      ticks.push(iso);
      if (d.getMonth() === 0) top.push([iso, String(d.getFullYear())]);
      if (!qOnly || d.getMonth() % 3 === 0) bot.push([iso, `${d.getMonth() + 1}월`]);
    }
    if (scale === "month") {
      if (dd === 1 && (d.getMonth() === 0 || iso.slice(0, 7) === r0.slice(0, 7))) top.push([iso, String(d.getFullYear())]);
      if (dd === 1) bot.push([iso, `${d.getMonth() + 1}월`]);
    }
    if (scale === "week" && dow === 0) {
      ticks.push(iso);
      if ((pw - 1) % 4 === 0) { top.push([iso, `W${pw}`]); bot.push([iso, `${newYear ? d.getFullYear() : md(d)} · W${isoWeek(d)}`]); }
    }
    if (scale === "day") {
      if (dow === 0) top.push([iso, `${newYear && dd <= 7 ? d.getFullYear() + " " : ""}${md(d)} · W${isoWeek(d)}`]);
      bot.push([iso, String(dd), dow === 0 || dow === 6]);
    }
    d = new Date(d.getFullYear(), d.getMonth(), dd + 1);
  }
  return { top, bot, ticks };
}
function Ruler({ r0, r1, scale, span, pos, gW }) {
  const { top, bot, ticks } = rulerData(r0, r1, scale, span);
  const sp = (arr, cls) => arr.map(([iso, l, off]) => <span key={cls + iso} className={`${cls}${off ? " off" : ""}`} style={{ left: `${pos(iso)}%` }}>{l}</span>);
  return (
    <div className="g-ruler" style={gW}>
      {sp(top, "g-top")}{sp(bot, "g-bot")}
      {ticks.map((iso) => <i key={iso} style={{ left: `${pos(iso)}%` }}></i>)}
    </div>
  );
}

export default function Wbs() {
  const { S, version } = useStore();
  const renameRef = useRef(null);

  // 그린 뒤 고정 칸(DOM에서 잼) · 새 컬럼 이름 입력
  useEffect(() => {
    E.wbsFreeze();
    const cid = renameRef.current;
    if (cid) {
      renameRef.current = null;
      const th = document.querySelector(`th[data-cid="${cid}"]`);
      if (th && !th.querySelector("input")) E.wbsRenameCol(cid, th);
    }
  });

  if (S.ui.pid === "all") return <><PageHead title="WBS" meta="" /><NeedProject what="WBS" /></>;

  const pid = S.ui.pid, p = E.proj(pid);
  const ws = S.wbs.filter((w) => w.projectId === pid);
  const T = E.wbsTree(pid), fold = S.ui.wbsFold || {};
  const today = E.today();
  // 진척·지연은 실제 작업(하위 없는 항목) 기준
  const leaves = ws.filter((w) => !w.code || !(T.kids[w.code] || []).length);
  const ds = leaves.flatMap((w) => [w.start, w.end]).concat([p.start, p.end]).filter(Boolean).sort();
  const r0 = ds[0], r1 = ds[ds.length - 1];
  const span = r0 && r1 ? Math.max(1, E.calDays(r0, r1) + 1) : 0;
  const pos = (s) => ((E.calDays(r0, s)) / span) * 100;
  const tops = T.roots.map((w) => T.roll.get(w.id)), nAll = tops.reduce((a, r) => a + (r.n || 0), 0);
  const avg = nAll ? Math.round(tops.reduce((a, r) => a + (r.n || 0) * r.progress, 0) / nAll) : leaves.length ? Math.round(leaves.reduce((a, w) => a + E.wbsLeafProg(w).progress, 0) / leaves.length) : 0;
  const late = leaves.filter((w) => w.end && w.end < today && E.wbsLeafProg(w).progress < 100).length;
  const missDocs = ws.filter((w) => !w.code).flatMap((w) => E.wbsDocs(w).filter((x) => !x.doc)).length;
  // 전체 일정(프로젝트 기간·차년도): 제목 옆, 누르면 프로젝트 정보에서 바로 수정
  const dot = (d) => (d || "?").replace(/-/g, ".");
  const yi = (p.years || []).findIndex((y) => y.start <= today && today <= y.end);
  const title = (
    <>WBS <span className="proj-period" onClick={() => E.editProject(pid)}>전체 일정 {p.start || p.end ? `${dot(p.start)} ~ ${dot(p.end)}` : "없음"}{yi >= 0 ? <> · <span className="on">{yi + 1}차년도</span></> : null}</span></>
  );
  const meta = `작업 ${leaves.length}개 · 평균 진척 ${avg}% · 지연 ${late}${missDocs ? ` · 산출물 목록에 없는 문서 ${missDocs}개 (점선, 눌러서 추가)` : ""}${r0 ? ` · ${r0} ~ ${r1}` : ""}`;
  const head = <PageHead title={title} meta={meta} actions={<button className="btn primary" onClick={() => E.editWBS()}>＋ 작업 추가</button>} />;

  // 간트 배율: 전체는 칸 폭에 맞춤, 월·주·일은 하루당 폭을 늘려 옆으로 넘겨 봄
  const scale = S.ui.wbsScale || "day", ppd = { month: 4, week: 14, day: 30 }[scale] || 0;
  const gW = ppd && span ? { width: `${span * ppd}px`, minWidth: 0 } : undefined;
  const ruler = r0 ? <Ruler r0={r0} r1={r1} scale={scale} span={span} pos={pos} gW={gW} /> : null;
  const setScale = (k) => { S.ui.wbsScale = k; window._wbsScroll = null; E.persistUI(); E.render(); };
  const scaleBtns = (
    <span className="seg">
      {[["all", "전체"], ["month", "월"], ["week", "주"], ["day", "일"]].map(([k, l]) => <button key={k} className={scale === k ? "on" : ""} onClick={() => setScale(k)}>{l}</button>)}
    </span>
  );
  const tl = r0 && today >= r0 && today <= r1 ? <div className="todayline" style={{ left: `${pos(today)}%` }}></div> : null;
  const barOf = (s, e, prog, color, isLate) => r0 && s && e ? (
    <div className="bar" style={{ left: `${pos(s)}%`, width: `${Math.max(0.8, ((E.calDays(s, e) + 1) / span) * 100)}%`, background: isLate ? "var(--danger)" : color }}><i style={{ width: `${Math.min(100, prog || 0)}%` }}></i></div>
  ) : null;

  // dblEdit·컬럼 이름 바꾸기는 칸 DOM을 직접 바꾸므로, 다시 그릴 때마다 새 칸으로 (key = version)
  const ownerTd = (w) => <td key={"o" + version} className="nowrap dbl-edit" onDoubleClick={(e) => E.dblEdit(e.currentTarget, w.id, "owner", "wbs")}>{w.owner || ""}</td>;
  // 오프라인판 leafCells (칸 사이 공백은 칸 안에 둠 → 글자 내용 같게)
  const leafCells = (w, isLate, r) => [
    <td key={"o" + version} className="nowrap dbl-edit" onDoubleClick={(e) => E.dblEdit(e.currentTarget, w.id, "owner", "wbs")}>{" "}{w.owner || ""}{" "}</td>,
    <td key="s" className="nowrap"><ChangeInput key={version} type="date" className="inline wdate" value={w.start || ""} max={w.end || ""} onCommit={(v) => E.setWBS(w.id, "start", v)} />{" "}</td>,
    <td key="e" className="nowrap"><ChangeInput key={version} type="date" className="inline wdate" style={isLate ? { color: "var(--danger)", fontWeight: 600 } : undefined} value={w.end || ""} min={w.start || ""} onCommit={(v) => E.setWBS(w.id, "end", v)} />{" "}</td>,
    <td key="p" className="nowrap">{r && r.auto ? <b title="기능 FP 기준 자동">{r.progress}%</b> : <><ChangeInput key={version} className="progress" type="number" min="0" max="100" step="10" value={Number(w.progress) || 0} onCommit={(v) => E.setWBS(w.id, "progress", Math.max(0, Math.min(100, Number(v) || 0)))} />%</>}</td>,
  ];

  if (!T.coded.length) return <>{head}<div className="card"><div className="empty">메뉴별 WBS가 아직 없어</div></div></>;

  // 1) 메뉴별 WBS (번호 트리)
  const cols = E.wbsCols(pid);
  const colDrop = (e, cid) => { e.preventDefault(); e.stopPropagation(); const d = e.dataTransfer.getData("text/plain"); if (d.startsWith("col:")) E.wbsMoveCol(d.slice(4), cid); };
  const addCol = () => {
    const before = new Set(E.wbsCols(pid).map((c) => c.id));
    E.wbsAddCol();
    const c = E.wbsCols(pid).find((x) => !before.has(x.id));
    if (c) renameRef.current = c.id;   // 오프라인판처럼 생기자마자 머리에서 이름 입력 (그린 뒤)
  };

  const rows = [];
  const walk = (w) => {
    const r = T.roll.get(w.id), lv = T.level(w), ch = T.kids[w.code] || [], fk = E.wbsFoldKey(pid, w.code), folded = !!fold[fk];
    const isLate = r.end && r.end < today && r.progress < 100;
    const color = lv === 1 ? "#2f5d8a" : lv === 2 ? "#3a97b0" : "#4688ec";
    const nTk = E.wbsTasksOf(w).length;
    rows.push(
      <tr key={w.id} className={`${ch.length ? "wbs-grp" : ""} ${lv === 1 ? "wbs-menu" : ""} ${!ch.length && lv > 1 ? (r.progress >= 100 ? "wbs-done" : isLate ? "wbs-late" : "") : ""} row-click`}
        onClick={(e) => E.rowClick(e.nativeEvent, () => E.editWBS(w.id))}
        draggable="true"
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", w.id); e.currentTarget.classList.add("dragging"); }}
        onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drop-to"); }}
        onDragLeave={(e) => e.currentTarget.classList.remove("drop-to")}
        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("drop-to"); E.wbsDropBefore(e.dataTransfer.getData("text/plain"), w.id); }}>
        <td className="mono small nowrap">{w.code}</td>
        <td className="mono small nowrap">{w.wid || ""}{" "}</td>
        <td style={{ paddingLeft: `${8 + (lv - 1) * 16}px` }}>
          <FoldBtn has={!!ch.length} folded={folded} fk={fk} />
          <span className="link" onClick={() => E.editWBS(w.id)}>{w.title}</span>
          {w.note ? <> <span className="chip-ref">{w.note}</span></> : null}
          {nTk ? <> <button className="wbs-tk-btn" onClick={() => E.editWBS(w.id)}>업무 {nTk}</button></> : null}
          <span className="wbs-act">
            <button className="ico-btn" onClick={() => E.wbsAddChild(w.id)} title="하위 추가">+</button>
            <button className="ico-btn" onClick={() => E.wbsOutdent(w.id)} title="한 단계 올리기">←</button>
            <button className="ico-btn" onClick={() => E.wbsIndent(w.id)} title="한 단계 내리기">→</button>
          </span>
          {" "}
        </td>
        <td className="nowrap small">{!ch.length ? <ScrStSel w={w} /> : null}</td>
        {cols.map((c) => <td key={c.id + ":" + version} className="small dbl-edit" onDoubleClick={(e) => E.dblEdit(e.currentTarget, w.id, "cf." + c.id, "wbs")}>{(w.cf || {})[c.id] || ""}</td>)}
        <td></td>
        {ch.length ? <>
          {ownerTd(w)}
          <td className="nowrap small">{r.start || ""}</td>
          <td className="nowrap small" style={isLate ? { color: "var(--danger)", fontWeight: 600 } : undefined}>{r.end || ""}</td>
          <td className="nowrap small"><b>{r.progress}%</b></td>
        </> : leafCells(w, isLate, r)}
        <td><div className="gantt" style={gW}>{barOf(r.start, r.end, r.progress, color, isLate)}{tl}</div></td>
      </tr>
    );
    if (!folded) ch.forEach(walk);
  };
  T.roots.forEach(walk);

  return (
    <>
      {head}
      <div className="card mb-[14px]">
        <div className="card-h"><h3>메뉴별 WBS</h3><span className="sub">{T.coded.length}개</span><div className="actions">{scaleBtns}</div></div>
        <div className="tbl-wrap">
          <table className="t wbs-tree">
            <thead>
              <tr>
                <th className="w-[56px]">WBS</th>
                <th className="w-[80px]">ID</th>
                <th className="min-w-[220px]">작업</th>
                <th className="w-[90px]">상태</th>
                {cols.map((c) => (
                  <th key={c.id + ":" + version} className="cf-h nowrap" data-cid={c.id} draggable="true"
                    onDoubleClick={(e) => E.wbsRenameCol(c.id, e.currentTarget)}
                    onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", "col:" + c.id); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => colDrop(e, c.id)}>
                    {c.name}<IconBtn icon="del" title="컬럼 삭제" onClick={() => E.wbsDelCol(c.id)} />
                  </th>
                ))}
                {cols.length < E.WBS_MAX_COLS ? <th className="cf-add" onClick={addCol} title="컬럼 추가">＋</th> : <th></th>}
                <th className="w-[80px]">담당</th>
                <th className="w-[120px]">시작</th>
                <th className="w-[120px]">종료</th>
                <th className="w-[56px]">진척</th>
                <th className="min-w-[240px]">{ruler || "일정"}</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

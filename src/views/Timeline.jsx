import { Fragment } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { PageHead, TypeIcon, ChangeInput, Raw } from "../components/ui.jsx";

export const tabs = ["timeline"];

// 오프라인판 TL_KIND[k].open(x) 가 부르던 창
const OPEN = { wbs: (x) => E.editWBS(x.id), task: (x) => E.editTask(x.id), ho: (x) => E.openHO(x.id), data: (x) => E.openData(x.id), doc: (x) => E.editDoc(x.id) };

const ui = (fn) => () => { fn(E.S.ui); E.persistUI(); E.render(); };

// 오프라인판 projTag
function ProjTag({ id }) {
  return <span className="ptag"><i style={{ background: E.projColor(id) }}></i>{E.projName(id)}</span>;
}

// 오프라인판 projChips (key = tlProjs)
function ProjChips({ k }) {
  const set = E.projSet(k);
  return (
    <>
      <button className={`chip ${set.length ? "" : "active"}`} onClick={() => E.toggleProjSet(k, "all")}>전체</button>
      {E.activeProjects().map((p) => (
        <button key={p.id} className={`chip ${set.includes(p.id) ? "active" : ""}`} onClick={() => E.toggleProjSet(k, p.id)} title={set.includes(p.id) ? "누르면 빼기" : "누르면 같이 보기"}><ProjTag id={p.id} /></button>
      ))}
    </>
  );
}

function Tog({ on, onClick, label, icon }) {
  return <button className={`chip kchip ${on ? "active" : ""}`} onClick={ui(onClick)} title={on ? "누르면 끄기" : "누르면 켜기"}>{icon}{label}</button>;
}

// 오프라인판 tlFoldBtn
function FoldBtn({ r }) {
  return (
    <button className="tl-fold" onClick={() => E.tlFold(r.fk)} title={r.folded ? "펼치기" : "접기"}>
      <svg className="ico w-3.5 h-3.5 m-0" viewBox="0 0 24 24"><path d={r.folded ? "m9 18 6-6-6-6" : "m6 9 6 6 6-6"} /></svg>
    </button>
  );
}

// 오프라인판 tlSpan (data 가 있으면 끌기 가능 — 문서 전체 mousedown 이 .tl-bar.drag 와 data-* 로 찾음)
function Span({ s0, e0, x, z, r0, r1, color, click, cls, title, data }) {
  if (e0 < s0) [s0, e0] = [e0, s0];
  if (e0 < r0 || s0 > r1) return null;
  const a = s0 < r0 ? r0 : s0, b = e0 > r1 ? r1 : e0;
  const w = Math.max(z.px, (E.calDays(a, b) + 1) * z.px);
  return (
    <div className={`tl-bar ${cls} ${data ? "drag" : ""}`} {...(data || {})} style={{ left: x(a), width: w, background: color }}
      onClick={click ? () => { if (!window._tlDragged) click(); } : undefined} title={`${title} ${s0} ~ ${e0}`}>
      {w > 70 && title ? title : ""}{data ? <i className="tl-grip"></i> : null}
    </div>
  );
}

// 오프라인판 tlMilestone
function Milestone({ d, x, r0, r1, color, click, title, done, data }) {
  if (!d || d < r0 || d > r1) return null;
  return (
    <div className={`tl-ms ${data ? "drag" : ""}`} {...(data || {})} style={{ left: x(d), background: color, ...(done ? { opacity: 0.45 } : {}) }}
      onClick={() => { if (!window._tlDragged) click(); }} title={`${title} ${d}`}></div>
  );
}

let qTimer;

export default function Timeline() {
  const { S } = useStore();
  if (!E.TL_ZOOM[S.ui.tlZoom]) S.ui.tlZoom = "year";   // 예전 '분기' 보기 → 연도
  const set = E.projSet("tlProjs"), pid = set.length ? set : null, t = E.today();
  const rows = E.tlRows(pid);
  const { z, r0, r1 } = E.tlRange(rows), W = z.days * z.px;
  const x = (d) => E.calDays(r0, d) * z.px;
  const anc = E.parseD(S.ui.tlAnchor || t), per = E.tlPeriod(rows);
  const tlTitle = S.ui.tlZoom === "all" ? (per.start && per.end ? `${per.start.replace(/-/g, ".")} ~ ${per.end.replace(/-/g, ".")}` : "전체 기간")
    : S.ui.tlZoom === "year" ? E.tlYearSpan(pid).title : `${anc.getFullYear()}년 ${anc.getMonth() + 1}월`;

  // 머리줄 칸
  const cells = [];
  if (S.ui.tlZoom === "week" || S.ui.tlZoom === "day") for (let i = 0; i < z.days; i++) {
    const d = E.addDays(r0, i), dt = E.parseD(d), hn = E.holidayName(d);
    const lb = S.ui.tlZoom === "day" ? `${dt.getMonth() + 1}/${dt.getDate()} ${"일월화수목금토"[dt.getDay()]}${hn ? " " + hn : ""}` : `${dt.getDate() === 1 || i === 0 ? dt.getMonth() + 1 + "/" : ""}${dt.getDate()}`;
    cells.push([x(d), z.px, lb, hn ? "hol" : dt.getDay() === 0 || dt.getDay() === 6 ? "we" : "", hn]);
  }
  else if (S.ui.tlZoom === "month") for (let d = r0; d <= r1; d = E.addDays(d, 7)) cells.push([x(d), 7 * z.px, E.shortD(d).replace(/\(.*\)/, ""), false]);
  else for (let d = r0; d <= r1; ) { const dt = E.parseD(d), n = E.fmtD(new Date(dt.getFullYear(), dt.getMonth() + 1, 1)); cells.push([x(d), E.calDays(d, n) * z.px, `${dt.getMonth() + 1}월`, false]); d = n; }
  const months = [];
  for (let d = r0; d <= r1; ) { const dt = E.parseD(d), n = E.fmtD(new Date(dt.getFullYear(), dt.getMonth() + 1, 1)); months.push([x(d), Math.min(E.calDays(d, n), E.calDays(d, r1) + 1) * z.px, `${dt.getFullYear()}년 ${dt.getMonth() + 1}월`]); d = n; }

  const gridBody = cells.map(([l, w, , we], i) => <div key={i} className={`tl-cell ${we || ""}`} style={{ left: l, width: w }}></div>);
  const todayLine = t >= r0 && t <= r1 ? <div className="tl-today" style={{ left: x(t) + z.px / 2 }}></div> : null;

  const L = [], R = [];
  rows.forEach((r, i) => {
    if (r.grp) {
      const k = r.fk;
      L.push(
        <div key={k} className="tl-r grp"><FoldBtn r={r} /><ProjTag id={r.p.id} />{" "}<span className="muted small">{r.n}</span>
          {r.p.start && r.p.end
            ? <>{" "}<span className="small muted font-normal cursor-pointer" onClick={() => E.editProject(r.p.id)} title="사업 기간 바꾸기">{E.shortD(r.p.start)} ~ {E.shortD(r.p.end)}</span></>
            : <>{" "}<span className="small font-semibold text-[var(--warn)] cursor-pointer" onClick={() => E.editProject(r.p.id)} title="프로젝트 정보에서 시작·종료일 입력">사업 기간 입력</span></>}
          <button className="tl-add" title="이 프로젝트에 추가" onClick={() => E.tlAdd(r.p.id)}>+</button></div>);
      R.push(<div key={k} className="tl-r grp" style={{ width: W }}>{r.p.start && r.p.end ? <Span s0={r.p.start} e0={r.p.end} x={x} z={z} r0={r0} r1={r1} color="#8590a2" cls="epic" title="" /> : null}{todayLine}</div>);
      return;
    }
    if (r.epic) {
      const k = r.fk;
      L.push(
        <div key={k} className="tl-r epic" style={{ paddingLeft: 8 + (r.lvl || 0) * 16 }}><FoldBtn r={r} />
          <span className="w-[10px] h-[10px] rounded-[2px] flex-none" style={{ background: r.color }}></span>
          <span className={`nm${r.wid ? " cursor-pointer" : ""}`} onClick={r.wid ? () => E.editWBS(r.wid) : undefined}>{r.title}</span>
          <span className="who">{r.st}</span>
          {r.wid ? null : <button className="tl-add" title="이 단계에 WBS 작업 추가" onClick={() => E.editWBS(null, r.phase, r.pid)}>+</button>}</div>);
      R.push(<div key={k} className="tl-r" style={{ width: W }}>{gridBody}{r.s ? <Span s0={r.s} e0={r.e} x={x} z={z} r0={r0} r1={r1} color={r.color} cls="epic" title="" /> : null}{todayLine}</div>);
      return;
    }
    const { x: it, K, kind } = r, s0 = K.s ? it[K.s] : "", e0 = it[K.e], done = K.done(it);
    const ik = K.icon ? K.icon(it) : kind, color = E.TYPE_ICON[ik][0];
    const open = () => OPEN[kind](it), title = K.title(it), who = K.who(it);
    const k = `${kind}:${it.id}:${i}`;
    L.push(
      <div key={k} className="tl-r" style={{ paddingLeft: typeof r.indent === "number" ? 14 + r.indent * 16 : r.indent ? 30 : 10 }}><TypeIcon kind={ik} />
        <span className="nm" onClick={open} title={title}>{title}</span>
        <span className="who">{K.st(it)}{who ? " · " + who : ""}</span>
        <button className="tl-del" title="삭제" onClick={() => E.tlDel(kind, it.id)}>×</button></div>);
    let bar = null;
    if (!e0) bar = (
      <div className="tl-fill"><span>{s0 ? "마감 없음" : "날짜 없음"}</span>
        {K.s && !s0 && !K.noStartFill ? <ChangeInput type="date" title="시작" value="" onCommit={(v) => E.tlSet(kind, it.id, K.s, v)} /> : null}
        <ChangeInput type="date" title={K.s ? (kind === "ho" ? "완료 예정" : "종료·마감") : "계획일"} value="" onCommit={(v) => E.tlSet(kind, it.id, K.e, v)} /></div>);
    else if (!K.s || !s0) bar = <Milestone d={e0} x={x} r0={r0} r1={r1} color={color} click={open} title={title} done={done} data={{ "data-k": kind, "data-id": it.id, "data-e": K.e }} />;
    else bar = <Span s0={s0} e0={e0} x={x} z={z} r0={r0} r1={r1} color={color} click={open} cls={done ? "done" : !done && e0 < t ? "late" : ""} title={title} data={{ "data-k": kind, "data-id": it.id, "data-s": K.s, "data-e": K.e }} />;
    R.push(<div key={k} className="tl-r" style={{ width: W }}>{gridBody}{bar}{todayLine}</div>);
  });

  return (
    <>
      <PageHead title="타임라인"
        meta={`${pid ? pid.map((i) => E.projName(i)).join(", ") : "전체 프로젝트"} · 막대를 끌어 일정 이동, 오른쪽 끝을 끌어 기간 조정 · 날짜 없는 항목은 그 자리에서 입력`}
        actions={<button className="btn primary" onClick={() => E.tlAdd()}>+ 추가</button>} />
      <div className="cal-bar">
        <Raw tag="button" className="btn sm icon-btn" onClick={() => E.tlShift(-1)} title="이전" aria-label="이전" html={E.ICO_PREV} />
        <Raw tag="b" className="cal-title" html={tlTitle} />
        <Raw tag="button" className="btn sm icon-btn" onClick={() => E.tlShift(1)} title="다음" aria-label="다음" html={E.ICO_NEXT} />{" "}
        <button className="btn sm ghost" onClick={() => { S.ui.tlAnchor = ""; E.render(); }}>오늘</button>{" "}
        <span className="f-right items-center">
          <input className="search" placeholder="타임라인 검색" defaultValue={S.ui.tlQ || ""}
            onInput={(e) => { S.ui.tlQ = e.target.value; clearTimeout(qTimer); qTimer = setTimeout(() => E.render(), 250); }} />{" "}
          <div className="seg">{Object.entries(E.TL_ZOOM).map(([k, v]) => (
            <button key={k} className={S.ui.tlZoom === k ? "on" : ""} onClick={ui((u) => { u.tlZoom = k; })}>{v.l}</button>
          ))}</div>
        </span>
      </div>
      <div className="filters"><ProjChips k="tlProjs" /><span className="f-sep"></span>
        {Object.entries(E.TL_KIND).map(([k, K]) => (
          <Tog key={k} on={S.ui.tlKinds[k]} onClick={(u) => { u.tlKinds[k] = u.tlKinds[k] ? 0 : 1; }} label={K.l} icon={<TypeIcon kind={k} />} />
        ))}{" "}
        <span className="f-right">
          <Tog on={S.ui.tlHideDone} onClick={(u) => { u.tlHideDone = u.tlHideDone ? 0 : 1; }} label="완료 숨기기" />
          <Tog on={S.ui.tlMissing} onClick={(u) => { u.tlMissing = u.tlMissing ? 0 : 1; }} label="날짜 없는 항목" />
        </span>
      </div>
      <div className="tlw">
        <div className="tl-left">
          <div className="tl-h mon"></div>
          <div className="tl-h px-2.5">항목<span className="ml-auto">상태 · 담당</span></div>
          {L}
          {rows.length <= (pid ? pid.length : 0) ? <div className="empty">표시할 항목이 없어</div> : null}
        </div>
        <div className="tl-right" id="tlRight" data-px={z.px}>
          <div className="tl-h mon" style={{ width: W }}>{months.map(([l, w, lb], i) => (
            <div key={i} className="tl-cell mon" style={{ left: l, width: w }}>{w > 60 ? lb : w > 26 ? lb.replace(/^\d+년 /, "") : ""}</div>
          ))}</div>
          <div className="tl-h" style={{ width: W }}>{cells.map(([l, w, lb, we, hn], i) => (
            <div key={i} className={`tl-cell ${we || ""}`} style={{ left: l, width: w }} title={hn || undefined}>{lb}</div>
          ))}</div>
          {R}
        </div>
      </div>
    </>
  );
}

import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { PageHead, TypeIcon, Raw } from "../components/ui.jsx";

export const tabs = ["cal"];

// calItems 의 click 문자열(editEvent('id') 등)과 같은 함수
const OPEN = { event: E.editEvent, data: E.openData, task: E.editTask, ho: E.openHO, doc: E.editDoc, recur: E.editRecur, wbs: E.editWBS };
const openItem = (i) => OPEN[i.kind](i.id);

const rerender = () => { E.persistUI(); E.render(); };

// 오프라인판 projTag
function ProjTag({ id }) {
  return <span className="ptag"><i style={{ background: E.projColor(id) }}></i>{E.projName(id)}</span>;
}

// 오프라인판 projChips (key = calProjs)
function ProjChips({ k }) {
  const set = E.projSet(k);
  return (
    <>
      <button className={`chip ${set.length ? "" : "active"}`} onClick={() => E.toggleProjSet(k, "all")}>전체</button>
      {E.activeProjects().map((p) => (
        <button key={p.id} className={`chip ${set.includes(p.id) ? "active" : ""}`} onClick={() => E.toggleProjSet(k, p.id)}
          title={set.includes(p.id) ? "누르면 빼기" : "누르면 같이 보기"}><ProjTag id={p.id} /></button>
      ))}
    </>
  );
}

function CalPill({ i }) {
  const tag = E.CAL_TAG[i.kind];
  const drag = i.kind !== "recur";
  const title = `${E.projName(i.pid)} · ${(tag ? tag + " · " : "") + i.title}${i.late ? ` · ${E.calDays(i.date)}일 지남` : ""}${drag ? " · 끌어서 날짜 변경" : ""}`;
  return (
    <div className={`pill ${i.done ? "done" : ""} ${i.late ? "late" : ""}`} title={title}
      {...(drag ? { draggable: "true", onDragStart: (e) => E.calDrag(e.nativeEvent, `${i.kind}|${i.id}|${i.date}|${i.edge || ""}`) } : {})}
      onClick={(e) => { e.stopPropagation(); openItem(i); }}>
      <TypeIcon kind={i.icon || i.kind} />{i.title}
    </div>
  );
}

function CalIssueBtn({ i }) {
  const { S } = useStore();
  const r = S.risks.find((x) => x.srcRef === `${i.kind}:${i.id}`);
  return r
    ? <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); E.editRisk(r.id); }} title="이 항목으로 등록한 이슈">{r.code}</button>
    : <button className="btn sm" onClick={(e) => { e.stopPropagation(); E.calToIssue(i.kind, i.id, i.date); }}>이슈로</button>;
}

function ItemList({ items, showDate }) {
  if (!items.length) return <div className="empty">일정 없음</div>;
  return items.map((i, n) => (
    <div key={`${i.kind}|${i.id}|${i.date}|${i.edge || ""}|${n}`} className="alert cursor-pointer" onClick={() => openItem(i)}>
      <span className="ic" style={{ background: E.projColor(i.pid) }}></span>
      <div className="body">
        {" "}<div className="d">
          {showDate ? <><b>{E.shortD(i.date)}</b> · </> : null}
          {E.CAL_TAG[i.kind] || i.sub || "일정"} · {E.projName(i.pid)}
          {i.late ? <span className="late-tag">{E.calDays(i.date)}일 지남</span> : null}
        </div>
        {" "}<div className={`tt ${i.done ? "line-through text-(--faint)" : ""}`}>
          <TypeIcon kind={i.icon || i.kind} /><span className="tlabel">{i.title}</span>
        </div>
      </div>
      {i.late ? <CalIssueBtn i={i} /> : null}
    </div>
  ));
}

function UpcomingList({ pid, n }) {
  const t = E.today();
  const items = E.calItems(t, E.addDays(t, n), pid, { event: 1, task: 1, data: 1, ho: 1, doc: 1, recur: 1, wbs: 0 }).filter((i) => !i.done).slice(0, 25);
  return <ItemList items={items} showDate />;
}

export default function Calendar() {
  const { S } = useStore();
  const set = E.calProjSet(), pid = set.length ? set : null;
  const ym = S.ui.calMonth || E.today().slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const rows = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
  const start = E.fmtD(new Date(y, m - 1, 1 - first.getDay()));
  const byDay = {};
  E.calItems(start, E.addDays(start, rows * 7 - 1), pid).forEach((i) => (byDay[i.date] = byDay[i.date] || []).push(i));
  const t = E.today(), sel = S.ui.calSel || t;
  const monthItems = E.calItems(`${ym}-01`, E.fmtD(new Date(y, m, 0)), pid);
  const selItems = E.calItems(sel, sel, pid);
  const days = Array.from({ length: rows * 7 }, (_, n) => E.addDays(start, n));

  return (
    <>
      <PageHead title="캘린더" meta="" actions={<button className="btn primary" onClick={() => E.editEvent(null, sel)}>+ 일정 추가</button>} />
      <div className="cal-bar">
        <button className="btn sm icon-btn" onClick={() => E.calMove(-1)} title="이전 달" aria-label="이전 달"><Raw html={E.ICO_PREV} style={{ display: "contents" }} /></button>
        <b className="cal-title">{y}년 {m}월</b>
        <button className="btn sm icon-btn" onClick={() => E.calMove(1)} title="다음 달" aria-label="다음 달"><Raw html={E.ICO_NEXT} style={{ display: "contents" }} /></button>
        {" "}<button className="btn sm ghost" onClick={() => { S.ui.calMonth = ""; S.ui.calSel = ""; E.render(); }}>오늘</button>
      </div>
      <div className="filters">
        <ProjChips k="calProjs" />{" "}
        <span className="f-right">
          {E.CAL_KINDS.map(([k, l]) => (
            <button key={k} className={`chip kchip ${S.ui.calKinds[k] ? "active" : ""}`}
              onClick={() => { S.ui.calKinds[k] = S.ui.calKinds[k] ? 0 : 1; rerender(); }}
              title={S.ui.calKinds[k] ? "누르면 숨기기" : "누르면 보이기"}><TypeIcon kind={k} />{l}</button>
          ))}
        </span>
      </div>
      <div className="cal">
        {[..."일월화수목금토"].map((d, i) => <div key={d} className={`dow ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{d}</div>)}
        {days.map((d) => {
          const dt = E.parseD(d), list = byDay[d] || [], hol = E.holidayName(d);
          return (
            <div key={d} className={`day ${dt.getMonth() !== m - 1 ? "out" : ""} ${d === t ? "today" : ""} ${d === sel ? "sel" : ""}`}
              onClick={() => E.calPick(d)}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("drop"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("drop")}
              onDrop={(e) => { e.currentTarget.classList.remove("drop"); E.calDrop(e.nativeEvent, d); }}>
              {" "}<div className={`num ${dt.getDay() === 0 || hol ? "sun" : dt.getDay() === 6 ? "sat" : ""}`}>{dt.getDate()}</div>
              {hol ? <span className="hol">{hol}</span> : null}
              {list.length ? <div className="dn">{list.length}</div> : null}
              {list.slice(0, 4).map((i, n) => <CalPill key={`${i.kind}|${i.id}|${i.edge || ""}|${n}`} i={i} />)}
              {list.length > 4 ? <div className="more">+{list.length - 4}건 더</div> : null}
            </div>
          );
        })}
      </div>
      <div className="card cal-agenda">
        <div className="card-h"><h3>{m}월 일정</h3><span className="sub">{monthItems.length}건</span></div>
        <ItemList items={monthItems} showDate />
      </div>
      <div className="grid2 mt-[14px]">
        <div className="card">
          <div className="card-h"><h3>{sel} ({E.wd(sel)})</h3><span className="sub">{selItems.length}건</span>
            {" "}<div className="actions">
              <button className="btn sm" onClick={() => E.editEvent(null, sel)}>+ 일정</button>
              <button className="btn sm" onClick={() => E.editTask(null, { due: sel })}>+ 업무</button>
            </div>
          </div>
          <ItemList items={selItems} showDate={false} />
        </div>
        {" "}<div className="card">
          <div className="card-h"><h3>다가오는 14일</h3></div>
          <UpcomingList pid={pid} n={14} />
        </div>
      </div>
    </>
  );
}

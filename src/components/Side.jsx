import { Fragment } from "react";
import { useStore } from "../lib/store.js";
import * as E from "../legacy/engine.js";

// 왼쪽 메뉴: 프로젝트 목록(빨간 숫자 = 위험 경고) + 화면 메뉴(경고 수·진행 중 수). 오프라인판 renderSide·renderTabs
const TASK_KINDS = ["마감 지연", "정기 업무 지남", "개발 기한 지남", "테스트 대기"];

export default function Side() {
  const { S } = useStore();
  const fold = !!S.ui.sideFold;
  const all = E.computeAlerts(null);
  const danger = (pid) => all.filter((a) => (pid ? a.pid === pid : true) && a.level === "danger").length;
  const archived = S.projects.filter((p) => p.archived);

  const Proj = ({ id, name, color, n }) => (
    <div className={`proj ${S.ui.pid === id ? "active" : ""}`} title={name} onClick={() => E.selProject(id)}>
      <span className="dot" style={color ? { background: color } : undefined}></span><span className="nm">{name}</span>{n ? <span className="cnt">{n}</span> : null}
    </div>
  );

  return (
    <aside className="side" id="side">
      <h3 className="side-h">
        <span className="side-h-t">프로젝트</span>
        <button className="ico-btn side-fold-btn" onClick={() => E.toggleSide()} title={fold ? "메뉴 펴기" : "메뉴 접기"}>
          <svg className="ico" viewBox="0 0 24 24" style={{ width: 16, height: 16, margin: 0 }}><path d={fold ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} /></svg>
        </button>
      </h3>
      <div className="proj-list">
        <Proj id="all" name="전체 보기 (PMO)" color="" n={danger(null)} />
        {E.activeProjects().map((p) => <Proj key={p.id} id={p.id} name={p.name} color={p.color} n={danger(p.id)} />)}
        <button className="btn sm add" onClick={() => E.editProject()}>＋ 프로젝트 추가</button>
      </div>
      {archived.length > 0 && (
        <div className="archived">
          <h3>보관됨</h3>
          {archived.map((p) => (
            <div key={p.id} className="proj" onClick={() => E.editProject(p.id)}><span className="dot"></span><span className="nm">{p.name}</span></div>
          ))}
        </div>
      )}
      <Nav />
    </aside>
  );
}

function Nav() {
  const { S } = useStore();
  const pid = S.ui.pid === "all" ? null : S.ui.pid;
  const alerts = E.computeAlerts(pid);
  const label = Object.fromEntries(E.TABS);
  const count = (k) => {
    // 업무 옆 숫자 = 지금 챙길 것만: 마감 지난 업무·정기 업무, 기한 지난 개발, 개발 끝나서 내가 확인할 것(테스트 대기)
    const a = alerts.filter((x) => (E.NAV_ALERT[k] || []).includes(x.ref[0]) && (k !== "tasks" || TASK_KINDS.includes(x.kind)));
    return [a.length, a.some((x) => x.level === "danger")];
  };
  const sc = (x) => (pid ? x.projectId === pid : !E.proj(x.projectId)?.archived);
  const has = { tasks: S.tasks, data: S.datas, ho: S.handoffs, risks: S.risks, docs: S.docs, reqs: E.reqTasks(), screens: S.screens, wbs: S.wbs, funcs: S.funcs, notes: S.notes };
  const empty = (k) => has[k] && !has[k].some(sc) && S.ui.tab !== k;
  // 업무: 회색 = 진행 중인 일 수, 빨강 = 지금 챙길 것
  const openWork = E.workItems(pid).filter((w) => w.open).length;

  const Item = ({ k }) => {
    const [n, red] = count(k), none = empty(k);
    return (
      <div className={`navi ${S.ui.tab === k ? "active" : ""} ${none ? "none" : ""} ${["funcs", "screens", "tc"].includes(k) ? "sub" : ""}`}
        title={none ? "아직 항목 없음" : ""} onClick={() => E.selTab(k)} data-tip={label[k]}>
        <span className="nm">{label[k]}</span><span className="nm-s">{E.NAV_SHORT[k] || label[k]}</span>
        {k === "tasks"
          ? <>{openWork ? <span className="cnt gray" title="진행 중">{openWork}</span> : null}{n ? <span className="cnt" title="챙길 것 (마감 지남·확인 필요)">{n}</span> : null}</>
          : n ? <span className={`cnt ${red ? "" : "gray"}`}>{n}</span> : null}
      </div>
    );
  };

  // 메뉴는 항상 전부, 원래 순서대로. 묶음 사이는 구분선
  return (
    <div id="sideNav" className="side-nav">
      {E.NAV_GROUPS.map(([g, keys], i) => (
        <Fragment key={g}>
          {i > 0 && <div className="nav-sep"></div>}
          {keys.map((k) => <Item key={k} k={k} />)}
        </Fragment>
      ))}
    </div>
  );
}

// 본문 위 경로: 프로젝트 / 전체 보기(또는 프로젝트 이름) / 화면 이름
export function Crumbs() {
  const { S } = useStore();
  const pid = S.ui.pid === "all" ? null : S.ui.pid;
  const label = Object.fromEntries(E.TABS);
  return (
    <nav className="tabs" id="tabs">
      <span className="crumb" onClick={() => E.selProject("all")}>프로젝트</span><span className="sep">/</span>
      <span className="crumb" onClick={() => E.selTab("dash")}>{pid ? E.projName(pid) : "전체 보기"}</span><span className="sep">/</span>
      <b>{label[S.ui.tab] || ""}</b>
    </nav>
  );
}

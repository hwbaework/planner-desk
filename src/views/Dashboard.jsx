import { useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { PageHead, Badge, TypeIcon, IconBtn } from "../components/ui.jsx";

export const tabs = ["dash"];

// 오프라인판 renderDash 와 같은 화면
// (오프라인판 HTML의 태그 사이 줄바꿈이 글자 사이 공백이 되므로 같은 자리에 {" "}를 둔다.
//  표의 칸 사이 공백은 tr 안 공백 노드 대신 앞 칸 끝에 둔다)

// 경고·항목의 ref → 여는 창 (오프라인판 alertRow·todayCard 의 open 표)
function openRef(type, id, pid) {
  ({
    risk: () => E.editRisk(id), req: () => E.editReq(id), screen: () => { E.selProject(pid); E.editScreen(id); }, tc: () => E.editTC(id),
    data: () => E.openData(id), ho: () => E.openHO(id), doc: () => E.editDoc(id), wbs: () => E.editWBS(id), task: () => E.editTask(id), recur: () => E.editRecur(id),
  })[type]?.();
}
// calItems 항목의 click 문자열과 같은 동작
function openCal(i) {
  ({ event: E.editEvent, data: E.openData, task: E.editTask, ho: E.openHO, doc: E.editDoc, recur: E.editRecur, wbs: E.editWBS })[i.kind]?.(i.id);
}
const selTab = (k) => E.selTab(k);

function ProjTag({ id }) {
  return <span className="ptag"><i style={{ background: E.projColor(id) }}></i>{E.projName(id)}</span>;
}

export default function Dashboard() {
  const { S } = useStore();
  const pid = S.ui.pid === "all" ? null : S.ui.pid;
  const alerts = E.computeAlerts(pid);
  const hos = S.handoffs.filter(E.inScope);
  const docs = S.docs.filter(E.inScope);
  const noNoti = alerts.filter((a) => a.kind === "개발 기한 지남").length;
  const openHo = hos.filter(E.isOpenHO).length;
  const reqDocs = docs.filter((d) => d.status === "검토중").length;
  const mine = alerts.filter((a) => a.kind === "테스트 대기").length;
  const openTasks = S.tasks.filter((x) => E.inScope(x) && E.isOpenTask(x)).length;

  if (pid) {
    const p = E.proj(pid);
    const span = p.start || p.end ? `${p.start || "?"} ~ ${p.end || "?"}${p.end ? ` · 종료 ${E.dday(p.end)}` : ""}` : "기간 미입력";
    return (
      <>
        <PageHead title={p.name} meta={`${p.client || "고객사 미입력"} · ${span}${p.pm ? " · PM " + p.pm : ""}${p.devLead ? " · 개발업체 " + p.devLead : ""}`}
          actions={<><button className="btn" onClick={() => E.editProject(pid)}>프로젝트 정보</button><button className="btn primary" onClick={() => E.editTask()}>＋ 업무 추가</button></>} />
        {(p.links || []).length ? <AccessCard p={p} pid={pid} /> : null}
        <ConceptCard p={p} pid={pid} />
        <TodayCard pid={pid} alerts={alerts} />
        <ProjDash pid={pid} />
        <div className="mt-[14px]"><MissingCard pid={pid} /></div>
      </>
    );
  }

  const kpis = [
    [noNoti, "danger", () => E.goWork("ho"), "개발 기한 지남", "완료 예정일이 지난 개발"],
    [openHo, "", () => E.goWork("ho"), "진행 중 개발 전달", "검수완료 전 건"],
    [reqDocs, "warn", () => selTab("docs"), "승인 대기 산출물", "검토요청 상태"],
    [mine, "ok", () => E.goWork("ho"), "테스트 대기", "개발이 끝나 테스트할 건"],
    [openTasks, "", () => { S.ui.taskFilter = "open"; selTab("tasks"); }, "진행 중 업무", "완료 전 업무"],
  ];
  const shown = kpis.filter((k) => k[0]), zero = kpis.filter((k) => !k[0]);
  const wk = E.weekSummary(pid);
  // (오프라인판의 '수행방법론 진척' 칸은 pid가 있을 때만 그리는데, 그 경우 위에서 이미 끝나므로 전체 보기에서는 항상 프로젝트별 현황 표)
  return (
    <>
      <PageHead title="전체 프로젝트 현황" meta={`진행 프로젝트 ${E.activeProjects().length}개`}
        actions={<button className="btn primary" onClick={() => E.editProject()}>＋ 프로젝트</button>} />
      <TodayCard pid={pid} alerts={alerts} />
      {shown.length ? (
        <div className="kpis grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
          {shown.map(([v, c, on, l, hh]) => <div key={l} className={`kpi ${c}`} onClick={on}><div className="l">{l}</div><div className="v">{v}</div><div className="h">{hh}</div></div>)}
        </div>
      ) : null}
      {zero.length ? <div className="small muted mt-[-6px] mb-3">없음: {zero.map((k) => k[3]).join(" · ")}</div> : null}
      <div className="week">
        {" "}<div className="wk"><span className="wk-i"><TypeIcon kind="task" /></span><div><b>{wk.done}건 완료</b><div className="small muted">지난 7일간</div></div></div>
        {" "}<div className="wk"><span className="wk-i"><TypeIcon kind="wbs" /></span><div><b>{wk.upd}건 업데이트</b><div className="small muted">지난 7일간</div></div></div>
        {" "}<div className="wk"><span className="wk-i"><TypeIcon kind="doc" /></span><div><b>{wk.made}건 생성</b><div className="small muted">지난 7일간</div></div></div>
        {" "}<div className="wk cursor-pointer" onClick={() => selTab("cal")}><span className="wk-i"><TypeIcon kind="event" /></span><div><b>{wk.due}건 마감 예정</b><div className="small muted">다음 7일 이내</div></div></div>
      </div>
      <ProjTable />
      <div className="grid2 mt-[14px]">
        {" "}<div className="card"><div className="card-h"><h3>확인 필요</h3><span className="sub">{alerts.length}건 · 노티가 안 온 건 / 내가 처리할 건</span></div>
          {" "}{alerts.length ? alerts.slice(0, 30).map((a, i) => <AlertRow key={i} a={a} />) : <div className="empty">지금은 확인할 게 없어</div>}</div>
        {" "}<div><div className="card"><div className="card-h"><h3>다가오는 일정</h3><span className="sub">오늘부터 14일</span><div className="actions"><IconBtn icon="calendar" title="캘린더 보기" onClick={() => selTab("cal")} /></div></div><UpcomingList pid={pid} n={14} /></div>
          {" "}<div className="card"><div className="card-h"><h3>상태 개요</h3><span className="sub">업무 상태 · 항목 유형</span><div className="actions"><button className="btn sm" onClick={() => selTab("tasks")}>모든 업무 보기</button></div></div><div className="card-b"><StatusOverview pid={pid} /></div></div>
          {" "}<div className="card"><div className="card-h"><h3>최근 활동</h3></div><div className="card-b"><RecentActivity pid={pid} /></div></div></div>
        {" "}
      </div>
      <div className="mt-[14px]"><MissingCard pid={pid} /></div>
    </>
  );
}

// 시스템 접속: 링크는 바로 열고, 아이디·비밀번호는 복사 (비밀번호는 가려서)
function AccessCard({ p, pid }) {
  const [shown, setShown] = useState({});
  return (
    <div className="card access">
      <div className="card-h"><h3>시스템 접속</h3><span className="sub">{p.links.length}개</span><div className="actions"><IconBtn icon="edit" title="편집" onClick={() => E.editProject(pid)} /></div></div>
      {p.links.map((l, i) => (
        <div key={i} className="acc-row"><b className="acc-n">{l.name || "시스템"}</b>
          {" "}{l.url ? <a className="acc-url" href={l.url} target="_blank" rel="noopener">{l.url}</a> : null}
          {" "}{l.user ? <><span className="acc-k">아이디</span><span className="mono">{l.user}</span><IconBtn icon="copy" title="아이디 복사" onClick={() => E.copyText(l.user, "아이디 복사됨")} /></> : null}
          {" "}{l.pass ? <><span className="acc-k">비밀번호</span><span className="mono" id={`accp${i}`}>{shown[i] ? l.pass : "••••••"}</span><IconBtn icon={shown[i] ? "eyeOff" : "eye"} title={shown[i] ? "가리기" : "보기"} onClick={() => setShown({ ...shown, [i]: !shown[i] })} /><IconBtn icon="copy" title="비밀번호 복사" onClick={() => E.copyText(l.pass, "비밀번호 복사됨")} /></> : null}
          {" "}{l.memo ? <span className="small muted">{l.memo}</span> : null}</div>
      ))}
    </div>
  );
}

// 사업 기본 개념: 매번 잊는 구조·출처·연락처를 프로젝트 첫 화면에
function ConceptCard({ p, pid }) {
  const { S } = useStore();
  const open = !(S.ui.conceptFold || {})[pid];
  const fold = () => { S.ui.conceptFold = S.ui.conceptFold || {}; S.ui.conceptFold[pid] = open ? 1 : 0; E.persistUI(); E.render(); };
  return (
    <div className="card concept">
      <div className="card-h">
        <button className="tl-fold" onClick={fold} title={open ? "접기" : "펼치기"}><svg className="ico w-[14px] h-[14px] m-0" viewBox="0 0 24 24"><path d={open ? "m6 9 6 6 6-6" : "m9 18 6-6-6-6"} /></svg></button>
        <h3>메모</h3><div className="actions"><IconBtn icon="edit" title="편집" onClick={() => E.editProject(pid)} /></div>
      </div>
      {open ? (p.memo ? <div className="concept-b"><Concept t={p.memo} /></div> : <div className="empty">메모 없음 · [편집]</div>) : null}
    </div>
  );
}
// 오프라인판 conceptHtml: [제목] 줄은 소제목, "- " 줄은 항목, 들여쓴 "·" 줄은 하위 항목으로
function Concept({ t }) {
  return String(t).split(/\r?\n/).map((l, i) => {
    const x = l.trim();
    if (!x) return <div key={i} className="cc-gap"></div>;
    const m = x.match(/^\[(.+?)\]\s*(.*)$/);
    if (m) return <div key={i} className="cc-h">{m[1]}{m[2] ? <>{" "}<span className="muted small">{m[2]}</span></> : null}</div>;
    if (/^[-•]\s*/.test(x)) return <div key={i} className="cc-li">{x.replace(/^[-•]\s*/, "")}</div>;
    if (/^[·*]\s*/.test(x) || /^\s{2,}/.test(l)) return <div key={i} className="cc-sub">{x.replace(/^[·*]\s*/, "")}</div>;
    return <div key={i} className="cc-p">{x}</div>;
  });
}

// 아침에 열면 바로 보는 칸: 지난 것 / 오늘 / 이번 주
const OVERDUE_KINDS = ["마감 지연", "정기 업무 지남", "데이터 미수신", "개발 기한 지남", "승인 회신 없음", "테스트 대기", "결함 미전달", "재테스트 필요", "이슈·리스크 기한 지남", "WBS 지연", "산출물 일정 지연"];
function TodayCard({ pid, alerts }) {
  const t = E.today();
  const overdue = alerts.filter((a) => OVERDUE_KINDS.includes(a.kind));
  const todays = E.calItems(t, t, pid, { event: 1, task: 1, data: 1, ho: 1, doc: 1, recur: 1, wbs: 1 }).filter((i) => !i.done);
  const week = E.calItems(E.addDays(t, 1), E.addDays(t, 7), pid, { event: 1, task: 1, data: 1, ho: 1, doc: 1, recur: 1, wbs: 0 }).filter((i) => !i.done);
  const m = E.missingDates(pid), miss = m.task.length + m.wbs.length + m.doc.length;
  const al = (a, k) => {
    const [type, id] = a.ref;
    return (
      <div key={k} className="td-i" onClick={() => openRef(type, id, a.pid)}><span className={`td-k ${a.level}`}>{a.due ? "지연" : a.kind}</span>
        {a.due ? <span className="td-due">{E.shortD(a.due).replace(/\(.\)$/, "")} {a.dueL} · {a.days}일</span> : null}<span className="nm">{a.title}</span></div>
    );
  };
  const it = (i, d, k) => <div key={k} className="td-i" onClick={() => openCal(i)}><TypeIcon kind={i.icon || i.kind} /><span className="nm">{d ? <><b>{E.shortD(i.date)}</b>{" "}</> : null}{i.title}</span></div>;
  const col = (title, n, items, more, empty) => (
    <div className="td-col"><div className="td-h">{title} <span className={`cnt ${n ? "" : "gray"}`}>{n}</span></div>
      {items.length ? <>{items}{more}</> : <div className="small muted py-[6px]">{empty}</div>}</div>
  );
  return (
    <div className="card td">
      <div className="card-h"><h3>오늘 할 일</h3><span className="sub">{t} ({E.wd(t)})</span>
        {" "}{miss ? <div className="actions"><button className="btn sm" onClick={() => document.getElementById("missingCard")?.scrollIntoView({ behavior: "smooth" })}>날짜 없는 항목 {miss}건</button></div> : null}</div>
      {" "}<div className="td-grid">
        {col("지난 것 · 확인 필요", overdue.length, overdue.slice(0, 8).map(al), overdue.length > 8 ? <div className="small muted">외 {overdue.length - 8}건</div> : null, "밀린 일 없음")}
        {" "}{col("오늘", todays.length, todays.map((i, k) => it(i, false, k)), null, "오늘 잡힌 일정 없음")}
        {" "}{col("이번 주", week.length, week.slice(0, 8).map((i, k) => it(i, true, k)), week.length > 8 ? <div className="small muted">외 {week.length - 8}건</div> : null, "다음 7일 일정 없음")}
      </div>
    </div>
  );
}

// 프로젝트 한 곳의 현황: 상태 개요 · 메뉴별 화면 (날짜 없는 항목은 아래에서)
function ProjDash({ pid }) {
  const { S } = useStore();
  const T = E.wbsTree(pid), isGrp = (w) => (T.kids[w.code] || []).length || T.level(w) === 1;
  const leafOf = (w) => (isGrp(w) ? (T.kids[w.code] || []).flatMap(leafOf) : [w]);
  const scOf = (w) => S.screens.find((x) => x.id === (w.screenIds || [])[0]);
  const all = T.roots.flatMap(leafOf), avg = (l) => (l.length ? Math.round(l.reduce((a, w) => a + E.wbsLeafProg(w).progress, 0) / l.length) : 0);
  const cnt = (l, f) => { const n = l.filter(f).length; return <span className={n === l.length && l.length ? "ok-t" : ""}>{n}/{l.length}</span>; };
  return (
    <>
      <div className="card"><div className="card-h"><h3>상태 개요</h3></div><div className="card-b"><StatusOverview3 pid={pid} /></div></div>
      <div className="card mt-[14px]">
        <div className="card-h"><h3>메뉴별 화면</h3><span className="sub">{all.length}개 화면</span><div className="actions"><button className="btn sm" onClick={() => selTab("wbs")}>WBS</button></div></div>
        {" "}<div className="tbl-wrap"><table className="t"><thead><tr><th className="w-[1%]">ID</th><th>메뉴</th><th className="w-[30%]">진척</th><th className="nowrap w-[1%]">화면설계 확정</th><th className="nowrap w-[1%]">기능정의서</th><th className="nowrap w-[1%]">테스트 케이스</th></tr></thead><tbody>
          {T.roots.length ? T.roots.map((w) => {
            const l = leafOf(w), pc = avg(l);
            const late = l.filter((x) => x.end && x.end < E.today() && E.wbsLeafProg(x).progress < 100).length;
            return (
              <tr key={w.id}><td className="mono small nowrap">{w.wid || ""}</td><td><b>{w.title}</b> <span className="small muted">{l.length}</span>{late ? <>{" "}<span className="badge b-red">지연 {late}</span></> : null}{" "}</td>
                <td><div className="flex items-center gap-2"><span className="ov-bar"><i style={{ width: `${pc}%` }}></i></span><span className="small w-[36px] text-right">{pc}%</span></div>{" "}</td>
                <td className="nowrap small text-center">{cnt(l, (x) => scOf(x)?.status === "확정")}{" "}</td>
                <td className="nowrap small text-center cursor-pointer" onClick={() => selTab("funcs")}>{cnt(l, (x) => x.fdDone)}{" "}</td>
                <td className="nowrap small text-center cursor-pointer" onClick={() => selTab("tc")}>{cnt(l, (x) => x.tcDone)}</td></tr>
            );
          }) : <tr><td colSpan={6} className="empty">메뉴별 WBS가 아직 없어</td></tr>}
        </tbody></table></div>
      </div>
    </>
  );
}

// 전체 보기: 프로젝트별 현황 표
function ProjTable() {
  const { S } = useStore();
  const ps = E.activeProjects();
  return (
    <div className="card"><div className="card-h"><h3>프로젝트별 현황</h3></div><div className="tbl-wrap"><table className="t"><thead><tr>
      <th>{" "}프로젝트</th><th>현재 단계</th><th>산출물 승인</th><th className="nowrap">진행 업무</th><th className="nowrap">데이터 협의</th><th className="nowrap">진행 전달</th><th className="nowrap">노티 미수신</th><th>지연</th><th>종료</th></tr></thead><tbody>
      {ps.length ? ps.map((p) => {
        const a = E.computeAlerts(p.id); const s = E.docStats(p.id); const ph = E.currentPhase(p.id);
        const pct = s.total ? Math.round((s.ok / s.total) * 100) : 0;
        const ds = S.datas.filter((x) => x.projectId === p.id && x.status !== "보류");
        const nd = a.filter((x) => x.level === "danger").length;
        return (
          <tr key={p.id}><td className="link" onClick={() => E.selProject(p.id)}><ProjTag id={p.id} />{" "}</td>
            <td>{ph ? <span className="badge text-white" style={{ background: E.phaseColor(ph) }}>{ph} {E.phase(ph).name}</span> : <span className="muted">-</span>}{" "}</td>
            <td className="nowrap">{s.ok}/{s.total} <span className="muted">({pct}%)</span>{" "}</td>
            <td className="num">{S.tasks.filter((x) => x.projectId === p.id && E.isOpenTask(x)).length}{" "}</td>
            <td className="nowrap">{ds.length ? <>{ds.filter((x) => x.status === "수신 완료").length}/{ds.length} <span className="muted small">수신</span></> : <span className="muted">-</span>}{" "}</td>
            <td className="num">{S.handoffs.filter((x) => x.projectId === p.id && E.isOpenHO(x)).length}{" "}</td>
            <td className="num">{nd ? <Badge cls="red">{nd}</Badge> : "0"}{" "}</td>
            <td className="num">{a.filter((x) => x.level === "warn").length}{" "}</td>
            <td className="nowrap">{p.end ? <>{p.end} <span className="muted">{E.dday(p.end)}</span></> : "-"}</td></tr>
        );
      }) : <tr><td colSpan={9} className="empty">프로젝트 없음</td></tr>}
    </tbody></table></div></div>
  );
}

// 상태 개요 도넛 (업무 상태 분포)
function Donut({ parts, center, sub }) {
  const total = parts.reduce((a, p) => a + p[1], 0), R = 52, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = total ? parts.filter((p) => p[1]).map(([l, v, color]) => {
    const len = (v / total) * C;
    const a = <circle key={l} r={R} cx="70" cy="70" fill="none" stroke={color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />;
    off += len; return a;
  }) : <circle r={R} cx="70" cy="70" fill="none" stroke="var(--line)" strokeWidth="18" />;
  return (
    <div className="donut"><svg viewBox="0 0 140 140" width="140" height="140">{arcs}<text x="70" y="68" textAnchor="middle" className="dn-v">{center}</text><text x="70" y="88" textAnchor="middle" className="dn-l">{sub}</text></svg>
      {" "}<div className="dn-legend">{parts.map(([l, v, c]) => <div key={l}><i style={{ background: c }}></i>{l} <b>{v}</b></div>)}</div></div>
  );
}
function StatusOverview3({ pid }) {
  const { S } = useStore();
  const of = (list, sts) => sts.map(([l, c, f]) => [l, list.filter(f).length, c]);
  const ts = S.tasks.filter((x) => x.projectId === pid), rs = S.risks.filter((x) => x.projectId === pid), ds = S.docs.filter((x) => x.projectId === pid && x.status !== "해당없음");
  // 가운데는 아직 안 끝난 수, 제목 옆에 전체 수
  const box = (title, tab, parts, n) => {
    const left = parts.filter(([l]) => l !== "완료").reduce((x, p) => x + p[1], 0);
    return <div className="ov3 cursor-pointer" onClick={() => selTab(tab)}><div className="ov3-h">{title} <span className="muted font-medium">전체 {n}</span></div><Donut parts={parts} center={left} sub="남음" /></div>;
  };
  return (
    <div className="ov3-wrap">
      {box("업무", "tasks", of(ts, [["진행중", "#1d7afc", (x) => x.status === "진행중" && !E.isFutureTask(x)], ["대기", "#f18d13", (x) => x.status === "대기"], ["예정", "#8590a2", E.isFutureTask], ["완료", "#22a06b", (x) => x.status === "완료"]]), ts.length)}
      {box("이슈 · 리스크", "risks", of(rs, [["오픈", "#e2483d", (x) => (x.status || "오픈") === "오픈"], ["진행", "#1d7afc", (x) => x.status === "진행"], ["완료", "#22a06b", (x) => x.status === "완료"]]), rs.length)}
      {box("산출물", "docs", of(ds, E.DOC_ST.filter((k) => k !== "해당없음").map((k) => [k, { 미착수: "#8590a2", 작성중: "#1d7afc", 검토중: "#f18d13", 완료: "#22a06b" }[k] || "#8590a2", (x) => x.status === k])), ds.length)}
    </div>
  );
}
function StatusOverview({ pid }) {
  const { S } = useStore();
  const sc = (x) => (pid ? x.projectId === pid : !E.proj(x.projectId)?.archived);
  const ts = S.tasks.filter(sc);
  const parts = [["진행중", ts.filter((x) => x.status === "진행중" && !E.isFutureTask(x)).length, "#1d7afc"], ["대기", ts.filter((x) => x.status === "대기").length, "#f18d13"],
    ["예정", ts.filter(E.isFutureTask).length, "#8590a2"], ["완료", ts.filter((x) => x.status === "완료").length, "#22a06b"]];
  const types = [["task", "업무", ts.length], ["ho", "개발 전달", S.handoffs.filter(sc).length], ["doc", "산출물", S.docs.filter((d) => sc(d) && d.status !== "해당없음").length],
    ["bug", "이슈", S.risks.filter(sc).length], ["wbs", "화면", S.screens.filter(sc).length]];
  const max = Math.max(1, ...types.map((x) => x[2]));
  return (
    <div className="ov"><Donut parts={parts} center={ts.length} sub={pid ? "업무" : "전체 업무"} />
      {" "}<div className="ov-types"><div className="small muted mb-[6px]">항목 유형</div>
        {types.map(([k, l, n]) => <div key={k} className="ov-row"><TypeIcon kind={k} /><span className="tlabel w-[78px]">{l}</span><span className="ov-bar"><i style={{ width: `${(n / max) * 100}%` }}></i></span><b>{n}</b></div>)}</div></div>
  );
}

// 오프라인판 upcomingList → itemList(…, true)
function UpcomingList({ pid, n }) {
  const t = E.today();
  const items = E.calItems(t, E.addDays(t, n), pid, { event: 1, task: 1, data: 1, ho: 1, doc: 1, recur: 1, wbs: 0 }).filter((i) => !i.done).slice(0, 25);
  if (!items.length) return <div className="empty">일정 없음</div>;
  return items.map((i, k) => (
    <div key={k} className="alert cursor-pointer" onClick={() => openCal(i)}><span className="ic" style={{ background: E.projColor(i.pid) }}></span><div className="body">
      {" "}<div className="d"><b>{E.shortD(i.date)}</b> · {E.CAL_TAG[i.kind] || i.sub || "일정"} · {E.projName(i.pid)}{i.late ? <span className="late-tag">{E.calDays(i.date)}일 지남</span> : null}</div>
      {" "}<div className="tt" style={i.done ? { textDecoration: "line-through", color: "var(--faint)" } : undefined}><TypeIcon kind={i.icon || i.kind} /><span className="tlabel">{i.title}</span></div></div>
      {i.late ? <CalIssueBtn i={i} /> : null}</div>
  ));
}
function CalIssueBtn({ i }) {
  const { S } = useStore();
  const r = S.risks.find((x) => x.srcRef === `${i.kind}:${i.id}`);
  return r ? <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); E.editRisk(r.id); }} title="이 항목으로 등록한 이슈">{r.code}</button>
    : <button className="btn sm" onClick={(e) => { e.stopPropagation(); E.calToIssue(i.kind, i.id, i.date); }}>이슈로</button>;
}

// 날짜 없는 항목: 여기서 넣지 않고, 눌러서 그 메뉴로 가서 넣음
function MissingCard({ pid }) {
  const m = E.missingDates(pid), total = m.task.length + m.wbs.length + m.doc.length;
  if (!total) return null;
  const go = (x, tab) => { E.selProject(x.projectId); E.selTab(tab); };
  const row = (kind, x, title, on) => (
    <div key={x.id} className="mrow row-click cursor-pointer" onClick={on}><TypeIcon kind={kind} /><span className="nm" title={title}>{title}</span>
      {pid ? null : <span className="small muted max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap"><ProjTag id={x.projectId} /></span>}</div>
  );
  const sec = (l, list, f, tab, tl) => list.length ? (
    <>
      <div className="sec-t flex items-center">{l} {list.length}<span className="flex-1"></span><button className="btn sm ghost" onClick={() => (pid ? selTab(tab) : go(list[0], tab))}>{tl} →</button></div>
      {list.slice(0, 5).map(f)}
      {list.length > 5 ? <div className="small muted pt-[2px] pb-[6px]">외 {list.length - 5}건</div> : null}
    </>
  ) : null;
  return (
    <div className="card" id="missingCard"><div className="card-h"><h3>날짜 없는 항목</h3><span className="sub">{total}건</span></div><div className="card-b">
      {sec("마감일 없는 업무", m.task, (x) => row("task", x, x.title, () => { go(x, "tasks"); E.editTask(x.id); }), "tasks", "업무")}
      {sec("일정 없는 WBS", m.wbs, (x) => row("wbs", x, `${x.wid ? x.wid + " " : ""}${x.title}`, () => go(x, "wbs")), "wbs", "WBS")}
      {sec("계획일 없는 산출물", m.doc, (x) => row("doc", x, `${x.phase} ${x.name}`, () => go(x, "docs")), "docs", "산출물")}
    </div></div>
  );
}

function AlertRow({ a }) {
  const { S } = useStore();
  const [type, id] = a.ref;
  let acts = null;
  if (type === "ho" && a.level !== "mine") acts = <><IconBtn icon="copy" title="독촉 문구 복사" onClick={() => E.copyNudge(id)} /><IconBtn icon="mail" title="메일 작성창 열기" onClick={() => E.mailNudge(id)} /><button className="btn sm" onClick={() => E.openHO(id, "ack")}>회신 기록</button></>;
  if (type === "ho" && a.level === "mine") acts = <><button className="btn sm" onClick={() => E.quickEvent(id, "verified")}>검수 완료</button><button className="btn sm" onClick={() => E.openHO(id, "reject")}>반려</button></>;
  if (type === "task") acts = <button className="btn sm" onClick={() => E.setTask(id, "status", "완료")}>완료</button>;
  if (type === "doc" && a.kind === "승인 회신 없음") acts = <button className="btn sm" onClick={() => E.setDocStatus(id, "승인")}>승인 받음</button>;
  return (
    <div className={`alert ${a.level}`}><span className="ic"></span><div className="body">
      {" "}<div className="k">{a.kind}{S.ui.pid === "all" ? <>{" · "}<span className="muted">{E.projName(a.pid)}</span></> : null}</div>
      {" "}<div className="tt" onClick={() => openRef(type, id, a.pid)}>{a.title}</div><div className="d">{a.desc}</div></div><div className="acts">{acts}</div></div>
  );
}

const AUTO = /요구사항에서 옮김|데이터 협의에서 옮김|이 업무로 합침|\(상태 정리\)|\(사업 쪽 관리 항목\)/;
function RecentActivity({ pid }) {
  const { S } = useStore();
  const items = [];
  // text: 오프라인판이 자동 기록을 걸러내던 글 (같은 내용, 태그만 뺀 것)
  S.handoffs.filter((h) => !pid || h.projectId === pid).forEach((h) => h.events.forEach((e) => {
    const tail = `${E.evLabel(e.type)}${e.text ? " — " + e.text.split("\n")[0].slice(0, 60) : ""}`;
    items.push({ at: e.at, ts: e.ts || "", b: `[${h.code}]`, tail, cls: E.RESP_EV.includes(e.type) ? "resp" : E.MINE_EV.includes(e.type) ? "mine" : "", click: () => E.openHO(h.id) });
  }));
  S.docs.filter((d) => !pid || d.projectId === pid).forEach((d) => d.history.forEach((e) => items.push({ at: e.at, ts: e.ts || "", b: d.name, tail: e.text, cls: e.text.includes("승인") ? "resp" : "", click: () => E.editDoc(d.id) })));
  S.tasks.filter((t) => !pid || t.projectId === pid).forEach((t) => (t.log || []).forEach((e) => items.push({ at: e.at, ts: e.ts || "", b: t.title, tail: e.type === "status" ? e.text : "— " + e.text.split("\n")[0].slice(0, 60), cls: e.type === "status" ? "mine" : "resp", click: () => E.editTask(t.id) })));
  const real = items.filter((i) => !AUTO.test(`${i.b} ${i.tail}`)).sort((a, b) => (b.at + b.ts).localeCompare(a.at + a.ts));
  if (!real.length) return <div className="empty">아직 기록이 없어</div>;
  return <ul className="tl">{real.slice(0, 14).map((i, k) => <li key={k} className={i.cls}><div className="h">{E.shortD(i.at)}</div><div className="x cursor-pointer" onClick={i.click}><b>{i.b}</b> {i.tail}</div></li>)}</ul>;
}

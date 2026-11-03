import { useStore } from "../lib/store.js";
import * as E from "../legacy/engine.js";
import { PageHead, Badge, Raw } from "../components/ui.jsx";

export const tabs = ["screens"];

// 오프라인판 needProject
export function NeedProject({ what }) {
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

// 경로 칸 (화면설계서·기능정의서·테스트 케이스 위치). dblEdit가 칸 안을 직접 바꾸므로 그릴 때마다 새로 만든다(key)
export function PathCard({ label, pid, fileKey, path, ver }) {
  return (
    <div className="card mb-3 px-[14px] py-[10px] flex items-center gap-[10px] flex-wrap">
      <b className="small">{label}</b>{" "}
      <span key={ver} className="mono small dbl-edit flex-1 min-w-[200px] break-all" onClick={(e) => E.dblEdit(e.currentTarget, pid, fileKey, "projects")}>
        {path ? path : <span className="muted">경로</span>}
      </span>{" "}
      {path ? (
        <>
          <button className="btn sm ghost" onClick={() => E.openPath(path)}><Raw html={E.ICO_FOLDER} style={{ display: "contents" }} /> 열기</button>
          <button className="btn sm ghost" onClick={() => E.copyText(path, "경로 복사됨 — 탐색기 주소창에 붙여넣기")}>복사</button>
        </>
      ) : null}
    </div>
  );
}

function ScreenRow({ s, lv, pid, ver }) {
  const S = E.S;
  const ho = s.hoId && S.handoffs.find((x) => x.id === s.hoId);
  return (
    <tr className={`${E.SCREEN_ROW[s.status] || ""} row-click`} onClick={(e) => E.rowClick(e.nativeEvent, () => E.editScreen(s.id))}>
      <td className="mono nowrap">{" "}{s.code}</td>
      <td style={{ paddingLeft: 8 + lv * 16 }}>{" "}
        <span className="link" onClick={() => E.editScreen(s.id)}>{s.name}</span>
        {s.url ? <>{" "}<a className="ico-btn" href={s.url} target="_blank" rel="noopener" title={s.url}><Raw html={E.ICO_LINK} style={{ display: "contents" }} /></a></> : null}
        {s.path ? <>{" "}<button className="ico-btn" onClick={() => E.openPath(s.path)} title={s.path}><Raw html={E.ICO_FOLDER} style={{ display: "contents" }} /></button></> : null}
      </td>
      <td className="nowrap">{" "}<i className="sc-dot"></i>
        <select className="inline" value={s.status ?? ""} onChange={(e) => E.setScreen(s.id, "status", e.target.value)}>
          {E.SCREEN_ST.map((x) => <option key={x}>{x}</option>)}
        </select>
      </td>
      <td key={"o" + ver} className="nowrap dbl-edit" onDoubleClick={(e) => E.dblEdit(e.currentTarget, s.id, "owner")}>{" "}{s.owner || ""}</td>
      <td className="nowrap">{" "}
        {ho ? (
          <><span className="link mono small" onClick={() => E.openHO(ho.id)}>{ho.code}</span>{" "}<Badge cls={E.HO_CLS[ho.status]}>{E.hoStLabel(ho.status)}</Badge></>
        ) : (
          <button className="btn sm ghost" onClick={() => E.editHO(null, { screenIds: [s.id], projectId: pid, title: `${s.code} ${s.name} 화면 개발 전달` })}>전달 등록</button>
        )}
      </td>
      <td key={"d" + ver} className="nowrap dbl-edit" onDoubleClick={(e) => E.dblEdit(e.currentTarget, s.id, "dev")}>{" "}{s.dev || (ho && ho.to) || ""}</td>
      <td key={"m" + ver} className="small dbl-edit" onDoubleClick={(e) => E.dblEdit(e.currentTarget, s.id, "memo")}>{" "}{s.memo || ""}</td>
    </tr>
  );
}

export default function Screens() {
  const { S, version } = useStore();
  if (S.ui.pid === "all") return <><PageHead title="화면 목록" meta="" /><NeedProject what="화면 목록" /></>;
  const pid = S.ui.pid;
  const q = (S.ui.scQ || "").toLowerCase();
  let list = S.screens.filter((s) => s.projectId === pid);
  const total = list.length;
  if (q) list = list.filter((s) => (s.code + s.name + (s.menu || "")).toLowerCase().includes(q));
  list.sort((a, b) => String(a.code).localeCompare(String(b.code), "ko", { numeric: true }));
  const by = (st) => S.screens.filter((s) => s.projectId === pid && s.status === st).length;
  const sent = S.screens.filter((s) => s.projectId === pid && s.hoId).length;
  const dir = E.proj(pid).screenDir || "";

  // WBS 트리 순서대로: 메뉴·그룹은 머리 줄, 화면은 그 아래 들여써서
  const T = E.wbsTree(pid), shown = new Set();
  const scOf = (w) => (w.screenIds || []).map((id) => list.find((x) => x.id === id)).filter(Boolean);
  const has = (w) => scOf(w).length || (T.kids[w.code] || []).some(has);
  const rows = [];
  const walk = (w) => {
    if (q && !has(w)) return;
    const lv = T.level(w) - 1, ch = T.kids[w.code] || [], scs = scOf(w);
    if (ch.length || lv === 0) rows.push(<tr key={w.id} className="sc-grp"><td className="mono small nowrap">{w.wid || ""}</td><td colSpan={6} style={{ paddingLeft: 8 + lv * 16 }}>{w.title}</td></tr>);
    else if (!scs.length) rows.push(<tr key={w.id}><td className="mono nowrap">{w.wid || ""}</td><td colSpan={6} style={{ paddingLeft: 8 + lv * 16 }}>{w.title}</td></tr>);
    scs.forEach((x) => { if (!shown.has(x.id)) { shown.add(x.id); rows.push(<ScreenRow key={x.id} s={x} lv={lv} pid={pid} ver={version} />); } });
    ch.forEach(walk);
  };
  T.roots.forEach(walk);
  const rest = list.filter((x) => !shown.has(x.id));
  if (rest.length) {
    const linked = shown.size;
    if (linked) rows.push(<tr key="_unlinked" className="sc-grp"><td></td><td colSpan={6}>WBS 미연결</td></tr>);
    rest.forEach((x) => rows.push(<ScreenRow key={x.id} s={x} lv={linked ? 1 : 0} pid={pid} ver={version} />));
  }

  return (
    <>
      <PageHead title="화면 목록 (화면설계서)" meta={`총 ${total}개 · 확정 ${by("확정")} · 검토중 ${by("검토중")} · 작성중 ${by("작성중")} · 변경중 ${by("변경중")} · 개발 전달 ${sent}`} />
      <PathCard label="화면설계서 위치" pid={pid} fileKey="screenDir" path={dir} ver={version} />
      <div className="filters">
        <input className="search" placeholder="화면ID·화면명 검색" defaultValue={S.ui.scQ || ""}
          onChange={(e) => { S.ui.scQ = e.target.value; clearTimeout(window._q); window._q = setTimeout(() => E.render(), 250); }} />
      </div>
      <div className="card"><div className="tbl-wrap"><table className="t">
        <thead><tr><th style={{ width: "1%" }}>화면ID</th><th>화면명</th><th>설계 상태</th><th>기획</th><th>개발 전달</th><th>개발 담당</th><th>비고</th></tr></thead>
        <tbody>{rows.length ? rows : <tr><td colSpan={7} className="empty">화면이 없어. [＋ 화면 추가]로 추가해.</td></tr>}</tbody>
      </table></div></div>
    </>
  );
}

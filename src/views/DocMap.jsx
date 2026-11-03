import { useStore } from "../lib/store.js";
import * as E from "../legacy/engine.js";
import { PageHead, Raw } from "../components/ui.jsx";
import { NeedProject, PathCard } from "./Screens.jsx";

export const tabs = ["funcs", "tc"];

// 오프라인판 renderFuncs / renderTC 가 renderDocMap 에 넘기던 값
const ARGS = {
  funcs: ["기능정의서", "fdFile", "fdDone", "fdLink"],
  tc: ["테스트 케이스", "tcFile", "tcDone", "tcLink"],
};

// 오프라인판 docLinkCell. dblEdit가 칸 안을 직접 바꾸므로 그릴 때마다 새로 만든다(key)
function DocLinkCell({ o, k, coll }) {
  const v = o[k] || "", web = /^https?:/i.test(v), nm = v.replace(/[\\/?#]+$/, "").split(/[\\/]/).pop();
  return (
    <td className="dbl-edit sc-doc" onDoubleClick={(e) => E.dblEdit(e.currentTarget, o.id, k, coll)}>
      {v ? <span className="link small mono" onClick={() => E.openPath(v)} title={nm}><Raw html={web ? E.ICO_LINK : E.ICO_FOLDER} style={{ display: "contents" }} /> {v}</span> : null}
    </td>
  );
}

export default function DocMap() {
  const { S, version } = useStore();
  const [title, fileKey, doneKey, linkKey] = ARGS[S.ui.tab] || ARGS.funcs;
  if (S.ui.pid === "all") return <><PageHead title={title} meta="" /><NeedProject what={title} /></>;
  const pid = S.ui.pid, p = E.proj(pid), path = p[fileKey] || "", T = E.wbsTree(pid);
  const grp = (w) => (T.kids[w.code] || []).length || T.level(w) === 1;   // 1뎁스(맨 위 메뉴)는 하위가 없어도 메뉴 줄
  const leaves = T.coded.filter((w) => !grp(w)), leafOf = (w) => (grp(w) ? (T.kids[w.code] || []).flatMap(leafOf) : [w]);
  const rows = [];
  const walk = (w) => {
    const ch = T.kids[w.code] || [], lv = T.level(w) - 1, g = grp(w), lf = g ? leafOf(w) : null;
    rows.push(
      <tr key={w.id} className={g ? "sc-grp" : w[doneKey] ? "sc-done" : ""}>
        <td className="mono small nowrap">{w.wid || ""}</td>
        <td style={{ paddingLeft: 8 + lv * 16 }}>{w.title}</td>
        <td className="nowrap text-center">{" "}
          {g ? (lf.length ? <span className="small muted">{lf.filter((x) => x[doneKey]).length}/{lf.length}</span> : null)
            : <input type="checkbox" checked={!!w[doneKey]} onChange={(e) => E.setWBS(w.id, doneKey, e.target.checked)} />}
        </td>
        <DocLinkCell key={"l" + version} o={w} k={linkKey} coll="wbs" />
      </tr>
    );
    ch.forEach(walk);
  };
  T.roots.forEach(walk);
  return (
    <>
      <PageHead title={title} meta={`${E.projName(pid)} · 완료 ${leaves.filter((w) => w[doneKey]).length} / ${leaves.length}`} />
      <PathCard label="위치" pid={pid} fileKey={fileKey} path={path} ver={version} />
      <div className="card"><div className="tbl-wrap"><table className="t">
        <thead><tr><th style={{ width: "1%" }}>ID</th><th style={{ width: "30%" }}>WBS</th><th style={{ width: "1%" }}>완료</th><th>위치</th></tr></thead>
        <tbody>{rows.length ? rows : <tr><td colSpan={4} className="empty">메뉴별 WBS가 아직 없어</td></tr>}</tbody>
      </table></div></div>
    </>
  );
}

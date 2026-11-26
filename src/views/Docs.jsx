import { useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { PageHead, Badge, TypeIcon, ChangeInput, IconBtn } from "../components/ui.jsx";

export const tabs = ["docs"];


// 오프라인판 tcChip
function TcChip({ pid, stage, isResult }) {
  const t = E.tcStats(pid, stage); if (!t.total) return null;
  const ready = !t.todo && !t.fail && !t.block;
  return (
    <>
      {" "}<span className="chip-ref cursor-pointer" title={`${stage}테스트 케이스 결과`} onClick={() => { E.selProject(pid); E.selTab("tc"); }}>
        {stage} TC Pass {t.pass}/{t.total}{t.fail ? ` · Fail ${t.fail}` : ""}{t.todo ? ` · 미수행 ${t.todo}` : ""}
      </span>
      {isResult && ready ? <>{" "}<span className="chip-ref" style={{ color: "var(--ok)" }} title="모두 수행, Fail 0">검토요청 가능</span></> : null}
    </>
  );
}

// 오프라인판 reqChip
function ReqChip({ pid }) {
  const l = E.reqTasks(pid); if (!l.length) return null;
  const mapped = l.filter((r) => E.reqScreens(r).length).length;
  return <>{" "}<span className="chip-ref cursor-pointer" onClick={() => E.selTab("reqs")} title="요구사항 현황">요구사항 {l.length} · 화면 반영 {mapped}</span></>;
}

// 오프라인판 docPathHtml: 링크면 열기, 폴더 경로면 복사
function DocPath({ d }) {
  if (!d.path) return <span className="muted small link" onClick={() => E.editDoc(d.id)}>위치 입력</span>;
  const isUrl = /^https?:\/\//i.test(d.path), name = d.path.split(/[\\/]/).filter(Boolean).pop() || d.path;
  return (
    <>
      {isUrl ? <a href={d.path} target="_blank" rel="noopener" title={d.path}>{name}</a> : <span title={d.path}>{name}</span>}
      <IconBtn icon="copy" title="경로 복사" onClick={() => E.copyText(d.path, "경로 복사됨")} />
    </>
  );
}

// 오프라인판 dblEdit(…,'owner','docs'): 더블클릭 → 그 자리에서 입력 (Enter·바깥 클릭 저장, Esc 취소)
function OwnerCell({ d }) {
  const [edit, setEdit] = useState(false);
  const fin = (save, inp) => {
    setEdit(false);
    const nv = inp.value.trim(), ov = d.owner || "";
    if (save && nv !== ov) { d.owner = nv; d.updatedAt = new Date().toISOString(); E.commit(); }
  };
  return (
    <td className="nowrap dbl-edit" onDoubleClick={() => { clearTimeout(window._rowT); setEdit(true); }}>
      {edit ? (
        <input className="dbl-inp" defaultValue={d.owner || ""} autoFocus onFocus={(e) => e.target.select()}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") { e.currentTarget.dataset.cancel = "1"; e.currentTarget.blur(); } }}
          onBlur={(e) => fin(e.currentTarget.dataset.cancel !== "1", e.currentTarget)} />
      ) : <>{d.owner || ""}</>}
    </td>
  );
}

// 오프라인판 reviseDoc: [개정] → 칸이 '개정 내용' 입력으로 바뀌고 Enter·바깥 클릭이면 applyRevise, Esc면 취소
function ReviseCell({ d }) {
  const [edit, setEdit] = useState(false);
  const fin = (save, inp) => {
    setEdit(false);
    const why = inp.value.trim();
    if (save && why) E.applyRevise(d, why);
  };
  return (
    <td className="nowrap">
      {edit ? (
        <input className="dbl-inp" style={{ minWidth: 200 }} placeholder="개정 내용" autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } if (e.key === "Escape") { e.currentTarget.dataset.cancel = "1"; e.currentTarget.blur(); } }}
          onBlur={(e) => fin(e.currentTarget.dataset.cancel !== "1", e.currentTarget)} />
      ) : <><button className="btn sm ghost" onClick={() => setEdit(true)} title="개정(버전업)">개정</button></>}
    </td>
  );
}

function DocRow({ d }) {
  const { S } = useStore();
  const late = d.plan && d.plan < E.today() && !["완료", "해당없음", "검토중"].includes(d.status);
  const waiting = d.status === "검토중" && d.requestedAt ? E.bizDays(d.requestedAt) : null;
  const hoCnt = S.handoffs.filter((x) => x.docIds.includes(d.id)).length;
  return (
    <tr className="row-click" onClick={(e) => E.rowClick(e.nativeEvent, () => E.editDoc(d.id))} style={d.status === "해당없음" ? { opacity: 0.5 } : undefined}>
      <td>
        <span className="link" onClick={() => E.editDoc(d.id)}><TypeIcon kind="doc" /><span className="tlabel">{d.name}</span></span>
        {/테스트 (결과|계획)서|단위테스트/.test(d.name) ? <TcChip pid={d.projectId} stage={/단위/.test(d.name) ? "단위" : "통합"} isResult={/결과서/.test(d.name)} /> : null}
        {/요구사항 정의서/.test(d.name) ? <ReqChip pid={d.projectId} /> : null}
        {hoCnt ? <>{" "}<span className="chip-ref" title="개발 전달 건">전달 {hoCnt}</span></> : null}
      </td>
      <td><select className="inline" value={d.status} onChange={(e) => E.setDocStatus(d.id, e.target.value)}>{E.DOC_ST.map((x) => <option key={x}>{x}</option>)}</select></td>
      <td className="mono nowrap">{d.version || ""}</td>
      <OwnerCell d={d} />
      <td className="nowrap"><ChangeInput type="date" className="inline wdate" style={late ? { color: "var(--danger)", fontWeight: 600 } : undefined} value={d.plan || ""} onCommit={(v) => E.setDocDate(d.id, "plan", v)} /></td>
      <td className="nowrap">
        <ChangeInput type="date" className="inline wdate" value={d.requestedAt || ""} onCommit={(v) => E.setDocDate(d.id, "requestedAt", v)} />
        {waiting !== null ? <>{" "}<span className="small" style={{ color: waiting > S.settings.approvalDays ? "var(--danger)" : "var(--faint)" }}>{waiting}일째</span></> : null}
      </td>
      <td className="nowrap">
        {d.approvedAt ? <>{E.shortD(d.approvedAt)} <span className="muted small">{d.approver || ""}</span></> : d.approver ? <span className="muted small">{d.approver}</span> : <span className="muted">-</span>}
      </td>
      <td className="doc-path"><DocPath d={d} /></td>
      <ReviseCell d={d} />
    </tr>
  );
}

// 오프라인판 renderDocsMatrix
function DocsMatrix() {
  const { S } = useStore();
  const go = (pid) => { S.ui.pid = pid; E.render(); };
  const ps = E.activeProjects();
  return (
    <>
      <PageHead title="산출물 현황 (전체)" meta="프로젝트 × 단계별 승인 현황 · 셀을 누르면 해당 프로젝트로 이동" />
      <div className="card"><div className="tbl-wrap"><table className="t">
        <thead><tr><th>프로젝트</th>{E.PHASES.map((p) => <th key={p.id} style={{ boxShadow: `inset 0 -3px 0 ${p.color}` }}>P.{p.id.slice(1)} {p.name}</th>)}<th>합계</th></tr></thead>
        <tbody>
          {ps.length ? ps.map((p) => {
            const tot = E.docStats(p.id);
            return (
              <tr key={p.id}>
                <td className="link" onClick={() => go(p.id)}>{p.name}</td>
                {E.PHASES.map((ph) => {
                  const s = E.docStats(p.id, ph.id);
                  if (!s.total) return <td key={ph.id} className="muted">-</td>;
                  const cls = s.ok === s.total ? "green" : s.req ? "violet" : s.ok || s.wip ? "blue" : "gray";
                  return <td key={ph.id} className="cursor-pointer" onClick={() => go(p.id)}><Badge cls={cls}>{`${s.ok}/${s.total}`}</Badge>{s.req ? <>{" "}<span className="small muted">검토 {s.req}</span></> : null}</td>;
                })}
                <td className="nowrap"><b>{tot.ok}/{tot.total}</b></td>
              </tr>
            );
          }) : <tr><td colSpan={8} className="empty">프로젝트 없음</td></tr>}
        </tbody>
      </table></div></div>
    </>
  );
}

export default function Docs() {
  const { S } = useStore();
  if (S.ui.pid === "all") return <DocsMatrix />;
  const pid = S.ui.pid, s = E.docStats(pid);
  const cur = E.currentPhase(pid);
  // 해당없음은 예외: 목록엔 있지만 기본은 숨김
  const naN = S.docs.filter((d) => d.projectId === pid && d.status === "해당없음").length;
  return (
    <>
      <PageHead title="산출물 관리"
        meta={`수행방법론 단계별 산출물 · 작성 → 공유(검토요청) → 승인 · 전체 승인 ${s.ok}/${s.total} (${s.total ? Math.round((s.ok / s.total) * 100) : 0}%)`}
        actions={S.docs.some((d) => d.projectId === pid) ? null : <button className="btn primary" onClick={() => { E.applyTemplate(E.proj(pid)); E.commit(); }}>방법론 템플릿 적용</button>} />
      {naN ? <div className="filters"><button className={`chip ${S.ui.showNA ? "active" : ""}`} onClick={() => { S.ui.showNA = S.ui.showNA ? 0 : 1; E.persistUI(); E.render(); }}>해당없음 {naN}개 {S.ui.showNA ? "숨기기" : "보기"}</button></div> : null}
      {E.PHASES.map((ph) => {
        const ds = S.docs.filter((d) => d.projectId === pid && d.phase === ph.id && (S.ui.showNA || d.status !== "해당없음")).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
        if (!ds.length && E.proj(pid).notLead) return null;
        const st = E.docStats(pid, ph.id);
        return (
          <div className="mx" key={ph.id}>
            <div className="mx-ph" style={{ background: ph.color }}>
              <div className="id">P.{ph.id.slice(1)}{cur === ph.id ? " · 현재 단계" : ""}</div><div className="nm">{ph.name}</div>
              <ul>{ph.acts.map((a, i) => <li key={i}>{a}</li>)}</ul><div className="prog">승인 {st.ok}/{st.total}</div>
            </div>
            <div className="mx-body">
              <div className="tbl-wrap"><table className="t doc-t">
                <colgroup><col style={{ width: 260 }} /><col style={{ width: 118 }} /><col style={{ width: 64 }} /><col style={{ width: 90 }} /><col style={{ width: 124 }} /><col style={{ width: 170 }} /><col style={{ width: 100 }} /><col style={{ width: 180 }} /><col style={{ width: 80 }} /></colgroup>
                <thead><tr><th>산출물</th><th>상태</th><th>버전</th><th>담당</th><th>계획일</th><th>공유(검토요청)</th><th>승인</th><th>파일 위치</th><th></th></tr></thead>
                <tbody>
                  {ds.length ? ds.map((d) => <DocRow key={d.id} d={d} />) : <tr><td colSpan={9} className="empty">산출물 없음</td></tr>}
                </tbody>
              </table></div>
              <div className="foot"><button className="btn sm ghost" onClick={() => E.editDoc(null, ph.id)}>＋ 산출물 추가</button></div>
            </div>
          </div>
        );
      })}
      <p className="muted small mt-2">※ 프로젝트 산출물은 일정과 범위에 따라 고객사와 협의 후 변경 가능 — 불필요한 산출물은 '해당없음'으로 테일러링.</p>
    </>
  );
}

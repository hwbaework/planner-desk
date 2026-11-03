import { useState } from "react";
import { useStore } from "../lib/store.js";
import { Modal } from "../components/Modal.jsx";
import { Bail } from "./Task.jsx";
import * as E from "../legacy/engine.js";

// 메모의 날짜 줄 → 진행 기록 일괄 변환 (오프라인판 splitAllMemos — 줄마다 골라서 옮김)
export const opens = ["splitAllMemos"];
export const samples = (S) => {
  // 지금 범위(S.ui.pid)에 옮길 줄이 있을 때만 창이 열림 → 없으면 비교용으로 전체 범위
  const any = () => S.tasks.some((t) => E.inScope(t) && E.memoDated(t.memo).length);
  if (!any()) S.ui.pid = "all";
  return any() ? [["splitAllMemos"]] : [];
};

export default function MemoSplitModal() {
  const { S } = useStore();
  const [list] = useState(() => S.tasks.filter((t) => E.inScope(t) && E.memoDated(t.memo).length));
  if (!list.length) return <Bail msg="옮길 날짜 줄이 없어" />;
  return <MemoSplit list={list} />;
}

function MemoSplit({ list }) {
  const { S } = useStore();
  const total = list.reduce((a, t) => a + E.memoDated(t.memo).length, 0);
  const skipped = list.concat(S.tasks.filter((t) => E.inScope(t) && !list.includes(t))).flatMap((t) => E.memoScan(t.memo).skipped.map((l) => [t.title, l]));
  const [rowsOf] = useState(() => Object.fromEntries(list.map((t) => [t.id, E.memoDated(t.memo)])));
  const [chk, setChk] = useState(() => Object.fromEntries(list.flatMap((t) => rowsOf[t.id].map((r, i) => [`${t.id}:${i}`, true]))));
  // 오프라인판 memoPick
  const pick = (mode) => setChk((o) => Object.fromEntries(list.flatMap((t) => rowsOf[t.id].map((r, i) => { const k = `${t.id}:${i}`; return [k, mode === "all" ? true : mode === "none" ? false : !r.plan && o[k]]; }))));
  const run = () => {
    let n = 0;
    list.forEach((x) => {
      const rows = E.memoDated(x.memo), pick = rows.filter((r, i) => chk[`${x.id}:${i}`]);
      if (!pick.length) return;
      pick.forEach((r) => E.logTask(x, "comment", r.text, r.at)); x.memo = E.removeLines(x.memo, pick); n += pick.length;
    });
    E.commit(); E.closeModal(); E.toast(`${n}건을 진행 기록으로 옮겼어`, true);
  };
  return (
    <Modal title="메모 → 진행 기록 미리보기" wide buttons={[{ l: "취소", close: true }, { l: "체크한 것 옮기기", cls: "primary", fn: run }]}>
      <div className="small muted mb-2">업무 {list.length}건 · {total}건. 체크한 것만 옮겨. '계획' 표시는 예정·필요·요청으로 끝나는 줄이야. (Ctrl+Z로 되돌릴 수 있어)</div>
      <div className="flex gap-1.5 flex-wrap mb-2.5"><button className="chip" onClick={() => pick("all")}>전체 선택</button><button className="chip" onClick={() => pick("none")}>전체 해제</button><button className="chip" onClick={() => pick("plan")}>계획 줄 해제</button></div>
      {list.map((t) => {
        const rows = rowsOf[t.id];
        return (
          <details open key={t.id}>
            <summary className="sec-t cursor-pointer">{t.title} <span className="chip-ref">{E.projName(t.projectId)}</span> <span className="small muted">{rows.length}건</span></summary>
            {rows.map((r, i) => {
              const k = `${t.id}:${i}`;
              return (
                <label className="mrow cursor-pointer items-start" key={k}>
                  <input type="checkbox" className="mchk w-auto mt-[3px]" data-t={t.id} data-i={i} data-plan={r.plan ? 1 : 0} checked={!!chk[k]} onChange={(e) => setChk((o) => ({ ...o, [k]: e.target.checked }))} />
                  <span className="small mono flex-none">{E.shortD(r.at)}</span>{r.plan ? <span className="chip-ref flex-none">계획</span> : null}<span className="nm whitespace-pre-wrap">{r.text}</span>
                </label>
              );
            })}
          </details>
        );
      })}
      {skipped.length ? (
        <details className="mt-2.5"><summary className="small muted cursor-pointer">마감 표현이라 안 옮김 {skipped.length}줄</summary>
          {skipped.map(([tt, l], i) => <div className="small muted py-0.5" key={i}>{tt} · {l}</div>)}
        </details>
      ) : null}
    </Modal>
  );
}

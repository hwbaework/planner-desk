import { useState } from "react";
import { useStore } from "../lib/store.js";
import { Modal } from "../components/Modal.jsx";
import { Badge, EpicTag, TypeIcon } from "../components/ui.jsx";
import { Bail } from "./Task.jsx";
import * as E from "../legacy/engine.js";

// CSV 업무 가져오기 (오프라인판 importTaskCsv — 고른 파일을 글자로 읽어 넘김)
export const opens = ["importTaskCsv"];
export const samples = (S) => {
  const ex = S.tasks.find((t) => t.extKey)?.extKey || "KAN-1";
  const jira = ["Summary,Issue key,Status,Assignee,Due date,Priority,Parent summary,Description",
    `"로그인 화면 검토, 1차",${ex},In Progress,홍길동,2026-11-20,High,회원,설명 1`,
    "메인 배너 문구 수정,KAN-9001,Done,김철수,2026/11/25,Low,메인,",
    "주문 내역 조회 오류,KAN-9002,Blocked,,,Medium,12345,"].join("\n");
  const many = ["요약,상태,담당자,기한,에픽"].concat(Array.from({ length: 11 }, (_, i) => `업무 ${i + 1},${i % 3 ? "진행" : "완료"},이영희,11/${i + 1},분류${i % 2}`)).join("\r\n");
  return [["importTaskCsv", jira], ["importTaskCsv", many]];
};

const COL_L = { title: "제목", key: "키", status: "상태", owner: "담당", due: "기한", start: "시작", epic: "분류(에픽)", priority: "우선순위", memo: "설명" };

export default function TaskCsvModal({ args: [text] }) {
  const [parsed] = useState(() => E.csvToTasks(text));
  if (!parsed.items.length) return <Bail msg="업무를 못 찾았어 — 첫 줄에 Summary/요약 같은 열 이름이 있어야 해" />;
  return <TaskCsv {...parsed} />;
}

function TaskCsv({ items, cols }) {
  const { S } = useStore();
  const has = (k) => cols[k] !== undefined;
  const [pid, setPid] = useState(() => (S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0]?.id));
  const found = Object.keys(cols).map((k) => COL_L[k]).join(" · ");
  const upd = items.filter((x) => x.key && S.tasks.some((t) => t.extKey === x.key)).length;
  const run = () => {
    const target = pid; let add = 0, up = 0;
    items.forEach((x) => {
      const ex = x.key && S.tasks.find((t) => t.extKey === x.key);
      const v = { title: x.title, status: x.status, owner: x.owner, due: x.due, epic: x.epic, priority: x.priority, updatedAt: new Date().toISOString() };
      if (ex) {
        const prev = ex.status, upd = { title: x.title, updatedAt: v.updatedAt };
        ["status", "owner", "due", "epic", "priority"].forEach((k) => { if (has(k) && x[k]) upd[k] = x[k]; });   // 없는 열·빈 칸은 기존 값 유지
        Object.assign(ex, upd); E.markDone(ex, prev); up++;
      }
      else { const n = Object.assign({ id: E.uid("t"), projectId: target, start: x.start || E.today(), memo: x.memo, extKey: x.key }, v); E.markDone(n, ""); S.tasks.push(n); add++; }
    });
    E.commit(); E.closeModal(); E.toast(`가져오기: 새로 ${add} · 갱신 ${up}`, true);
  };
  return (
    <Modal title="CSV 업무 가져오기" wide buttons={[{ l: "취소", close: true }, { l: "가져오기", cls: "primary", fn: run }]}>
      <div className="info">
        <div className="l">대상 프로젝트</div><div><select id="csvPid" className="inline" value={pid} onChange={(e) => setPid(e.target.value)}>{E.activeProjects().map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="l">인식한 열</div><div>{found}</div>
        <div className="l">업무</div><div>{items.length}건 (새로 {items.length - upd} · 같은 키 갱신 {upd})</div>
      </div>
      <div className="sec-t">미리보기</div>
      {items.slice(0, 8).map((x, i) => (
        <div className="mrow" key={i}><TypeIcon kind="task" /><span className="nm">{x.key ? <><span className="mono small muted">{x.key}</span> </> : null}{x.title}</span>{x.epic ? <EpicTag name={x.epic} /> : null}<Badge cls={E.TASK_CLS[x.status]}>{x.status}</Badge></div>
      ))}
      {items.length > 8 ? <div className="small muted">외 {items.length - 8}건</div> : null}
    </Modal>
  );
}

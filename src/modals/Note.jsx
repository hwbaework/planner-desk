import { useEffect, useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { TypeIcon } from "../components/ui.jsx";
import { Run } from "./kit/form.jsx";

// 새 메모 양식 고르기 (오프라인판 newNote) · 회의록에서 업무·결정·리스크 등록 (오프라인판 noteToTasks)
export const opens = ["newNote", "noteToTasks"];
export const samples = (S) => [
  ["newNote"],
  ...S.notes.filter((n) => noteActs(n).acts.length).slice(0, 3).map((n) => ["noteToTasks", n.id]),
];

// 회의록에서 뽑은 항목 (이미 등록한 것은 빼고)
function noteActs(n) {
  const explicit = E.noteActions(n.content).map((a) => Object.assign(a, { type: "업무" }));
  const secs = E.noteSections(n.content);
  const found = !!(explicit.length || secs.length);
  const base = found ? [...explicit, ...secs] : E.noteSuggestions(n.content).map((a) => Object.assign(a, { type: "업무" }));
  const acts = base.filter((a) => !E.S.tasks.some((t) => t.noteId === n.id && t.title === a.title) && !E.S.risks.some((r) => r.noteId === n.id && r.title === a.title));
  return { found, acts };
}

// 새 메모: 양식을 고르면 메모를 만들고 메모 화면에서 편집
function makeNote(tpl, pid) {
  const [label, body] = E.NOTE_TEMPLATES[tpl] || E.NOTE_TEMPLATES.blank;
  const d = E.today();
  const n = { id: E.uid("n"), projectId: pid, title: tpl === "blank" ? "" : `${d.slice(2).replace(/-/g, "")} ${label}`, date: d, content: body.replace("{date}", `${d} (${E.wd(d)})`), updatedAt: new Date().toISOString() };
  E.S.notes.push(n); E.S.ui.noteId = n.id; E.commit(); setTimeout(() => E.$("noteTitle")?.focus(), 0);
}

function NewNote() {
  return (
    <Modal title="새 메모" buttons={[{ l: "취소", close: true }]}>
      <div className="small muted" style={{ marginBottom: 8 }}>양식을 고르면 [결정]·[액션]·[리스크] 칸이 들어가. 다 쓰고 '업무·결정·리스크 등록'을 누르면 돼.</div>
      {Object.entries(E.NOTE_TEMPLATES).map(([k, [l, body]]) => (
        <div key={k} className="mrow" style={{ cursor: "pointer" }} onClick={() => { closeModal(); E.newNote(k); }}>
          <TypeIcon kind={k === "blank" ? "doc" : "event"} /><span className="nm"><b>{l}</b></span>
          <span className="small muted clamp1" style={{ maxWidth: 320 }}>{body.split("\n").filter((x) => /^\[/.test(x)).join(" ")}</span>
        </div>
      ))}
    </Modal>
  );
}

const TYPES = ["업무", "결정", "리스크", "이슈", "건너뛰기"];
function NoteToTasks({ nid }) {
  const { S } = useStore();
  const [{ n, found, acts }] = useState(() => { const n = S.notes.find((x) => x.id === nid); return { n, ...noteActs(n) }; });
  const [types, setTypes] = useState(() => acts.map((a) => (a.suggested ? "건너뛰기" : a.type)));
  if (!acts.length) return <Run fn={() => E.toast("만들 항목이 없어 — [액션]·[결정]·[리스크] 아래에 '- 내용' 형식으로 적어줘")} />;
  const save = () => {
    const cnt = { 업무: 0, 결정: 0, 리스크: 0, 이슈: 0 };
    acts.forEach((a, i) => {
      const ty = types[i];
      if (ty === "건너뛰기") return;
      if (ty === "업무") S.tasks.push({ id: E.uid("t"), projectId: n.projectId, title: a.title, owner: a.owner, due: a.due, start: n.date || E.today(), status: "진행중", priority: "mid", memo: `회의록: ${n.title || n.date}`, noteId: n.id, updatedAt: new Date().toISOString() });
      else S.risks.push({ id: E.uid("ri"), code: E.nextRiskCode(), projectId: n.projectId, type: ty, title: a.title, owner: a.owner, due: a.due, impact: "M", prob: "M", status: ty === "결정" ? "완료" : "오픈", raisedAt: n.date || E.today(), desc: `회의록: ${n.title || n.date}`, plan: "", noteId: n.id });
      cnt[ty]++;
    });
    E.commit(); closeModal(); E.toast(Object.entries(cnt).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(" · ") + " 등록");
  };
  return (
    <Modal title="회의록에서 등록" buttons={[{ l: "취소", close: true }, { l: "등록", cls: "primary", fn: save }]}>
      <p className="small muted" style={{ marginBottom: 8 }}>「{n.title || "(제목 없음)"}」에서 {found ? "찾은 항목이야." : "[액션] 표시가 없어서, 할 일처럼 보이는 줄을 제안했어."} 줄마다 업무·결정·리스크·이슈로 골라.</p>
      {acts.map((a, i) => (
        <div key={i} className="mrow">
          <select className="inline actType" data-i={i} value={types[i]} onChange={(e) => setTypes((t) => t.map((x, j) => (j === i ? e.target.value : x)))}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <span className="nm" title={a.title}>{a.title}</span><span className="small muted">{a.owner || ""}</span><span className="small muted">{a.due ? "~" + E.shortD(a.due) : ""}</span>
        </div>
      ))}
    </Modal>
  );
}

// 메모 입력 중이면 먼저 저장(noteFlush)한 뒤 항목을 뽑는다
function NoteToTasksFlushed({ nid }) {
  const [ready, setReady] = useState(() => !E.noteFlush);
  useEffect(() => { if (!ready) { E.noteFlush?.(); setReady(true); } }, []);
  return ready ? <NoteToTasks nid={nid} /> : null;
}

export default function NoteModal({ args, name }) {
  if (name === "noteToTasks") return <NoteToTasksFlushed nid={args[0]} />;
  const tpl = args[0];
  const pid = E.S.ui.pid !== "all" ? E.S.ui.pid : E.activeProjects()[0]?.id;
  if (!pid) return <Run fn={() => E.toast("프로젝트를 먼저 만들어줘")} />;
  if (tpl) return <Run fn={() => makeNote(tpl, pid)} />;
  return <NewNote />;
}

import { useEffect } from "react";
import { useStore } from "../lib/store.js";
import * as E from "../legacy/engine.js";
import { PageHead, Badge, TypeIcon, IconBtn } from "../components/ui.jsx";

export const tabs = ["notes"];

// 오프라인판 noteTasksHtml
function NoteTasks({ n }) {
  const S = E.S;
  const ts = S.tasks.filter((t) => t.noteId === n.id), rs = S.risks.filter((r) => r.noteId === n.id);
  if (!ts.length && !rs.length) return (
    <div className="small muted mt-[10px]">적는 법: <span className="mono">[액션]</span> 아래 <span className="mono">- 담당: 내용 (~10/20)</span> · <span className="mono">[결정]</span> · <span className="mono">[리스크]</span> 아래 <span className="mono">- 내용</span></div>
  );
  return (
    <>
      {rs.length ? <>
        <div className="sec-t">이 회의의 결정·리스크 {rs.length}</div>
        {rs.map((r) => (
          <div key={r.id} className="mrow cursor-pointer" onClick={() => E.editRisk(r.id)}>
            <TypeIcon kind={r.type === "이슈" ? "bug" : r.type === "결정" ? "task" : "data"} /><span className="nm">{r.title}</span>
            <Badge cls={r.type === "결정" ? "green" : r.type === "이슈" ? "red" : "amber"}>{r.type}</Badge>
          </div>
        ))}
      </> : null}
      {ts.length ? <div className="sec-t">이 회의에서 나온 업무 {ts.length}</div> : null}
      {ts.map((t) => (
        <div key={t.id} className="mrow cursor-pointer" onClick={() => E.editTask(t.id)}>
          <TypeIcon kind="task" /><span className={t.status === "완료" ? "nm line-through text-[var(--faint)]" : "nm"}>{t.title}</span>
          <span className="small muted">{t.owner || ""}</span><Badge cls={E.TASK_CLS[t.status] || "gray"}>{t.status}</Badge>
          {t.due ? <span className="small muted">{E.shortD(t.due)}</span> : null}
        </div>
      ))}
    </>
  );
}

// 편집칸은 오프라인판 bindNoteEditor가 id로 찾아 자동 저장을 건다 → 값은 React가 관리하지 않음(defaultValue).
// 메모가 바뀌면 key로 새 칸을 만들고 다시 건다.
function NoteEditor({ cur }) {
  const S = E.S;
  useEffect(() => {
    const el = document.getElementById("noteContent");
    if (!el || el.dataset.bound) return;
    el.dataset.bound = "1";
    E.bindNoteEditor();
  }, []);
  return (
    <>
      <div className="form mb-[10px]">{" "}
        <div className="full"><input type="text" id="noteTitle" defaultValue={cur.title} placeholder="제목 (예: 1015 화면설계 리뷰 회의)" className="text-[15px] font-semibold" /></div>{" "}
        <div><select id="noteProj" defaultValue={cur.projectId}>{S.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>{" "}
        <div><input type="date" id="noteDate" defaultValue={cur.date || ""} /></div>
      </div>{" "}
      <textarea id="noteContent" placeholder="회의 내용, 결정사항, 액션아이템…" defaultValue={cur.content || ""}></textarea>{" "}
      <div className="flex gap-1.5 mt-2 items-center"><span className="muted small" id="noteSaved">자동 저장됨</span>{" "}
        <button className="btn sm ml-auto" onClick={() => E.noteToTasks(cur.id)}>업무·결정·리스크 등록</button>{" "}
        <IconBtn icon="copy" title="복사" onClick={() => E.copyText(document.getElementById("noteContent").value)} />
        <IconBtn icon="del" title="삭제" onClick={() => E.delNote(cur.id)} />
      </div>{" "}
      <NoteTasks n={cur} />
    </>
  );
}

export default function Notes() {
  const { S } = useStore();
  const list = S.notes.filter((n) => S.ui.pid === "all" ? !E.proj(n.projectId)?.archived : n.projectId === S.ui.pid).sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const cur = S.notes.find((n) => n.id === S.ui.noteId && list.includes(n)) || list[0];
  return (
    <>
      <PageHead title="메모 · 회의록" meta="자동 저장 · 결정사항/액션아이템은 전달 건이나 WBS로 바로 옮겨 관리"
        actions={<button className="btn primary" onClick={() => E.newNote()}>＋ 새 메모</button>} />
      <div className="notes-wrap">
        <div className="card max-h-[72vh] overflow-y-auto">
          {list.length ? list.map((n) => (
            <div key={n.id} className={`note-item ${cur && n.id === cur.id ? "active" : ""}`} onClick={() => { S.ui.noteId = n.id; E.render(); }}>
              <div className="t">{n.title || "(제목 없음)"}</div><div className="m">{n.date || ""} · {E.projName(n.projectId)}</div>
            </div>
          )) : <div className="empty">메모 없음</div>}
        </div>
        <div className="card"><div className="card-b">
          {cur ? <NoteEditor key={cur.id} cur={cur} /> : <div className="empty">왼쪽에서 메모를 고르거나 새로 만들어</div>}
        </div></div>
      </div>
    </>
  );
}

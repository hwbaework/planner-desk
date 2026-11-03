import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { useForm, FormBody, isWide, formButtons, Run } from "./kit/form.jsx";

// 일정 (오프라인판 editEvent) · 타임라인에 추가 고르기 (오프라인판 tlAdd)
export const opens = ["editEvent", "tlAdd"];
export const samples = (S) => [
  ["editEvent", S.events[0]?.id],
  ["editEvent", S.events.find((e) => e.end || e.memo || e.location)?.id],
  ["editEvent", null, E.today()],
  ["editEvent", null, "2026-11-20"],
  ["tlAdd"],
  ["tlAdd", S.projects[0]?.id],
  ["tlAdd", S.projects[1]?.id],
];

function EventForm({ id, date }) {
  const { S } = useStore();
  const e = id ? S.events.find((x) => x.id === id) : { start: date || E.today(), type: "회의", projectId: S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0]?.id };
  const fields = [
    { k: "title", l: "일정", t: "text", full: true, req: true, ph: "예: 상황실 플랫폼 시연" },
    { k: "projectId", l: "프로젝트", t: "select", opts: E.activeProjects().map((p) => [p.id, p.name]) },
    { k: "type", l: "구분", t: "select", opts: E.EVENT_TYPES },
    { k: "start", l: "시작일", t: "date", req: true },
    { k: "end", l: "종료일", t: "date", hint: "하루 일정이면 비워둬" },
    { k: "location", l: "장소", t: "text", full: true },
    { k: "memo", l: "메모 (시간·참석자·준비사항)", t: "textarea", side: true },
  ];
  const form = useForm(fields, e, (v) => {
    if (id) Object.assign(e, v); else S.events.push(Object.assign({ id: E.uid("ev") }, v));
    S.ui.calSel = v.start; E.commit();
  });
  const extraBtns = id ? [{ l: "삭제", cls: "danger left", fn: () => { if (confirm("일정을 삭제할까?")) { S.events = S.events.filter((x) => x.id !== id); E.commit(); closeModal(); E.toast("삭제했어", true); } } }] : [];
  return (
    <Modal title={id ? "일정" : "일정 추가"} wide={isWide(fields)} buttons={formButtons(extraBtns, form.save)}>
      <FormBody form={form} fields={fields} />
    </Modal>
  );
}

// 타임라인에서 바로 추가: 고르면 그 프로젝트로 맞추고 해당 창을 연다
function TlAdd({ pid }) {
  const go = (fn) => () => { closeModal(); E.S.ui.pid = pid; fn(); };
  const opt = (fn, l, d) => (
    <button className="btn" style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: "10px 12px" }} onClick={go(fn)}>
      <b>{l}</b><div className="small muted">{d}</div>
    </button>
  );
  return (
    <Modal title={`타임라인에 추가 · ${E.projName(pid)}`} buttons={[{ l: "취소", close: true }]}>
      {opt(() => E.editWBS(null, ""), "WBS 작업", "단계별 작업 · 시작~종료 막대")}
      {opt(() => E.editTask(null, { start: E.today(), due: E.addDays(E.today(), 7) }), "업무", "시작일~마감 막대")}
      {opt(() => E.editData(), "데이터 협의", "요청일~수신 예정일")}
      {opt(() => E.editProject(pid), "사업 기간", "프로젝트 줄의 전체 기간 막대 (시작·종료일)")}
    </Modal>
  );
}

export default function EventModal({ args, name }) {
  if (name === "tlAdd") {
    const pid = args[0] || (E.S.ui.pid !== "all" ? E.S.ui.pid : E.activeProjects()[0]?.id);
    if (!pid) return <Run fn={() => E.toast("프로젝트를 먼저 만들어줘")} />;
    return <TlAdd pid={pid} />;
  }
  if (!E.activeProjects().length) return <Run fn={() => E.toast("프로젝트를 먼저 만들어줘")} />;
  return <EventForm id={args[0]} date={args[1]} />;
}

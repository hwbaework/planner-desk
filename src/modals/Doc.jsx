import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { useForm, FormBody, isWide, formButtons, Run } from "./kit/form.jsx";

// 산출물 (오프라인판 editDoc)
export const opens = ["editDoc"];
export const samples = (S) => [
  ["editDoc", S.docs[0]?.id],
  ["editDoc", S.docs.find((d) => (d.history || []).length)?.id],
  ["editDoc", S.docs.find((d) => d.status === "완료")?.id],
  ["editDoc", null, "P2"],
  ["editDoc", null, "P1", "작성중"],
];

function DocForm({ id, phaseId, status }) {
  const { S } = useStore();
  const pid = S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0].id;
  const d = id ? S.docs.find((x) => x.id === id) : { phase: phaseId || "P1", status: status || "미착수", version: "v0.1", projectId: pid, history: [] };
  const fields = [
    { k: "name", l: "산출물명", t: "text", full: true, req: true },
    { k: "projectId", l: "프로젝트", t: "select", opts: E.activeProjects().map((p) => [p.id, p.name]) },
    { k: "phase", l: "단계", t: "select", opts: E.PHASES.map((p) => [p.id, `${p.id} ${p.name}`]) },
    { k: "status", l: "상태", t: "select", opts: E.DOC_ST },
    { k: "version", l: "버전", t: "text" },
    { k: "owner", l: "작성 담당", t: "text" },
    { k: "plan", l: "계획(완료 목표)일", t: "date" },
    { k: "requestedAt", l: "공유(검토요청)일", t: "date" },
    { k: "approver", l: "승인자", t: "text", ph: "고객사 PM 등" },
    { k: "approvedAt", l: "승인일", t: "date" },
    { k: "path", l: "파일 위치 (경로 / 링크)", t: "text", full: true, ph: "\\\\server\\기획\\화면설계서_v1.2.pptx 또는 https://...", hint: "파일은 올리지 않고 위치만 기록 — 버전이 바뀌면 [개정]으로 버전 올리고 위치도 새 파일로" },
    { k: "memo", l: "메모", t: "textarea", side: true },
  ];
  const hist = id && d.history.length ? (
    <>
      <div className="sec-t">진행 기록</div>
      <ul className="tl">{[...d.history].reverse().map((e, i) => <li key={i}><div className="h">{e.at}</div><div className="x">{e.text}</div></li>)}</ul>
    </>
  ) : null;
  const form = useForm(fields, d, (v) => {
    if (v.status === "검토중" && !v.requestedAt) v.requestedAt = E.today();
    if (v.status === "완료" && !v.approvedAt) v.approvedAt = E.today();
    if (id && d.status === "완료" && ["작성중", "미착수"].includes(v.status) && v.approvedAt === d.approvedAt) { v.approvedAt = ""; v.requestedAt = ""; }
    if (id) { if (v.status !== d.status) d.history.push({ at: E.today(), ts: new Date().toISOString(), text: `${d.status} → ${v.status}` }); Object.assign(d, v); }
    else S.docs.push(Object.assign({ id: E.uid("d"), history: [{ at: E.today(), ts: new Date().toISOString(), text: `추가 (${v.status})` }], order: 99 }, v));
    E.commit();
  });
  const extraBtns = id ? [{ l: "삭제", cls: "danger left", fn: () => { if (confirm("산출물을 삭제할까?")) { S.docs = S.docs.filter((x) => x.id !== id); E.commit(); closeModal(); E.toast("삭제했어", true); } } }] : [];
  return (
    <Modal title={id ? `산출물 · ${d.name}` : "산출물 추가"} wide={isWide(fields)} buttons={formButtons(extraBtns, form.save)}>
      <FormBody form={form} fields={fields} extra={hist} />
    </Modal>
  );
}

export default function DocModal({ args: [id, phaseId, status] }) {
  if (!E.activeProjects().length) return <Run fn={() => E.toast("프로젝트를 먼저 만들어줘")} />;
  return <DocForm id={id} phaseId={phaseId} status={status} />;
}

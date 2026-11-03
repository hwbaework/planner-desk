import { useEffect, useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal as closeReactModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { OpenForm, KEEP } from "./_openForm.jsx";

// 테스트 케이스 (오프라인판 editTC) · 결함 전달 (tcDefect) · 테스트 케이스 붙여넣기 (bulkTC)
export const opens = ["editTC", "tcDefect", "bulkTC"];
export const samples = (S) => {
  const fail = S.tcs.find((c) => ["Fail", "Block"].includes(c.result) && !c.hoId);
  const withScreen = S.tcs.find((c) => c.screenId);
  return [
    ["editTC", S.tcs[0]?.id], ["editTC", fail?.id], ["editTC", withScreen?.id],
    ["editTC"], ["editTC", null, { projectId: S.projects[0]?.id }],
    ["tcDefect", S.tcs[0]?.id], ["tcDefect", withScreen?.id],
    ["bulkTC"],
  ];
};

// 열자마자 안내만 하고 닫기 (오프라인판은 창을 열지 않음)
function Bail({ msg }) {
  useEffect(() => { closeReactModal(); E.toast(msg); }, []);
  return null;
}

function EditTC({ id, preset }) {
  const { S } = useStore();
  const [init] = useState(() => (id || !E.activeProjects().length ? null : Object.assign({ result: "미수행", projectId: S.ui.pid !== "all" ? S.ui.pid : E.activeProjects()[0].id }, preset || {})));
  if (!E.activeProjects().length) return <Bail msg="프로젝트를 먼저 만들어줘" />;
  const c = id ? S.tcs.find((x) => x.id === id) : init;
  if (!c) return null;
  const fields = [
    { k: "scenario", l: "시나리오", t: "text", full: true, req: true, ph: "예: 회원가입 필수값 미입력 시 안내" },
    { k: "projectId", l: "프로젝트", t: "select", opts: E.activeProjects().map((p) => [p.id, p.name]) },
    { k: "screenId", l: "화면", t: "select", opts: [["", "(화면 없음)"], ...S.screens.filter((x) => x.projectId === c.projectId).map((x) => [x.id, `${x.code} ${x.name}`])] },
    { k: "reqId", l: "요구사항", t: "select", opts: [["", "(연결 안 함)"], ...E.reqTasks(c.projectId).filter((x) => x.status !== "제외").map((x) => [x.id, `${x.code} ${x.title.slice(0, 30)}`])] },
    { k: "result", l: "결과", t: "select", opts: E.TC_RES },
    { k: "stage", l: "테스트 단계", t: "select", opts: [["통합", "통합테스트 (P5)"], ["단위", "단위테스트 (P4)"]] },
    { k: "pre", l: "사전 조건", t: "text", full: true, ph: "예: 일반 회원으로 로그인" },
    { k: "steps", l: "테스트 절차", t: "textarea", full: true, ph: "1. 메뉴 진입\n2. 이름 비우고 저장" },
    { k: "expected", l: "예상 결과", t: "textarea", full: true },
    { k: "actual", l: "실제 결과 (Fail·Block일 때)", t: "textarea", full: true },
    { k: "tester", l: "수행자", t: "text" },
    { k: "testedAt", l: "수행일", t: "date" },
  ];
  const onSave = (v) => {
    const sc = S.screens.find((x) => x.id === v.screenId); if (sc && sc.projectId !== v.projectId) v.screenId = "";
    if (id) { const prev = c.result; Object.assign(c, v); if (v.result !== prev) E.tcResultChanged(c); }
    else { const n = Object.assign({ id: E.uid("tc"), code: E.nextTCCode() }, c, v); if (n.result !== "미수행") n.testedAt = n.testedAt || E.today(); S.tcs.push(n); }
    E.commit();
  };
  const extraBtns = id ? [
    { l: "삭제", cls: "danger left", fn: () => { if (confirm("테스트 케이스를 삭제할까?")) { S.tcs = S.tcs.filter((x) => x.id !== id); E.commit(); E.closeModal(); E.toast("삭제했어", true); } } },
    ...(["Fail", "Block"].includes(c.result) && !c.hoId ? [{ l: "결함 전달", cls: "left", fn: () => { E.closeModal(); E.tcDefect(c.id); } }] : []),
  ] : [];
  return <OpenForm title={id ? `테스트 케이스 · ${c.code}` : "테스트 케이스 추가"} fields={fields} obj={c} onSave={onSave} extraBtns={extraBtns} />;
}

// Fail TC → 개발 전달(결함) 생성. 수신자는 화면의 개발 담당자.
function TcDefect({ id }) {
  const { S } = useStore();
  const c = S.tcs.find((x) => x.id === id);
  const [obj] = useState(() => {
    if (!c) return null;
    const sc = S.screens.find((x) => x.id === c.screenId);
    const last = S.handoffs.filter((h) => h.projectId === c.projectId && h.to && (h.screenIds || []).includes(sc?.id)).pop();
    return { actual: c.actual || "", to: sc?.dev || last?.to || "", toEmail: last?.toEmail || "", dueDate: E.addDays(E.today(), 3) };
  });
  if (!c) return null;
  const fields = [
    { k: "actual", l: "실제 결과", t: "textarea", full: true, req: true, ph: "예: 이름을 비우고 저장해도 오류 안내 없이 저장됨" },
    { k: "to", l: "받는 사람 (개발 담당)", t: "text", req: true },
    { k: "toEmail", l: "메일 주소", t: "text" },
    { k: "dueDate", l: "수정 완료 예정일", t: "date" },
  ];
  // 저장하면 결함 전달 창(openHO)이 이어서 열림 → 이 창만 닫고 그 창은 둠
  const onSave = (v) => { c.actual = v.actual; closeReactModal(); E.tcDefectSend(id, v); return KEEP; };
  return <OpenForm title={`결함 전달 · ${c.code}`} fields={fields} obj={obj} onSave={onSave} />;
}

function BulkTC() {
  const { S } = useStore();
  const [text, setText] = useState("");
  const [pid] = useState(() => S.ui.pid);
  const add = () => {
    let n = 0;
    text.split(/\r?\n/).map((l) => l.split("\t").map((c) => c.trim())).filter((r) => r[1]).forEach(([sc, scenario, pre, steps, expected]) => {
      const scr = S.screens.find((x) => x.projectId === pid && x.code === sc);
      S.tcs.push({ id: E.uid("tc"), code: E.nextTCCode(), projectId: pid, screenId: scr?.id || "", scenario, pre: pre || "", steps: steps || "", expected: expected || "", result: "미수행" });
      n++;
    });
    E.commit(); E.closeModal(); E.toast(`${n}개 추가`);
  };
  return (
    <Modal title="테스트 케이스 붙여넣기" buttons={[{ l: "취소", close: true }, { l: "추가", cls: "primary", fn: add }]}>
      <p className="small muted" style={{ marginBottom: 8 }}>엑셀에서 열 순서대로 복사 (탭 구분): <b>화면ID · 시나리오 · 사전 조건 · 절차 · 예상 결과</b>. 화면ID가 화면 목록에 있으면 자동 연결.</p>
      <textarea id="bulkText" style={{ minHeight: 220 }} className="mono" value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

export default function TcModal({ args, name }) {
  if (name === "tcDefect") return <TcDefect id={args[0]} />;
  if (name === "bulkTC") return <BulkTC />;
  return <EditTC id={args[0]} preset={args[1]} />;
}

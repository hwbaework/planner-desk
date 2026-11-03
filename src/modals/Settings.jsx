import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { useForm, FormBody, isWide, formButtons } from "./kit/form.jsx";

// 설정 (오프라인판 openSettings, 웹판: 다른 이름으로 저장 없음)
export const opens = ["openSettings"];
export const samples = () => [["openSettings"]];

// 오프라인판 dataInfo
function DataInfo({ S }) {
  const kb = Math.round(JSON.stringify(S).length / 1024);
  const n = S.tasks.length + S.handoffs.length + S.docs.length + S.datas.length + S.tcs.length + S.reqs.length + S.risks.length + S.screens.length + S.wbs.length + S.notes.length + S.events.length;
  return (
    <div className="note-box" style={{ marginTop: 14 }}>
      데이터 {n.toLocaleString()}건 · 약 {kb.toLocaleString()}KB (브라우저 저장 한도는 보통 5MB)
      {" "}· 마지막 파일 저장 {S.fileSavedAt ? S.fileSavedAt.slice(0, 16).replace("T", " ") : "없음"}
    </div>
  );
}

export default function SettingsModal() {
  const { S } = useStore();
  const fields = [
    { k: "me", l: "내 이름 (메일 문구에 사용)", t: "text", ph: "예: 홍길동 매니저" },
    { k: "sign", l: "메일 서명", t: "textarea", full: true, ph: "홍길동 | PMO\n010-0000-0000" },
    { k: "approvalDays", l: "산출물 승인 회신 기준 (영업일)", t: "number" },
    { k: "quietDays", l: "진행 공유 없음 기준 (영업일)", t: "number" },
    { k: "verifyDays", l: "테스트 대기 알림 (개발 완료 후 일)", t: "number" },
    { k: "reportWeek", l: "주간보고 기간", t: "select", opts: [["rolling", "오늘 기준 최근 7일"], ["mon", "월요일~일요일 (이번 주)"]] },
    { k: "saveDir", l: "저장 폴더", t: "text", full: true },
    { k: "fontScale", l: "글자 크기", t: "select", opts: [["1", "보통"], ["1.1", "크게"], ["1.2", "아주 크게"]] },
    { k: "theme", l: "화면 테마", t: "select", opts: [["light", "화이트"], ["dark", "다크"]] },
    { k: "flowText", l: "업무 흐름 단계 (협의·기획·개발·완료는 고정, 사이에 추가)", t: "text", full: true, v: E.flowSteps().join(" > ") },
    { k: "extraHolidays", l: "추가 휴일 (회사 휴무·임시공휴일)", t: "textarea", full: true, ph: "2026-12-31 종무식\n2027-01-02 회사 휴무", hint: "줄마다 날짜와 이름. 공휴일·대체공휴일(2023~2027)은 이미 들어 있어. 영업일 계산·캘린더·타임라인에 반영" },
    { k: "desktopNotify", l: "바탕화면 알림", t: "select", opts: [["off", "끄기"], ["on", "켜기 — 노티 미수신·기한 지남을 윈도우 알림으로"]] },
  ];
  const form = useForm(fields, S.settings, (v) => {
    ["ackDays", "approvalDays", "quietDays", "verifyDays"].forEach((k) => (v[k] = Number(v[k]) || E.emptyState().settings[k]));
    if (v.flowText !== undefined) {
      const st = String(v.flowText).split(/[>,·\s]+/).map((x) => x.trim()).filter(Boolean);
      if (st.filter((x) => E.FLOW_FIXED.includes(x)).join() !== E.FLOW_FIXED.join() || st[0] !== "협의" || st[st.length - 1] !== "완료" || new Set(st).size !== st.length) { E.toast("협의 > 기획 > 개발 > 완료 순서는 그대로 두고 사이에만 넣어줘"); return false; }
      v.flowSteps = st; delete v.flowText;
    }
    if (v.saveDir !== undefined) v.saveDir = String(v.saveDir).trim().replace(/^"|"$/g, "").replace(/\\+$/, "");
    const turnOn = v.desktopNotify === "on" && S.settings.desktopNotify !== "on";
    Object.assign(S.settings, v); E.commit();
    if (turnOn) E.enableNotify();
  });
  const extraBtns = [
    { l: "사용 안내", cls: "left", fn: () => { closeModal(); E.openHelp(); } },
    { l: "불러오기", cls: "left", fn: () => { closeModal(); E.$("importFile").click(); } },
    { l: "JSON 내보내기", cls: "left", fn: () => E.download(E.fileName("json", E.projShortNames(), "업무관리 데이터"), JSON.stringify(S, null, 1), "application/json") },
  ];
  return (
    <Modal title="설정" wide={isWide(fields)} buttons={formButtons(extraBtns, form.save)}>
      <FormBody form={form} fields={fields} extra={<DataInfo S={S} />} />
    </Modal>
  );
}

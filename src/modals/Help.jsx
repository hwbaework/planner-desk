import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";

// 사용 안내 (오프라인판 openHelp)
export const opens = ["openHelp"];
export const samples = () => [["openHelp"]];

const Row = ({ k, v }) => (
  <div className="mrow"><span className="nm"><b>{k}</b></span><span className="small muted" style={{ textAlign: "right" }}>{v}</span></div>
);

export default function Help() {
  const { S } = useStore();
  return (
    <Modal title="사용 안내" buttons={[{ l: "닫기", cls: "primary", fn: closeModal }]}>
      <div className="sec-t">하루 흐름</div>
      <Row k="아침" v="대시보드 '오늘 할 일' → 지난 것부터 처리" />
      <Row k="기획 넘길 때" v="보드 '기획중' 카드 → 다음 → / 개발 전달 등록 (메일 작성 버튼)" />
      <Row k="회의 끝나고" v="메모·회의록 작성 → 액션 → 업무 만들기" />
      <Row k="화면 고칠 때" v="화면 목록 '개정' → 변경분 전달" />
      <Row k="주말 전" v="상단 주간보고 → 복사" />
      <div className="sec-t">단축키</div>
      <Row k="Ctrl+K" v="통합 검색" />
      <Row k="Esc" v="창 닫기" />
      <div className="sec-t">데이터</div>
      <Row k="자동 저장" v="고치면 바로 서버에 저장 (다른 창에도 반영)" />
      <div className="sec-t">경고가 뜨는 경우</div>
      <div className="small muted">개발 기한 지남 · 테스트 대기 · 승인 회신 없음({S.settings.approvalDays}일) · 데이터 미수신 · 결함 미전달 · 재테스트 필요 · 화면 미반영 요구사항 · 마감 지남. 기준일은 설정에서 바꿀 수 있어.</div>
    </Modal>
  );
}

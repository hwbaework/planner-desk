import { useSyncExternalStore } from "react";

// React로 옮긴 창(모달) 하나를 연다. 오프라인판 창과 같은 자리·모양 (src/components/Modal.jsx)
// 열린 동안 window.__reactModalOpen = true (오프라인판 단축키·자동 갱신이 참고)
let cur = null, seq = 0;
const subs = new Set();
const emit = () => { window.__reactModalOpen = !!cur; subs.forEach((f) => f()); };
export function openModal(Component, props = {}) { cur = { Component, props, id: ++seq }; emit(); }
// 닫을 때 이 창을 연 앞 창이 있으면(window._modalBack, 예: WBS 창에서 연 업무 창) 다시 연다 — 오프라인판 closeModal 과 같음
export function closeModal() {
  if (!cur) return;
  cur = null; emit();
  const back = window._modalBack; window._modalBack = null;
  if (back) setTimeout(back, 0);
}
export const useModal = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur, () => cur);
window.__closeReactModal = closeModal;

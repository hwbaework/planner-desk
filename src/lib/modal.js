import { useSyncExternalStore } from "react";

// React로 옮긴 창(모달) 하나를 연다. 오프라인판 창과 같은 자리·모양 (src/components/Modal.jsx)
// 열린 동안 window.__reactModalOpen = true (오프라인판 단축키·자동 갱신이 참고)
let cur = null, seq = 0;
const subs = new Set();
const emit = () => { window.__reactModalOpen = !!cur; subs.forEach((f) => f()); };
export function openModal(Component, props = {}) { cur = { Component, props, id: ++seq }; emit(); }
export function closeModal() { if (!cur) return; cur = null; emit(); }
export const useModal = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur, () => cur);
window.__closeReactModal = closeModal;

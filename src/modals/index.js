// React로 옮긴 창 목록. 각 파일은 `export const opens = ["오프라인판 함수 이름"]` 과 기본 내보내기(창 컴포넌트)를 둔다.
// 오프라인판에서 그 함수를 부르면(어디서든) 같은 인자가 컴포넌트의 args 로 넘어와 React 창이 열린다.
import { openModal } from "../lib/modal.js";
const mods = import.meta.glob("./*.jsx", { eager: true });
window.__reactModals = {};
for (const m of Object.values(mods)) for (const name of m.opens || []) window.__reactModals[name] = (...args) => openModal(m.default, { args, name });

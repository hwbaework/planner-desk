// React로 옮긴 화면 목록. 각 파일은 `export const tabs = ["탭 키"]` 와 기본 내보내기(화면 컴포넌트)를 둔다.
// 여기 등록된 탭은 오프라인판 코드가 본문(#view)을 비워 두고 React가 그린다.
const mods = import.meta.glob("./*.jsx", { eager: true });
export const VIEWS = {};
for (const m of Object.values(mods)) for (const t of m.tabs || []) VIEWS[t] = m.default;
window.__reactTabs = new Set(Object.keys(VIEWS));

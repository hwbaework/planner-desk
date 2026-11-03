// 날짜 도우미 (오프라인판과 같은 형식: "YYYY-MM-DD")
export const pad = (n) => String(n).padStart(2, "0");
export const fmtD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => fmtD(new Date());
export function parseD(s) { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); }
export const wd = (s) => "일월화수목금토"[parseD(s).getDay()];
export function stamp() { const d = new Date(); return `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`; }

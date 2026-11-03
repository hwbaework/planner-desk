// 데이터 모양과 화면 공통 상수 (오프라인판 offline/index.html 의 emptyState·normalize 기준)
// 예전 데이터 정리(마이그레이션)는 오프라인판이 이미 끝낸 상태로 가져온다고 보고 모양만 맞춘다.

export const COLS = ["projects", "tasks", "events", "recurring", "datas", "tcs", "reqs", "risks", "docs", "handoffs", "screens", "wbs", "funcs", "notes"];

export const TABS = [["dash", "대시보드"], ["cal", "캘린더"], ["timeline", "타임라인"], ["tasks", "업무"], ["risks", "이슈·리스크"], ["docs", "산출물"], ["wbs", "WBS"], ["funcs", "기능정의서"], ["screens", "화면설계서"], ["tc", "테스트 케이스"], ["notes", "메모·회의록"]];
export const NAV_SHORT = { dash: "대시", cal: "일정", timeline: "타임", tasks: "업무", risks: "이슈", docs: "산출", wbs: "WBS", funcs: "기능", screens: "화면", tc: "테스트", notes: "메모" };
export const NAV_GROUPS = [["dash", "cal", "timeline"], ["tasks", "risks", "docs"], ["wbs", "funcs", "screens", "tc"], ["notes"]];
export const NAV_SUB = ["funcs", "screens", "tc"];
export const PROJ_COLORS = ["#2563eb", "#d9473f", "#18864b", "#d47414", "#6d4fd8", "#0e8a9a", "#b5487a", "#5b6474"];

export function emptyState() {
  return {
    v: 1, updatedAt: null,
    settings: { me: "", sign: "", ackDays: 2, approvalDays: 3, quietDays: 5, verifyDays: 2, theme: "light", hoPrefix: "HO", fontScale: "1" },
    // 화면 상태: 웹판에서는 서버에 저장하지 않고 이 브라우저에만 둔다 (store.js)
    ui: { tab: "dash", pid: "all", hoFilter: "open", noteId: null, taskFilter: "open", calMonth: "", calSel: "", calKinds: { event: 1, task: 1, data: 1, ho: 1, doc: 1, recur: 1, wbs: 0 }, dataFilter: "open", dataOrg: "", board: "ho", boardGroup: "none", boardQ: "", tlZoom: "month", tlAnchor: "", tlHideDone: 1, tlMissing: 1, tlKinds: { wbs: 1, task: 1, ho: 1, data: 1, doc: 1 } },
    seq: { ho: 0, tc: 0, req: 0, risk: 0 },
    projects: [], tasks: [], events: [], recurring: [], datas: [], tcs: [], reqs: [], risks: [], docs: [], handoffs: [], screens: [], wbs: [], funcs: [], notes: [],
  };
}

export function normalize(d) {
  const e = emptyState();
  const s = { v: d?.v ?? 1, updatedAt: d?.updatedAt ?? null };
  s.settings = { ...e.settings, ...(d?.settings || {}) };
  delete s.settings.mail;
  s.seq = { ...e.seq, ...(d?.seq || {}) };
  for (const k of COLS) s[k] = Array.isArray(d?.[k]) ? d[k].filter((x) => x && typeof x === "object") : [];
  s.projects.forEach((p, i) => { if (!p.color) p.color = PROJ_COLORS[i % PROJ_COLORS.length]; });
  s.handoffs.forEach((h) => { h.events = h.events || []; h.docIds = h.docIds || []; h.screenIds = h.screenIds || []; });
  s.screens.forEach((x) => { x.history = x.history || []; });
  s.docs.forEach((x) => { x.history = x.history || []; });
  return s;
}

// 오프라인판에서 저장한 HTML(데이터 내장) 또는 JSON 내보내기 파일 → 데이터
export function parseImport(text) {
  const m = text.match(/var EMBEDDED_DATA = ([\s\S]+?); \/\*EMBEDDED_DATA_PLACEHOLDER\*\//);
  const raw = m ? m[1].trim() : text.trim();
  if (raw === "null") throw new Error("이 HTML 파일에는 데이터가 들어 있지 않아요");
  const d = JSON.parse(raw);
  if (!d || typeof d !== "object" || !Array.isArray(d.projects)) throw new Error("Planner Desk 데이터 파일이 아니에요");
  return d;
}

export const activeProjects = (S) => S.projects.filter((p) => !p.archived);
export const proj = (S, id) => S.projects.find((p) => p.id === id);

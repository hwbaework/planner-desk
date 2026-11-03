// 오프라인판(offline/index.html)의 스크립트를 웹판 모듈(src/legacy/engine.js)로 한 번 옮기는 도구.
//  - 파일 저장·불러오기·부팅 코드는 빼고, 저장은 서버 저장소(src/lib/store.js)로 연결
//  - 아직 React로 옮기지 않은 화면은 이 코드가 그대로 그린다
// 실행: node tools/make-engine.cjs   (acorn 필요: npm i --no-save acorn)
const fs = require("fs"), path = require("path"), acorn = require("acorn");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "offline/index.html"), "utf8");
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ast = acorn.parse(src, { ecmaVersion: "latest" });

// 함수를 통째로 바꿈
const REPLACE = {
  setTopH: `function setTopH() { const t = document.querySelector(".top"); if (t) document.documentElement.style.setProperty("--top-h", t.getBoundingClientRect().height + "px"); }`,
  load: "function load() {}",
  writeLocal: "function writeLocal(trackUndo) { desk.commit(!!trackUndo && !suppressUndo); }",
  persist: `function persist() {
  syncFuncTCs(); syncCodes(); syncScreens();
  S.updatedAt = new Date().toISOString();
  ["tasks", "events", "recurring", "datas", "tcs", "reqs", "risks", "docs", "handoffs", "screens", "wbs", "notes"].forEach((k) => S[k].forEach((x) => { if (x.createdAt === undefined) x.createdAt = S.updatedAt; }));
  writeLocal(true);
}`,
  undo: `function undo() {
  if (noteFlush) noteFlush();
  const left = desk.undo();
  if (left === false) { toast("되돌릴 변경이 없어"); return; }
  closeModal(); render(); toast(\`되돌림 (남은 \${left}단계)\`);
}`,
  saveFile: `function saveFile() { toast("서버에 자동 저장돼요"); }`,
  updateSaveInd: "function updateSaveInd() {}",
  updateSaveDir: "function updateSaveDir() {}",
  restoreHandle: "function restoreHandle() {}",
  useEmbedded: "function useEmbedded() {}",
  autoLoadDataFile: "function autoLoadDataFile() {}",
  renderBanner: `function renderBanner() { const el = $("bannerArea"); if (el) el.innerHTML = ""; }`,
  importFile: `function importFile(ev) {
  const f = ev.target.files[0]; ev.target.value = "";
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const txt = r.result;
      let m = txt.match(/var EMBEDDED_DATA = ([\\s\\S]+?); \\/\\*EMBEDDED_DATA_PLACEHOLDER\\*\\//);
      if (m && m[1].trim() !== "null") {
        const d = JSON.parse(m[1]);
        if (!confirm(\`Planner Desk 백업을 불러올까?\\n프로젝트 \${d.projects?.length || 0}개 · 업무 \${d.tasks?.length || 0}건 · 산출물 \${d.docs?.length || 0}건\\n서버의 현재 데이터는 덮어씌워져.\`)) return;
        desk.replaceAll(d); boot(); render(); toast("불러오기 완료"); return;
      }
      m = txt.match(/var EMBEDDED_BACKUP_DATA = ([\\s\\S]+?); \\/\\*EMBEDDED_BACKUP_PLACEHOLDER\\*\\//);
      if (m && m[1].trim() !== "null") { importLegacy(JSON.parse(m[1])); return; }
      const d = JSON.parse(txt);
      if (d.tasks && !d.handoffs) { importLegacy(d); return; }
      if (!confirm("JSON 데이터를 불러올까? 서버의 현재 데이터는 덮어씌워져.")) return;
      desk.replaceAll(d); boot(); render(); toast("불러오기 완료");
    } catch (e) { alert("불러오기 실패: " + e.message); }
  };
  r.readAsText(f, "utf-8");
}`,
};

// 맨 위에서 바로 실행되던 문장 중 뺄 것 (부팅은 boot()로, 화면 그리기는 React가)
const DROP = [/^setTopH\(\)/, /^addEventListener\("resize", setTopH\)/, /^new ResizeObserver\(setTopH\)/, /^window\.addEventListener\("beforeunload"/,
  /^load\(\)/, /^lastJson = snapshot\(\)/, /^lastCount = itemCount\(\)/, /^restoreHandle\(\)/, /^render\(\)/, /^autoLoadDataFile\(\)/,
  /^syncFuncTCs\(\)/, /^syncCodes\(\)/, /^syncScreens\(\)/, /^reidPending\(\)/, /^setTimeout\(\(\) => checkNotify\(\), 3000\)/, /^setInterval\(tick/];

// 문구·버튼 중 웹판에 안 맞는 것
const POST = [
  // React로 옮긴 화면(window.__reactTabs)은 비워 두고 React가 그림. 다시 그릴 때 React에도 알림
  [`  $("view").innerHTML = v();
  if (S.ui.tab === "wbs") wbsFreeze();
  if (S.ui.tab === "notes") bindNoteEditor();
  updateSaveInd();
`, `  const _react = window.__reactTabs?.has(S.ui.tab);
  $("view").innerHTML = _react ? "" : v();
  if (!_react && S.ui.tab === "wbs") wbsFreeze();
  if (!_react && S.ui.tab === "notes") bindNoteEditor();
  desk.touch();
`],
  ['   { l: "다른 이름으로 저장", cls: "left", fn: () => { closeModal(); saveFile(true); } },\n', ""],
  ['    ${row("Ctrl+S", "HTML로 저장")}\n', ""],
  ['${row("자동 저장", "브라우저에 바로 저장")}', '${row("자동 저장", "고치면 바로 서버에 저장 (다른 창에도 반영)")}'],
  ['    ${row("파일 저장", "저장 → 데이터가 든 HTML (다른 PC에서도 그대로)")}\n', ""],
];

let out = "", pos = 0;
const names = [], lets = new Set();
for (const n of ast.body) {
  const text = src.slice(n.start, n.end);
  let rep = null;
  if (n.type === "FunctionDeclaration") {
    names.push(n.id.name);
    if (n.id.name in REPLACE) rep = REPLACE[n.id.name];
  } else if (n.type === "VariableDeclaration") {
    n.declarations.forEach((d) => { if (d.id.type === "Identifier") { names.push(d.id.name); if (n.kind !== "const") lets.add(d.id.name); } });
    if (/^let lastTick = /.test(text)) rep = `let lastTick = { date: "", n: -1 };`;
  } else if (n.type === "ExpressionStatement" && DROP.some((r) => r.test(text))) rep = "";
  if (rep !== null) { out += src.slice(pos, n.start) + rep; pos = n.end; }
}
out += src.slice(pos);
for (const [a, b] of POST) { if (!out.includes(a)) throw new Error("못 찾음: " + a.slice(0, 60)); out = out.replace(a, b); }

const header = `/* eslint-disable */
// 자동 생성: node tools/make-engine.cjs  (원본 offline/index.html, 직접 고쳐도 됨 — 다시 생성하면 덮어씀)
// 오프라인판 화면 코드. React로 옮긴 화면은 src/views/ 에 있고, 나머지는 여기 함수가 HTML을 그린다.
import * as desk from "../lib/store.js";
`;
const footer = `
// ── 웹판 연결 ──
S = desk.S;
// 데이터를 받은 뒤 한 번: 오프라인판 부팅 때 하던 정리
function boot() { syncFuncTCs(); syncCodes(); syncScreens(); reidPending(); lastTick = { date: today(), n: computeAlerts(null).length }; }
let _booted = false;
desk.onRemote((kind) => {
  if (!_booted || kind === "snapshot") { _booted = true; boot(); }
  // 입력 중이거나 창이 열려 있으면 다시 그리지 않음 (닫을 때 그려짐)
  const a = document.activeElement, typing = a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  if (typing || $("modalBg")?.classList.contains("open")) return;
  render();
});
setTimeout(() => checkNotify(), 3000);
setInterval(tick, 30 * 60 * 1000);

// HTML 안의 onclick="함수()" 가 찾을 수 있게 전부 window에 연결
const _G = {
${names.filter((v, i, a) => a.indexOf(v) === i).map((n) => lets.has(n) || n === "S"
    ? `  ${n}: { get: () => ${n}, set: (v) => { ${n} = v; } },`
    : `  ${n}: { get: () => ${n} },`).join("\n")}
};
for (const k in _G) Object.defineProperty(window, k, { ..._G[k], configurable: true });

export { ${[...new Set(names), "boot"].join(", ")} };
`;
fs.mkdirSync(path.join(root, "src/legacy"), { recursive: true });
fs.writeFileSync(path.join(root, "src/legacy/engine.js"), header + out + footer);
console.log("src/legacy/engine.js", (header + out + footer).length, "bytes,", names.length, "names");

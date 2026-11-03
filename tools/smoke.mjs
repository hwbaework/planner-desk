// 화면 오류 점검 (브라우저 없이): 실제 데이터로 모든 화면·프로젝트·주요 창을 한 번씩 그려 본다.
// React로 옮긴 화면(src/views)은 오프라인판 함수가 그린 것과 글자 내용이 같은지도 비교한다.
// 준비: npm i --no-save jsdom
// 실행: node tools/smoke.mjs <데이터가 든 HTML 또는 JSON> [탭 키 …]   (탭을 주면 그 탭만 비교)
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";

const dataFile = process.argv[2];
const text = fs.readFileSync(dataFile, "utf8");
const m = text.match(/var EMBEDDED_DATA = ([\s\S]+?); \/\*EMBEDDED_DATA_PLACEHOLDER\*\//);
const data = JSON.parse(m ? m[1] : text);

const dom = new JSDOM(`<!DOCTYPE html><body>
<header class="top"><div id="todayLabel"></div><input id="gq"><div id="gres"></div><button id="themeBtn"></button><input type="file" id="importFile"></header>
<div class="shell"><aside id="side"></aside><main><div id="bannerArea"></div><nav id="tabs"></nav><section id="view"></section></main></div>
<div class="modal-bg" id="modalBg"><div class="modal" id="modal"><h2 id="modalTitle"></h2><div id="modalBody"></div><div id="modalFoot"></div></div></div><div id="toast"></div></body>`,
  { url: "http://localhost/", pretendToBeVisual: true });
const w = dom.window;
for (const k of ["window", "document", "localStorage", "navigator", "location", "HTMLElement", "Node", "getComputedStyle", "requestAnimationFrame", "FileReader", "Blob", "CustomEvent", "Event"]) {
  try { globalThis[k] = w[k] ?? globalThis[k]; } catch {}
}
globalThis.addEventListener = w.addEventListener.bind(w);
globalThis.ResizeObserver = class { observe() {} };
globalThis.WebSocket = class { constructor() { this.readyState = 0; } send() {} };
w.ResizeObserver = globalThis.ResizeObserver;
w.confirm = () => true; w.alert = (x) => console.log("alert:", x); globalThis.confirm = w.confirm; globalThis.alert = w.alert;
w.HTMLElement.prototype.scrollIntoView = () => {};
w.localStorage.setItem("planner-desk-web:cache", JSON.stringify(data));

// 오프라인판 코드 + React 화면을 한 번에 묶음 (같은 S를 씀)
const root = process.cwd().split(path.sep).join("/");
const only = process.argv.slice(3);
// 탭을 주면 그 탭의 화면 파일만 묶음 (다른 화면이 작업 중이어도 영향 없게)
const tabsOf = (f) => (fs.readFileSync("src/views/" + f, "utf8").match(/export const tabs = \[([^\]]*)\]/)?.[1] || "").match(/[\w-]+/g) || [];
const viewFiles = fs.readdirSync("src/views").filter((f) => f.endsWith(".jsx") && (!only.length || tabsOf(f).some((t) => only.includes(t))));
const entry = path.join(os.tmpdir(), `pd-smoke-entry-${process.pid}.jsx`);
fs.writeFileSync(entry, [
  `export * as E from "${root}/src/legacy/engine.js";`,
  `export { renderToString } from "react-dom/server";`,
  `export { createElement } from "react";`,
  ...viewFiles.map((f, i) => `import * as V${i} from "${root}/src/views/${f}";`),
  `export const VIEWS = [${viewFiles.map((f, i) => `["${f}", V${i}]`).join(", ")}];`,
].join("\n"));
const out = path.join(os.tmpdir(), `pd-smoke-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "browser", jsx: "automatic", outfile: out, logLevel: "error", nodePaths: [root + "/node_modules"], define: { "process.env.NODE_ENV": '"production"' } });
w.__reactTabs = new Set();
const { E, renderToString, createElement, VIEWS } = await import(pathToFileURL(out).href + "?" + Date.now());

const errors = [];
const run = (label, fn) => { try { fn(); } catch (e) { errors.push(`${label}: ${e.message}\n   ${(e.stack || "").split("\n")[1]?.trim()}`); } };
run("boot", () => E.boot());
const S = E.S;
const tabs = E.TABS.map((t) => t[0]).concat(["board", "data", "ho", "reqs"]);
for (const pid of ["all", ...S.projects.map((p) => p.id)]) {
  for (const tab of tabs) run(`render ${tab} @${pid === "all" ? "전체" : E.projName(pid)}`, () => { S.ui.pid = pid; S.ui.tab = tab; E.render(); });
}
S.ui.pid = "all"; S.ui.tab = "dash";
const first = (k) => S[k][0]?.id;
const modals = {
  openSettings: [], openHelp: [], openReport: [], quickCreate: [], editProject: [S.projects[0]?.id],
  editTask: [first("tasks")], editEvent: [first("events")], editRecur: [first("recurring")], openHO: [first("handoffs")], editHO: [first("handoffs")],
  editDoc: [first("docs")], editRisk: [first("risks")], editScreen: [first("screens")], editWBS: [first("wbs")], editFunc: [first("funcs")], editTC: [first("tcs")],
};
for (const [fn, args] of Object.entries(modals)) {
  if (typeof E[fn] !== "function") { errors.push(`${fn}: 없음`); continue; }
  if (args.length && args[0] === undefined) continue;
  run(`modal ${fn}`, () => { E[fn](...args); E.closeModal(); });
}
// 저장: 업무 하나를 고치면 그 업무만 서버로 감
run("commit", () => {
  E.persist();   // boot 정리분이 있으면 먼저 내보냄
  S.tasks[0].title += " (시험)"; E.commit();
  const p = JSON.parse(w.localStorage.getItem("planner-desk-web:pending") || "[]");
  const ops = p[p.length - 1].ops.filter((o) => o.t !== "meta");
  if (ops.length !== 1 || ops[0].id !== S.tasks[0].id) throw new Error("보낸 변경: " + JSON.stringify(ops.map((o) => [o.t, o.col, o.id])));
});
// React 화면 비교: 오프라인판 함수의 글자 내용과 같아야 함
const LEGACY = { funcs: "renderFuncs", dash: "renderDash", board: "renderBoard", timeline: "renderTimeline", cal: "renderCal", tasks: "renderTasks", data: "renderData", ho: "renderTasks", docs: "renderDocs", reqs: "renderReqs", risks: "renderRisks", screens: "renderScreens", wbs: "renderWBS", tc: "renderTC", notes: "renderNotes" };
const textOf = (html) => { const d = w.document.createElement("div"); d.innerHTML = html; return d.textContent.replace(/\s+/g, " ").trim(); };
let compared = 0;
for (const [file, mod] of VIEWS) {
  for (const tab of mod.tabs || []) {
    if (only.length && !only.includes(tab)) continue;
    for (const pid of ["all", ...S.projects.map((p) => p.id)]) {
      const label = `${file} ${tab} @${pid === "all" ? "전체" : E.projName(pid)}`;
      S.ui.pid = pid; S.ui.tab = tab;
      let a, b;
      try { a = textOf(E[LEGACY[tab]]()); } catch (e) { errors.push(`${label} 오프라인판: ${e.message}`); continue; }
      try { b = textOf(renderToString(createElement(mod.default))); } catch (e) { errors.push(`${label} React: ${e.message}\n   ${(e.stack || "").split("\n").slice(1, 3).join(" ")}`); continue; }
      compared++;
      if (a !== b) {
        let i = 0; while (i < a.length && a[i] === b[i]) i++;
        errors.push(`${label} 내용 다름 (${i}번째 글자부터)\n   오프라인: …${a.slice(Math.max(0, i - 40), i + 80)}\n   React   : …${b.slice(Math.max(0, i - 40), i + 80)}`);
      }
    }
  }
}
if (compared) console.log(`React 화면 비교 ${compared}건`);
console.log(`프로젝트 ${S.projects.length} · 업무 ${S.tasks.length} · WBS ${S.wbs.length}`);
console.log(errors.length ? `오류 ${errors.length}건\n` + errors.join("\n") : "오류 없음");
process.exit(errors.length ? 1 : 0);

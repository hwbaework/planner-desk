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
// 창: "m:함수이름" 을 주면 그 창 파일만 (예: m:editTask)
const opensOf = (f) => (fs.readFileSync("src/modals/" + f, "utf8").match(/export const opens = \[([^\]]*)\]/)?.[1] || "").match(/[\w-]+/g) || [];
const modalFiles = fs.readdirSync("src/modals").filter((f) => f.endsWith(".jsx") && opensOf(f).length && (!only.length || opensOf(f).some((n) => only.includes("m:" + n))));
const entry = path.join(os.tmpdir(), `pd-smoke-entry-${process.pid}.jsx`);
fs.writeFileSync(entry, [
  `export * as E from "${root}/src/legacy/engine.js";`,
  `export { renderToString } from "react-dom/server";`,
  `export { createElement } from "react";`,
  `export { default as Side, Crumbs } from "${root}/src/components/Side.jsx";`,
  `export { default as TopBar } from "${root}/src/components/TopBar.jsx";`,
  ...viewFiles.map((f, i) => `import * as V${i} from "${root}/src/views/${f}";`),
  `export const VIEWS = [${viewFiles.map((f, i) => `["${f}", V${i}]`).join(", ")}];`,
  `export { ModalHost } from "${root}/src/components/Modal.jsx";`,
  `export { closeModal as closeReactModal, openModal as openReactModal } from "${root}/src/lib/modal.js";`,
  ...modalFiles.map((f, i) => `import * as M${i} from "${root}/src/modals/${f}";`),
  `export const MODALS = [${modalFiles.map((f, i) => `["${f}", M${i}]`).join(", ")}];`,
].join("\n"));
const out = path.join(os.tmpdir(), `pd-smoke-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "browser", jsx: "automatic", external: ["*?raw"], outfile: out, logLevel: "error", nodePaths: [root + "/node_modules"], define: { "process.env.NODE_ENV": '"production"' } });
w.__reactTabs = new Set();
const { E, renderToString, createElement, VIEWS, Side, Crumbs, TopBar, ModalHost, closeReactModal, openReactModal, MODALS } = await import(pathToFileURL(out).href + "?" + Date.now());

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
const textOf = (html) => { const d = w.document.createElement("div"); d.innerHTML = html; return d.textContent.replace(/\s+/g, ""); };   // 띄어쓰기는 비교하지 않음 (템플릿 줄바꿈 공백 차이)
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
// 상단바·왼쪽 메뉴·경로 (React)
for (const pid of ["all", ...S.projects.map((p) => p.id)]) {
  S.ui.pid = pid; S.ui.tab = "tasks";
  for (const [n, C] of [["TopBar", TopBar], ["Side", Side], ["Crumbs", Crumbs]]) run(`${n} @${pid}`, () => renderToString(createElement(C)));
  // 오프라인판 renderSide·renderTabs 와 글자 비교
  run(`Side 비교 @${pid}`, () => {
    E.renderSide(); E.renderTabs();
    const a = textOf(w.document.getElementById("side").innerHTML) + " | " + textOf(w.document.getElementById("tabs").innerHTML);
    const b = textOf(renderToString(createElement(Side))) + " | " + textOf(renderToString(createElement(Crumbs)));
    if (a !== b) throw new Error(`다름
   오프라인: ${a}
   React   : ${b}`);
  });
}
// React 창 비교: 창 파일의 samples(S) 가 준 인자로 오프라인판 창과 React 창을 열어 글자 내용 비교
//  (창 파일: export const samples = (S) => [["editTask", S.tasks[0]?.id], …]  — [함수 이름, 인자 …])
let comparedM = 0;
const legacyModalText = () => textOf(["modalTitle", "modalBody", "modalFoot"].map((id) => w.document.getElementById(id).innerHTML).join(""));
for (const [file, mod] of MODALS) {
  const cases = (mod.samples?.(S) || []).filter((c) => (mod.opens || []).includes(c[0]) && c.slice(1).every((a) => a !== undefined));
  if (!cases.length) errors.push(`${file}: samples 없음 (비교 못 함)`);
  for (const [name, ...args] of cases) {
    const label = `${file} ${name}(${args.map((a) => JSON.stringify(a)).join(", ")})`;
    let a, b;
    w.__reactModals = {};
    try { E[name](...args); a = legacyModalText(); E.closeModal(); } catch (e) { errors.push(`${label} 오프라인판: ${e.message}`); continue; }
    w.__reactModals = { [name]: (...x) => openReactModal(mod.default, { args: x, name }) };
    try { E[name](...args); b = textOf(renderToString(createElement(ModalHost))); closeReactModal(); }
    catch (e) { errors.push(`${label} React: ${e.message}\n   ${(e.stack || "").split("\n").slice(1, 3).join(" ")}`); closeReactModal(); continue; }
    finally { w.__reactModals = {}; }
    comparedM++;
    if (a !== b) {
      let i = 0; while (i < a.length && a[i] === b[i]) i++;
      errors.push(`${label} 내용 다름 (${i}번째 글자부터)\n   오프라인: …${a.slice(Math.max(0, i - 40), i + 80)}\n   React   : …${b.slice(Math.max(0, i - 40), i + 80)}`);
    }
  }
}
if (comparedM) console.log(`React 창 비교 ${comparedM}건`);
if (compared) console.log(`React 화면 비교 ${compared}건`);
console.log(`프로젝트 ${S.projects.length} · 업무 ${S.tasks.length} · WBS ${S.wbs.length}`);
console.log(errors.length ? `오류 ${errors.length}건\n` + errors.join("\n") : "오류 없음");
process.exit(errors.length ? 1 : 0);

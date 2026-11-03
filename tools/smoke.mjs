// 화면 오류 점검 (브라우저 없이): 실제 데이터로 모든 화면·프로젝트·주요 창을 한 번씩 그려 본다.
// 준비: npm i --no-save jsdom esbuild
// 실행: node tools/smoke.mjs <데이터가 든 HTML 또는 JSON>
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

const out = path.join(os.tmpdir(), "pd-smoke.mjs");
await build({ entryPoints: ["src/legacy/engine.js"], bundle: true, format: "esm", platform: "neutral", mainFields: ["module", "main"], outfile: out, logLevel: "error" });
const E = await import(pathToFileURL(out).href + "?" + Date.now());

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
console.log(`프로젝트 ${S.projects.length} · 업무 ${S.tasks.length} · WBS ${S.wbs.length}`);
console.log(errors.length ? `오류 ${errors.length}건\n` + errors.join("\n") : "오류 없음");
process.exit(errors.length ? 1 : 0);

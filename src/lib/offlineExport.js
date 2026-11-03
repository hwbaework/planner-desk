import * as E from "../legacy/engine.js";
import { exportData, S } from "./store.js";

// 인터넷 없이 여는 HTML 한 파일: 오프라인판(offline/index.html)에 지금 데이터를 넣어서 내려받음
export async function exportOffline() {
  const { default: html } = await import("../../offline/index.html?raw");
  const data = JSON.stringify({ ...exportData(), ui: S.ui }).replace(/<\/(script)/gi, "<\/$1");
  E.download(E.fileName("html", E.projShortNames(), "업무관리"), html.replace("var EMBEDDED_DATA = null; /*EMBEDDED_DATA_PLACEHOLDER*/", () => `var EMBEDDED_DATA = ${data}; /*EMBEDDED_DATA_PLACEHOLDER*/`), "text/html");
}
window.__exportOffline = exportOffline;

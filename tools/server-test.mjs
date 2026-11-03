// 실행: npm run dev 를 띄운 상태에서 node tools/server-test.mjs (로컬 서버 데이터를 비움)
// 서버 시험: 가져오기 → 다른 연결에서 같은 데이터 → 항목 하나 수정·삭제 → 새 연결에 반영
const URL_ = "ws://localhost:5181/api/ws";
const open = () => new Promise((res, rej) => { const ws = new WebSocket(URL_); const q = []; ws.onmessage = (e) => q.push(JSON.parse(e.data)); ws.onopen = () => res({ ws, q }); ws.onerror = rej; });
const wait = (c, type) => new Promise((res) => { const t = setInterval(() => { const i = c.q.findIndex((m) => m.type === type); if (i >= 0) { clearInterval(t); res(c.q.splice(i, 1)[0]); } }, 20); });
for (let i = 0; i < 100; i++) { try { await fetch("http://localhost:5181/"); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
const a = await open(); await wait(a, "snapshot");
const b = await open(); await wait(b, "snapshot");
a.ws.send(JSON.stringify({ type: "replace", reqId: "r1", state: { settings: { me: "홍길동" }, projects: [{ id: "p1", name: "시험" }], tasks: [{ id: "t1", title: "가" }, { id: "t2", title: "나" }, { id: "t3", title: "다" }] } }));
console.log("ack", (await wait(a, "ack")).reqId, "| b got", (await wait(b, "snapshot")).state.tasks.length, "tasks");
a.ws.send(JSON.stringify({ type: "ops", reqId: "r2", ops: [{ t: "del", col: "tasks", id: "t1" }, { t: "put", col: "tasks", id: "t4", ord: 1.5, data: { id: "t4", title: "라" } }] }));
await wait(a, "ack"); console.log("b ops", JSON.stringify((await wait(b, "ops")).ops.map((o) => o.t + ":" + o.id)));
const c = await open(); const s = (await wait(c, "snapshot")).state;
console.log("new conn order", s.tasks.map((t) => t.title).join(","), "| me", s.settings.me);
const ex = await (await fetch("http://localhost:5181/api/export")).json();
console.log("export tasks", ex.tasks.length);
a.ws.send(JSON.stringify({ type: "replace", reqId: "r3", state: {} })); await wait(a, "ack");
process.exit(0);

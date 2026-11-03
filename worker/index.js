// Planner Desk 기획 데스크 — 데이터 서버 (Cloudflare Worker + Durable Object(SQLite) + WebSocket)
//
//  브라우저 ──WebSocket──▶ Worker ──▶ Durable Object "main" (하나)
//                                       ├ SQLite: items(종류, id, 내용, 순서), meta(설정·번호)
//                                       └ 바뀐 항목만 받아서 저장 → 열어 둔 다른 창에도 바로 반영
//
//  접속 제한은 Cloudflare Access로 한다. OWNER_EMAIL을 넣어 두면 그 메일로 로그인한 요청만 받는다.

import { DurableObject } from "cloudflare:workers";

// 화면의 상태(S)에서 배열로 들고 있는 항목 종류. 이 밖의 값(설정·번호)은 meta에 통째로 저장
export const COLS = ["projects", "tasks", "events", "recurring", "datas", "tcs", "reqs", "risks", "docs", "handoffs", "screens", "wbs", "funcs", "notes"];
const META = ["v", "updatedAt", "settings", "seq"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const owner = (env.OWNER_EMAIL || "").toLowerCase();
      const email = (request.headers.get("Cf-Access-Authenticated-User-Email") || "").toLowerCase();
      if (owner && email !== owner) return new Response("Forbidden", { status: 403 });
      const stub = env.DESK.get(env.DESK.idFromName("main"));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

const now = () => new Date().toISOString();

export class Desk extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS items (
        col TEXT NOT NULL, id TEXT NOT NULL, ord REAL DEFAULT 0, data TEXT NOT NULL, updated_at TEXT,
        PRIMARY KEY (col, id)
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, data TEXT NOT NULL);
    `);
    // 연결 유지용 ping은 객체를 깨우지 않고 자동 응답
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket only", { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);   // Hibernation: 쉬는 동안은 사용량 없음
      server.send(JSON.stringify({ type: "snapshot", state: this.state() }));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/api/export") {
      const body = JSON.stringify({ exportedAt: now(), ...this.state() });
      return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
    }

    return new Response("Not found", { status: 404 });
  }

  // 전체 상태: 화면에서 쓰는 모양 그대로 (배열 + 설정)
  state() {
    const s = {}, ords = {};
    for (const r of this.sql.exec("SELECT key, data FROM meta").toArray()) s[r.key] = JSON.parse(r.data);
    for (const c of COLS) { s[c] = []; ords[c] = []; }
    for (const r of this.sql.exec("SELECT col, ord, data FROM items ORDER BY col, ord").toArray()) if (s[r.col]) { s[r.col].push(JSON.parse(r.data)); ords[r.col].push(r.ord); }
    return { ...s, _ords: ords };   // 순서 값: 화면이 다음 변경의 순서를 정할 때 씀
  }

  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.type !== "ops" && m.type !== "replace") return;
    try {
      // 한 번에 온 변경은 전부 저장되거나 전부 안 되거나
      this.ctx.storage.transactionSync(() => {
        if (m.type === "replace") this.replace(m.state || {});
        else for (const op of m.ops || []) this.apply(op);
      });
      ws.send(JSON.stringify({ type: "ack", reqId: m.reqId }));
      // 다른 창에는 바뀐 것만 (통째로 바꾼 경우는 전체)
      if (m.type === "replace") this.broadcast({ type: "snapshot", state: this.state() }, ws);
      else this.broadcast({ type: "ops", ops: m.ops }, ws);
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", reqId: m.reqId, message: e.message }));
      ws.send(JSON.stringify({ type: "snapshot", state: this.state() }));
    }
  }

  // op: { t: "put", col, id, ord, data } | { t: "del", col, id } | { t: "meta", key, data }
  apply(op) {
    if (op.t === "meta") {
      if (!META.includes(op.key)) throw new Error("알 수 없는 설정: " + op.key);
      this.sql.exec("INSERT INTO meta(key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data=excluded.data", op.key, JSON.stringify(op.data ?? null));
      return;
    }
    if (!COLS.includes(op.col)) throw new Error("알 수 없는 종류: " + op.col);
    if (typeof op.id !== "string" || !op.id) throw new Error("id 없음");
    if (op.t === "del") { this.sql.exec("DELETE FROM items WHERE col=? AND id=?", op.col, op.id); return; }
    if (op.t === "put") {
      if (!op.data || op.data.id !== op.id) throw new Error("내용과 id가 다름");
      this.sql.exec(`INSERT INTO items(col, id, ord, data, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(col, id) DO UPDATE SET ord=excluded.ord, data=excluded.data, updated_at=excluded.updated_at`,
        op.col, op.id, Number(op.ord) || 0, JSON.stringify(op.data), now());
      return;
    }
    throw new Error("알 수 없는 변경");
  }

  // 가져오기: 기존 데이터를 지우고 통째로 바꿈
  replace(s) {
    this.sql.exec("DELETE FROM items"); this.sql.exec("DELETE FROM meta");
    for (const k of META) if (k in s) this.apply({ t: "meta", key: k, data: s[k] });
    for (const c of COLS) (Array.isArray(s[c]) ? s[c] : []).forEach((x, i) => { if (x && x.id) this.apply({ t: "put", col: c, id: String(x.id), ord: i, data: x }); });
  }

  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(s); } catch {}
    }
  }

  async webSocketClose(ws) { try { ws.close(1000, "bye"); } catch {} }
}

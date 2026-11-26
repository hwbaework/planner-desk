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

// ── 비밀번호 잠금 ───────────────────────────────────────────────
//  `npx wrangler secret put PASSWORD` 로 넣은 비밀번호를 첫 화면에서 묻는다.
//  맞으면 30일짜리 쿠키(서명값)를 주고, 화면·API·WebSocket 모두 이 쿠키가 있어야 열린다.
//  비밀번호를 바꾸면 기존 쿠키는 전부 무효가 된다. 힌트는 `npx wrangler secret put PASSWORD_HINT`.
//  비밀번호를 잊으면: 이 폴더에서 `npx wrangler secret put PASSWORD` 로 새로 넣으면 끝 (잠금도 같이 풀림).
const COOKIE = "pd_auth";
const SESSION_DAYS = 30;
const enc = new TextEncoder();

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]);
}

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function readCookie(request, name) {
  const all = request.headers.get("Cookie") || "";
  for (const part of all.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

async function signedIn(request, pw) {
  const [exp, sig] = readCookie(request, COOKIE).split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return sameText(sig, await hmac(pw, "session:" + exp));
}

function loginPage(wrong, hint) {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>기획 데스크</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f6f8;font-family:'Pretendard','Malgun Gothic',sans-serif;color:#1f2937}
form{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px 28px;width:min(320px,calc(100vw - 32px));box-sizing:border-box;box-shadow:0 4px 16px rgba(0,0,0,.05)}
h1{font-size:18px;margin:0 0 20px}
input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:15px}
input:focus{outline:none;border-color:#2563eb}
button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:15px;cursor:pointer}
p{color:#dc2626;font-size:13px;margin:10px 0 0}
details{margin-top:14px;font-size:13px;color:#6b7280}summary{cursor:pointer}
</style></head><body><form method="post" action="/__login">
<h1>기획 데스크</h1>
<input type="password" name="pw" autofocus autocomplete="current-password" aria-label="비밀번호">
<button>들어가기</button>${wrong === "locked" ? "<p>여러 번 틀려서 잠겼습니다. 1시간 뒤에 다시 해 주세요</p>" : wrong ? "<p>비밀번호가 맞지 않습니다</p>" : ""}${hint ? `<details><summary>비밀번호 찾기</summary>힌트: ${hint.replace(/[<>&"]/g, "")}</details>` : ""}
</form></body></html>`;
  return new Response(html, { status: wrong ? 401 : 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function gate(request, env) {
  const url = new URL(request.url);
  const pw = env.PASSWORD || "";
  if (!pw) {
    // 내 PC에서 npm run dev 할 때만 비밀번호 없이 열림. 배포본은 비밀번호가 없으면 닫아 둔다.
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return null;
    return new Response("비밀번호가 설정되지 않았습니다 (wrangler secret put PASSWORD)", { status: 503 });
  }
  if (url.pathname === "/__login" && request.method === "POST") {
    // 5번 틀리면 1시간 잠금 (비밀번호를 바꾸면 잠금도 풀린다)
    const desk = env.DESK.get(env.DESK.idFromName("main"));
    const tag = await hmac(pw, "lock");
    if (await desk.authLocked(tag)) return loginPage("locked", env.PASSWORD_HINT);
    const form = await request.formData();
    const given = String(form.get("pw") || "");
    if (!sameText(await hmac("pw", given), await hmac("pw", pw))) {
      await desk.authFail(tag);
      await new Promise((r) => setTimeout(r, 1000));   // 마구 넣어 보기 늦추기
      return loginPage(true, env.PASSWORD_HINT);
    }
    await desk.authOk(tag);
    const exp = Date.now() + SESSION_DAYS * 86400000;
    const value = `${exp}.${await hmac(pw, "session:" + exp)}`;
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Set-Cookie": `${COOKIE}=${value}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }
  if (await signedIn(request, pw)) return null;
  if (url.pathname.startsWith("/api/")) return new Response("Unauthorized", { status: 401 });
  return loginPage(false, env.PASSWORD_HINT);
}

export default {
  async fetch(request, env) {
    const blocked = await gate(request, env);
    if (blocked) return blocked;
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

  // ── 비밀번호 잠금 기록 (틀린 횟수) ──
  authRead(tag) {
    const row = [...this.sql.exec("SELECT data FROM meta WHERE key = 'auth'")][0];
    const a = row ? JSON.parse(row.data) : {};
    return a.tag === tag ? a : { tag, fails: 0, until: 0 };
  }
  authWrite(a) {
    this.sql.exec("INSERT OR REPLACE INTO meta (key, data) VALUES ('auth', ?)", JSON.stringify(a));
  }
  authLocked(tag) {
    return this.authRead(tag).until > Date.now();
  }
  authFail(tag) {
    const a = this.authRead(tag);
    if (a.until && a.until <= Date.now()) { a.fails = 0; a.until = 0; }
    a.fails += 1;
    if (a.fails >= 5) a.until = Date.now() + 3600000;
    this.authWrite(a);
  }
  authOk(tag) {
    this.authWrite({ tag, fails: 0, until: 0 });
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
    for (const r of this.sql.exec("SELECT key, data FROM meta WHERE key != 'auth'").toArray()) s[r.key] = JSON.parse(r.data);
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

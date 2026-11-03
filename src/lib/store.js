import { useSyncExternalStore } from "react";
import { COLS, normalize, emptyState } from "./model.js";

// 서버(worker/index.js)와 주고받는 데이터.
//  - 화면은 지금까지처럼 상태 S 하나를 고친다: update((S) => { S.tasks.push(...) })
//  - 고친 뒤 이전 상태와 비교해 바뀐 항목만 서버로 보냄 (put / del / meta)
//  - 서버 확인 전 변경은 pending에 두고 브라우저에도 보관 → 끊겼다 붙으면 다시 보냄 (같은 id라 중복 안 생김)
//  - 마지막으로 받은 상태는 브라우저에 보관해서 다음에 열 때 바로 보여줌

const CACHE_KEY = "planner-desk-web:cache";
const PENDING_KEY = "planner-desk-web:pending";
const UI_KEY = "planner-desk-web:ui";
const META = ["v", "updatedAt", "settings", "seq"];

const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let S = normalize(lsGet(CACHE_KEY) || emptyState());
let base = index(S);                 // 서버와 맞춰진 마지막 모습: { col: Map(id → [json, ord]) , meta: {key: json} }
let pending = lsGet(PENDING_KEY) || [];
let ui = { ...emptyState().ui, ...(lsGet(UI_KEY) || {}) };
let ws = null, conn = "connecting", retry = 0, started = false, loaded = !!lsGet(CACHE_KEY);
let undoStack = [], lastPushAt = 0;

function index(s, ords) {
  const b = { meta: {} };
  for (const c of COLS) b[c] = new Map((s[c] || []).map((x, i) => [x.id, [JSON.stringify(x), ords?.[c]?.[i] ?? i]]));
  for (const k of META) b.meta[k] = JSON.stringify(s[k] ?? null);
  return b;
}

// ── 구독 ──
let snap = null;
const subs = new Set();
function emit() { snap = null; subs.forEach((f) => f()); }
function getSnap() {
  if (!snap) snap = { S, ui, conn, loaded, pending: pending.length, canUndo: undoStack.length > 0 };
  return snap;
}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const useStore = () => useSyncExternalStore(subscribe, getSnap);
export const getState = () => S;

// ── 알림(토스트) ──
const listeners = new Set();
export function onToast(f) { listeners.add(f); return () => listeners.delete(f); }
export const toast = (text, opts = {}) => listeners.forEach((f) => f({ text, ...opts }));

// ── 화면 상태(보던 탭·프로젝트 등): 이 브라우저에만 ──
export function setUI(patch) {
  ui = { ...ui, ...(typeof patch === "function" ? patch(ui) : patch) };
  lsSet(UI_KEY, ui); emit();
}

// ── 데이터 고치기 ──
// fn(S)이 S를 직접 고치면, 바뀐 항목을 찾아 서버로 보내고 화면을 다시 그린다
export function update(fn, { undo = true } = {}) {
  const before = JSON.stringify(strip(S));
  fn(S);
  const ops = diff();
  if (!ops.length) return;
  if (undo && (ops.some((o) => o.t === "del") || Date.now() - lastPushAt > 1000)) {
    undoStack.push(before); if (undoStack.length > 30) undoStack.shift(); lastPushAt = Date.now();
  }
  S.updatedAt = new Date().toISOString();
  ops.push(...diff());
  send(ops);
}
export function undo() {
  if (!undoStack.length) { toast("되돌릴 변경이 없어요"); return; }
  const prev = JSON.parse(undoStack.pop());
  update((s) => { Object.assign(s, normalize(prev)); }, { undo: false });
  toast(`되돌림 (남은 ${undoStack.length}단계)`);
}

function strip(s) { const o = {}; for (const k of [...META, ...COLS]) o[k] = s[k]; return o; }

// 바뀐 것만 골라 op로. 바뀐 항목·배열은 새 객체로 바꿔 React가 알아채게 함
function diff() {
  const ops = [];
  const next = { ...S };
  for (const c of COLS) {
    const arr = S[c] || [], old = base[c], seen = new Set();
    let changed = false, last = -Infinity;
    // 순서(ord)는 앞뒤 항목 사이 값으로 → 하나 지우거나 끼워 넣어도 나머지는 다시 안 보냄
    const nextOrd = (i) => { for (let j = i + 1; j < arr.length; j++) { const p = old.get(arr[j].id); if (p && p[1] > last) return p[1]; } return null; };
    const out = arr.map((x, i) => {
      if (!x.id) x.id = uid(c[0]);
      seen.add(x.id);
      const json = JSON.stringify(x), prev = old.get(x.id);
      if (prev && prev[0] === json && prev[1] > last) { last = prev[1]; return x; }
      const ord = prev && prev[1] > last && (nextOrd(i) ?? Infinity) > prev[1] ? prev[1]
        : (() => { const n = nextOrd(i); return n == null ? (last === -Infinity ? 0 : last + 1) : last === -Infinity ? n - 1 : (last + n) / 2; })();
      last = ord; changed = true;
      ops.push({ t: "put", col: c, id: x.id, ord, data: JSON.parse(json) });
      old.set(x.id, [json, ord]);
      return { ...x };
    });
    for (const id of [...old.keys()]) if (!seen.has(id)) { ops.push({ t: "del", col: c, id }); old.delete(id); changed = true; }
    if (changed) next[c] = out;
  }
  for (const k of META) {
    const json = JSON.stringify(S[k] ?? null);
    if (base.meta[k] !== json) { ops.push({ t: "meta", key: k, data: JSON.parse(json) }); base.meta[k] = json; if (S[k] && typeof S[k] === "object") next[k] = { ...S[k] }; }
  }
  S = next;
  return ops;
}

// 가져오기: 서버 데이터를 통째로 바꿈
export function replaceAll(data) {
  undoStack.push(JSON.stringify(strip(S)));
  S = normalize(data); base = index(S);
  const msg = { type: "replace", reqId: uid("r"), state: strip(S) };
  pending.push(msg); savePending(); lsSet(CACHE_KEY, strip(S));
  wsSend(msg); emit();
}

function send(ops) {
  const msg = { type: "ops", reqId: uid("r"), ops };
  pending.push(msg); savePending(); lsSet(CACHE_KEY, strip(S));
  wsSend(msg); emit();
}
function savePending() { lsSet(PENDING_KEY, pending); }
function wsSend(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

// ── 연결 ──
export function connect() {
  if (!started) {
    started = true;
    setInterval(() => { if (ws && ws.readyState === 1) ws.send("ping"); }, 30000);
    addEventListener("online", () => { if (!ws || ws.readyState > 1) open(); });
  }
  open();
}
function open() {
  conn = retry ? "reconnecting" : "connecting"; emit();
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`);
  ws.onopen = () => { retry = 0; };
  ws.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch {} };
  ws.onclose = () => {
    conn = "offline"; emit();
    const wait = Math.min(15000, 500 * 2 ** retry++);
    setTimeout(open, wait);
  };
}

function handle(m) {
  switch (m.type) {
    case "snapshot": {
      conn = "online"; loaded = true;
      S = normalize(m.state); base = index(S, m.state._ords);
      // 아직 확인 안 된 내 변경은 다시 얹고 다시 보냄
      for (const p of pending) { applyMsg(p); wsSend(p); }
      lsSet(CACHE_KEY, strip(S));
      break;
    }
    case "ack":
      pending = pending.filter((p) => p.reqId !== m.reqId); savePending();
      break;
    case "error":
      pending = pending.filter((p) => p.reqId !== m.reqId); savePending();
      toast("저장 안 됨: " + m.message, { level: "danger" });
      break;
    case "ops":   // 다른 창에서 고친 것
      applyMsg(m); lsSet(CACHE_KEY, strip(S));
      break;
  }
  emit();
}

// 받은 변경을 S와 base에 반영
function applyMsg(m) {
  if (m.type === "replace") { S = normalize(m.state); base = index(S, m.state._ords); return; }
  const next = { ...S };
  for (const op of m.ops || []) {
    if (op.t === "meta") { next[op.key] = op.data; base.meta[op.key] = JSON.stringify(op.data ?? null); continue; }
    const arr = (next[op.col] = [...(next[op.col] || [])]), b = base[op.col];
    const i = arr.findIndex((x) => x.id === op.id);
    if (i >= 0) arr.splice(i, 1);
    if (op.t === "del") { b.delete(op.id); continue; }
    // ord가 더 큰 첫 항목 앞에 끼움
    const at = arr.findIndex((x) => (b.get(x.id)?.[1] ?? Infinity) > op.ord);
    arr.splice(at < 0 ? arr.length : at, 0, op.data);
    b.set(op.id, [JSON.stringify(op.data), op.ord]);
  }
  S = next;
}

export const uid = (p = "x") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

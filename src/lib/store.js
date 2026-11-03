import { useSyncExternalStore } from "react";
import { COLS, normalize, emptyState } from "./model.js";

// 서버(worker/index.js)와 주고받는 데이터.
//  - 상태 S는 객체 하나를 계속 쓴다 (화면 코드가 S를 직접 고치고 commit() 하는 방식 그대로)
//  - commit() 때 이전 모습과 비교해 바뀐 항목만 서버로 보냄 (put / del / meta)
//  - 서버 확인 전 변경은 pending에 두고 브라우저에도 보관 → 끊겼다 붙으면 다시 보냄 (같은 id라 중복 안 생김)
//  - 마지막으로 받은 상태는 브라우저에 보관해서 다음에 열 때 바로 보여줌
//  - S.ui(보던 탭·프로젝트 등)는 서버에 보내지 않고 이 브라우저에만 둔다

const CACHE_KEY = "planner-desk-web:cache";
const PENDING_KEY = "planner-desk-web:pending";
const UI_KEY = "planner-desk-web:ui";
const META = ["v", "updatedAt", "settings", "seq"];

const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const S = {};
const cache = lsGet(CACHE_KEY);
assign(cache || emptyState());
S.ui = mergeUI(lsGet(UI_KEY));
let base = index(S);                 // 서버와 맞춰진 마지막 모습: { col: Map(id → [json, ord]), meta: {key: json} }
let pending = lsGet(PENDING_KEY) || [];
let ws = null, conn = "connecting", retry = 0, started = false, loaded = !!cache;
let undoStack = [], lastJson = JSON.stringify(strip(S)), lastPushAt = 0, lastCount = count();

function mergeUI(u) {
  const e = emptyState().ui;
  return { ...e, ...(u || {}), calKinds: { ...e.calKinds, ...(u?.calKinds || {}) }, tlKinds: { ...e.tlKinds, ...(u?.tlKinds || {}) } };
}
// S를 새 데이터로 바꾸되 객체는 그대로 (화면 상태 ui는 유지)
function assign(d) {
  const n = normalize(d);
  for (const k of Object.keys(S)) if (k !== "ui") delete S[k];
  Object.assign(S, n);
}
function strip(s) { const o = {}; for (const k of [...META, ...COLS]) o[k] = s[k]; return o; }
function count() { return COLS.reduce((a, c) => a + (S[c] || []).length, 0); }
function index(s, ords) {
  const b = { meta: {} };
  for (const c of COLS) b[c] = new Map((s[c] || []).map((x, i) => [x.id, [JSON.stringify(x), ords?.[c]?.[i] ?? i]]));
  for (const k of META) b.meta[k] = JSON.stringify(s[k] ?? null);
  return b;
}

// ── 구독 ──
let version = 0, snap = null;
const subs = new Set();
function emit() { version++; snap = null; subs.forEach((f) => f()); }
function getSnap() {
  if (!snap) snap = { S, ui: S.ui, version, conn, loaded, pending: pending.length, canUndo: undoStack.length > 0 };
  return snap;
}
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const useStore = () => useSyncExternalStore(subscribe, getSnap);
export const getState = () => S;

// 서버·다른 창에서 데이터가 바뀌었을 때 (화면을 다시 그려야 함)
const remoteSubs = new Set();
export function onRemote(f) { remoteSubs.add(f); return () => remoteSubs.delete(f); }
const fireRemote = (kind) => remoteSubs.forEach((f) => f(kind));

// ── 알림(토스트) ──
const listeners = new Set();
export function onToast(f) { listeners.add(f); return () => listeners.delete(f); }
export const toast = (text, opts = {}) => listeners.forEach((f) => f({ text, ...opts }));

// ── 화면 상태: 이 브라우저에만 ──
export function setUI(patch) {
  Object.assign(S.ui, typeof patch === "function" ? patch(S.ui) : patch);
  lsSet(UI_KEY, S.ui); emit();
}

// ── 데이터 고치기 ──
// S를 직접 고친 뒤 commit(). 되돌리기 단계는 1초에 한 번(지운 경우는 바로) 쌓는다
export function commit(trackUndo = true) {
  const json = JSON.stringify(strip(S)), n = count();
  const removed = n < lastCount; lastCount = n;
  if (trackUndo && json !== lastJson && (removed || Date.now() - lastPushAt > 1000)) {
    undoStack.push(lastJson); if (undoStack.length > 30) undoStack.shift(); lastPushAt = Date.now();
  }
  lastJson = json;
  lsSet(UI_KEY, S.ui);
  const ops = diff();
  if (ops.length) send(ops); else emit();
}
export function update(fn, { undo = true } = {}) {
  fn(S);
  S.updatedAt = new Date().toISOString();
  commit(undo);
}
export function undo() {
  if (!undoStack.length) return false;
  assign(JSON.parse(undoStack.pop()));
  lastJson = JSON.stringify(strip(S)); lastCount = count(); lastPushAt = 0;
  const ops = diff();
  if (ops.length) send(ops); else emit();
  return undoStack.length;
}
export const undoCount = () => undoStack.length;

// 바뀐 것만 골라 op로
function diff() {
  const ops = [];
  for (const c of COLS) {
    const arr = S[c] || (S[c] = []), old = base[c], seen = new Set();
    let last = -Infinity;
    // 순서(ord)는 앞뒤 항목 사이 값으로 → 하나 지우거나 끼워 넣어도 나머지는 다시 안 보냄
    const nextOrd = (i) => { for (let j = i + 1; j < arr.length; j++) { const p = old.get(arr[j].id); if (p && p[1] > last) return p[1]; } return null; };
    arr.forEach((x, i) => {
      if (!x.id) x.id = uid(c[0]);
      if (seen.has(x.id)) return;
      seen.add(x.id);
      const json = JSON.stringify(x), prev = old.get(x.id);
      if (prev && prev[0] === json && prev[1] > last) { last = prev[1]; return; }
      const n = nextOrd(i);
      const ord = prev && prev[1] > last && (n ?? Infinity) > prev[1] ? prev[1]
        : n == null ? (last === -Infinity ? 0 : last + 1) : last === -Infinity ? n - 1 : (last + n) / 2;
      last = ord;
      ops.push({ t: "put", col: c, id: x.id, ord, data: JSON.parse(json) });
      old.set(x.id, [json, ord]);
    });
    for (const id of [...old.keys()]) if (!seen.has(id)) { ops.push({ t: "del", col: c, id }); old.delete(id); }
  }
  for (const k of META) {
    const json = JSON.stringify(S[k] ?? null);
    if (base.meta[k] !== json) { ops.push({ t: "meta", key: k, data: JSON.parse(json) }); base.meta[k] = json; }
  }
  return ops;
}

// 가져오기: 서버 데이터를 통째로 바꿈
export function replaceAll(data) {
  undoStack.push(lastJson);
  assign(data); base = index(S);
  lastJson = JSON.stringify(strip(S)); lastCount = count();
  const msg = { type: "replace", reqId: uid("r"), state: strip(S) };
  pending.push(msg); savePending(); lsSet(CACHE_KEY, strip(S));
  wsSend(msg); emit();
}
export const exportData = () => strip(S);

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
  ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } handle(m); };
  ws.onclose = () => {
    conn = "offline"; emit();
    setTimeout(open, Math.min(15000, 500 * 2 ** retry++));
  };
}

function handle(m) {
  switch (m.type) {
    case "snapshot": {
      const first = !loaded || conn !== "online";
      conn = "online"; loaded = true;
      assign(m.state); base = index(S, m.state._ords);
      // 아직 확인 안 된 내 변경은 다시 얹고 다시 보냄
      for (const p of pending) { applyMsg(p); wsSend(p); }
      lastJson = JSON.stringify(strip(S)); lastCount = count();
      lsSet(CACHE_KEY, strip(S));
      emit(); fireRemote(first ? "snapshot" : "remote");
      return;
    }
    case "ack":
      pending = pending.filter((p) => p.reqId !== m.reqId); savePending();
      break;
    case "error":
      pending = pending.filter((p) => p.reqId !== m.reqId); savePending();
      toast("저장 안 됨: " + m.message, { level: "danger" });
      break;
    case "ops":   // 다른 창에서 고친 것
      applyMsg(m); lastJson = JSON.stringify(strip(S)); lastCount = count();
      lsSet(CACHE_KEY, strip(S));
      emit(); fireRemote("remote");
      return;
  }
  emit();
}

// 받은 변경을 S와 base에 반영 (배열은 그대로 두고 안에서 고침)
function applyMsg(m) {
  if (m.type === "replace") { assign(m.state); base = index(S); return; }
  for (const op of m.ops || []) {
    if (op.t === "meta") { S[op.key] = op.data; base.meta[op.key] = JSON.stringify(op.data ?? null); continue; }
    const arr = S[op.col], b = base[op.col];
    const i = arr.findIndex((x) => x.id === op.id);
    if (i >= 0) arr.splice(i, 1);
    if (op.t === "del") { b.delete(op.id); continue; }
    // ord가 더 큰 첫 항목 앞에 끼움
    const at = arr.findIndex((x) => (b.get(x.id)?.[1] ?? Infinity) > op.ord);
    arr.splice(at < 0 ? arr.length : at, 0, op.data);
    b.set(op.id, [JSON.stringify(op.data), op.ord]);
  }
}

export const uid = (p = "x") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

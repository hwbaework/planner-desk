import { useEffect, useRef, useState } from "react";
import * as E from "../../legacy/engine.js";
import { closeModal } from "../../lib/modal.js";

// 오프라인판 openForm 을 JSX로: 칸 정의(fields)를 그대로 받아 같은 마크업으로 그린다.
// (src/modals 바로 아래 .jsx 는 창 파일로 읽히므로 도우미는 이 폴더에 둔다)
//  - useForm(fields, obj, onSave) → { vals, set, cell, save, formRef }
//    cell(f): 칸 하나 / save(): 필수값 → 시작·종료일 → onSave(v) → 닫기 (닫았으면 true)
//  - t:"raw" 칸의 btn·html, t:"html" 칸의 html 은 JSX
const optPair = (o) => (Array.isArray(o) ? o : [o, o]);
const pick = (obj, f) => (obj[f.k] !== undefined && obj[f.k] !== null && obj[f.k] !== "" ? obj[f.k] : f.v ?? "");
const NOVAL = ["ro", "html", "raw", "sec"];

function initVals(fields, obj) {
  const v = {};
  for (const f of fields) {
    const x = pick(obj, f);
    if (f.t === "period") { v[f.k[0]] = String(obj[f.k[0]] || ""); v[f.k[1]] = String(obj[f.k[1]] || ""); }
    else if (f.t === "multi") v[f.k] = [...(x || [])];
    else if (f.t === "check") v[f.k] = !!x;
    else if (f.t === "select") {
      // 목록에 없는 값이면 브라우저처럼 첫 항목
      const vals = f.opts.map((o) => String(optPair(o)[0]));
      v[f.k] = vals.includes(String(x)) ? String(x) : vals[0] ?? "";
    } else if (!NOVAL.includes(f.t)) v[f.k] = String(x);
  }
  return v;
}

export const isWide = (fields) => fields.length > 9 || fields.some((f) => f.side);
export const formButtons = (extraBtns, save) => [...extraBtns, { l: "취소", close: true }, { l: "저장", cls: "primary", fn: save }];

export function useForm(fields, obj, onSave) {
  const [vals, setVals] = useState(() => initVals(fields, obj));
  const set = (k, x) => setVals((o) => ({ ...o, [k]: x }));
  const formRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => formRef.current?.querySelector("[data-k]")?.focus(), 30); return () => clearTimeout(t); }, []);

  // 조건 칸: 기준 칸 값이 맞을 때만 보임
  const test = (k, want) => { if (!(k in vals)) return true; return want.startsWith("!") ? vals[k] !== want.slice(1) : vals[k] === want; };
  const shown = (f) => !f.show || (test(f.show[0], f.show[1]) && (!f.show[2] || test(f.show[2], f.show[3])));

  const cell = (f, i) => {
    const v = vals[f.k];
    let input;
    if (f.t === "textarea") input = <textarea data-k={f.k} placeholder={f.ph || ""} value={v} onChange={(e) => set(f.k, e.target.value)} />;
    else if (f.t === "select") input = (
      <select data-k={f.k} value={v} onChange={(e) => set(f.k, e.target.value)}>
        {f.opts.map((o) => { const [ov, ol] = optPair(o); return <option key={ov} value={ov}>{ol}</option>; })}
      </select>
    );
    else if (f.t === "multi") input = f.opts.length
      ? <select multiple data-k={f.k} data-multi="1" value={v} onChange={(e) => set(f.k, [...e.target.selectedOptions].map((o) => o.value))}>
          {f.opts.map(([ov, ol]) => <option key={ov} value={ov}>{ol}</option>)}
        </select>
      : <div className="muted small">(등록된 항목 없음)</div>;
    else if (f.t === "ro") input = <input type="text" value={String(pick(obj, f))} disabled readOnly className="mono" />;
    else if (f.t === "html") input = <div className="ro-box">{f.html || <span className="muted">-</span>}</div>;
    else if (f.t === "raw") return <div key={f.k} className={f.full ? "full" : ""}><label className="raw-l">{f.l}{f.btn || null}</label>{f.html}</div>;
    else if (f.t === "sec") return <div key={i} className="full form-sec">{f.l}</div>;
    else if (f.t === "check") return (
      <div key={f.k} className="full"><label className="check"><input type="checkbox" data-k={f.k} data-check="1" checked={v} onChange={(e) => set(f.k, e.target.checked)} /> {f.l}</label></div>
    );
    else if (f.t === "period") {
      const [a, b] = f.k;
      return (
        <div key={a} className="full"><label>{f.l}</label><div className="date-pair">
          <input type="date" data-k={a} value={vals[a]} max={vals[b]} onChange={(e) => set(a, e.target.value)} />
          <span className="muted">~</span>
          <input type="date" data-k={b} value={vals[b]} min={vals[a]} onChange={(e) => set(b, e.target.value)} />
        </div></div>
      );
    }
    else input = (
      <>
        <input type={f.t} data-k={f.k} value={v} placeholder={f.ph || ""} list={f.list ? `dl_${f.k}` : undefined} onChange={(e) => set(f.k, e.target.value)} />
        {f.list ? <datalist id={`dl_${f.k}`}>{f.list.map((o) => <option key={o} value={o} />)}</datalist> : null}
      </>
    );
    return (
      <div key={f.k} className={f.full ? "full" : ""} style={shown(f) ? undefined : { display: "none" }}>
        <label>{f.l}{f.req ? <> <span className="req">*</span></> : null}</label>{input}{f.hint ? <div className="hint">{f.hint}</div> : null}
      </div>
    );
  };

  const save = () => {
    const v = {};
    for (const f of fields) {
      if (f.t === "multi") v[f.k] = f.opts.length ? [...vals[f.k]] : [];
      else if (f.t === "check") v[f.k] = vals[f.k];
      else if (f.t === "period") { v[f.k[0]] = vals[f.k[0]].trim(); v[f.k[1]] = vals[f.k[1]].trim(); }
      else if (!NOVAL.includes(f.t)) v[f.k] = String(vals[f.k]).trim();
    }
    const miss = fields.find((f) => f.req && !v[f.k]);
    if (miss) { E.toast(`${miss.l} 입력 필요`); return false; }
    if (v.start && ((v.end && v.start > v.end) || (v.due && v.start > v.due))) { E.toast("시작일이 종료일보다 늦을 수 없어"); return false; }
    if (onSave(v) === false) return false;
    closeModal();
    return true;
  };

  return { vals, set, cell, save, formRef };
}

// 오프라인판 openForm 의 기본 배치 (extraPos = "below")
export function FormBody({ form, fields, extra = null }) {
  const side = fields.filter((f) => f.side);
  if (!side.length) return <><div className="form" id="fForm" ref={form.formRef}>{fields.map(form.cell)}</div>{extra}</>;
  return (
    <>
      <div className="form-split" id="fForm" ref={form.formRef}>
        <div className="fs-main"><div className="form">{fields.filter((f) => !f.side).map(form.cell)}</div></div>
        <div className="fs-side">{side.map(form.cell)}</div>
      </div>
      {extra ? <div className="form-below">{extra}</div> : null}
    </>
  );
}

// 창 없이 끝나는 경우(프로젝트 없음 안내 등): 열린 React 창을 닫고 한 번만 실행
export function Run({ fn }) {
  const done = useRef(false);
  useEffect(() => { if (done.current) return; done.current = true; closeModal(); fn(); }, []);
  return null;
}

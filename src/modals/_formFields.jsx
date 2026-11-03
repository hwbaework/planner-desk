import { useEffect, useRef, useState } from "react";
import * as E from "../legacy/engine.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";

// 오프라인판 openForm(title, fields, obj, onSave, extraBtns) 을 그대로 그리는 창 (extraHtml 없음)
//  - 칸 정의(fields)는 오프라인판 xxxFields() 를 그대로 받는다
//  - 저장: 필수값 확인 → 시작일·종료일 확인 → onSave(v) → 닫기
const optPair = (o) => (Array.isArray(o) ? o : [o, o]);
const pick = (obj, f) => (obj[f.k] !== undefined && obj[f.k] !== null && obj[f.k] !== "" ? obj[f.k] : f.v ?? "");

function initVals(fields, obj) {
  const v = {};
  for (const f of fields) {
    const x = pick(obj, f);
    if (f.t === "multi") v[f.k] = [...(x || [])];
    else if (f.t === "check") v[f.k] = !!x;
    else if (f.t === "period") { v[f.k[0]] = obj[f.k[0]] || ""; v[f.k[1]] = obj[f.k[1]] || ""; }
    else if (f.t === "select") {
      // 목록에 없는 값이면 브라우저처럼 첫 항목
      const vals = f.opts.map((o) => String(optPair(o)[0]));
      v[f.k] = vals.includes(String(x)) ? String(x) : vals[0] ?? "";
    } else if (!["ro", "html", "raw", "sec"].includes(f.t)) v[f.k] = String(x);
  }
  return v;
}

export function FormModal({ title, fields, obj, onSave, extraBtns = [] }) {
  const [vals, setVals] = useState(() => initVals(fields, obj));
  const set = (k, x) => setVals((o) => ({ ...o, [k]: x }));
  const formRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => formRef.current?.querySelector("[data-k]")?.focus(), 30); return () => clearTimeout(t); }, []);

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
    else if (f.t === "ro") input = <input type="text" value={pick(obj, f)} disabled className="mono" readOnly />;
    else if (f.t === "sec") return <div key={i} className="full form-sec">{f.l}</div>;
    else if (f.t === "check") return (
      <div key={i} className="full"><label className="check"><input type="checkbox" data-k={f.k} data-check="1" checked={v} onChange={(e) => set(f.k, e.target.checked)} /> {f.l}</label></div>
    );
    else if (f.t === "period") {
      const [a, b] = f.k;
      return (
        <div key={i} className="full"><label>{f.l}</label><div className="date-pair">
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
      <div key={i} className={f.full ? "full" : ""} style={shown(f) ? undefined : { display: "none" }}>
        <label>{f.l}{f.req ? <> <span className="req">*</span></> : null}</label>{input}{f.hint ? <div className="hint">{f.hint}</div> : null}
      </div>
    );
  };

  const save = () => {
    const v = {};
    fields.filter((f) => f.t === "multi").forEach((f) => (v[f.k] = []));
    for (const f of fields) {
      if (f.t === "multi") { if (f.opts.length) v[f.k] = vals[f.k]; }
      else if (f.t === "check") v[f.k] = vals[f.k];
      else if (f.t === "period") { v[f.k[0]] = vals[f.k[0]].trim(); v[f.k[1]] = vals[f.k[1]].trim(); }
      else if (f.k in vals && !["ro", "html", "raw", "sec"].includes(f.t)) v[f.k] = String(vals[f.k]).trim();
    }
    const miss = fields.find((f) => f.req && !v[f.k]);
    if (miss) { E.toast(`${miss.l} 입력 필요`); return; }
    if (v.start && ((v.end && v.start > v.end) || (v.due && v.start > v.due))) { E.toast("시작일이 종료일보다 늦을 수 없어"); return; }
    if (onSave(v) !== false) closeModal();
  };

  const side = fields.filter((f) => f.side);
  return (
    <Modal title={title} wide={fields.length > 9 || side.length > 0}
      buttons={[...extraBtns, { l: "취소", close: true, fn: closeModal }, { l: "저장", cls: "primary", fn: save }]}>
      {side.length
        ? <div className="form-split" id="fForm" ref={formRef}>
            <div className="fs-main"><div className="form">{fields.filter((f) => !f.side).map(cell)}</div></div>
            <div className="fs-side">{side.map(cell)}</div>
          </div>
        : <div className="form" id="fForm" ref={formRef}>{fields.map(cell)}</div>}
    </Modal>
  );
}

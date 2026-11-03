import { useEffect, useRef, useState } from "react";
import * as E from "../legacy/engine.js";
import { Modal } from "../components/Modal.jsx";

// 오프라인판 openForm(title, fields, obj, onSave, extraBtns, extraHtml, extraPos="below") 과 같은 창
//  - fields: 오프라인판 칸 정의 그대로. t:"html" 칸의 html 은 JSX(없으면 "-")
//  - extra: 오프라인판 extraHtml 자리 (JSX, 칸 아래)
//  - onSave(v): false → 창 유지, KEEP → 저장 후 닫지 않음 (onSave 안에서 다른 창을 연 경우), 그 밖 → 닫기
export const KEEP = Symbol("keep");
const optPair = (o) => (Array.isArray(o) ? o : [o, o]);
const pick = (obj, f) => (obj[f.k] !== undefined && obj[f.k] !== null && obj[f.k] !== "" ? obj[f.k] : f.v ?? "");
const NOVAL = ["ro", "html", "raw", "sec"];

function initVal(f, obj) {
  const x = pick(obj, f);
  if (f.t === "multi") { const has = x || []; return f.opts.map(([ov]) => ov).filter((ov) => has.includes(ov)); }
  if (f.t === "check") return !!x;
  if (f.t === "select") {
    // 목록에 없는 값이면 브라우저처럼 첫 항목
    const vals = f.opts.map((o) => String(optPair(o)[0]));
    return vals.includes(String(x)) ? String(x) : vals[0] ?? "";
  }
  return String(x);
}
function initVals(fields, obj) {
  const v = {};
  for (const f of fields) {
    if (f.t === "period") { v[f.k[0]] = String(obj[f.k[0]] || ""); v[f.k[1]] = String(obj[f.k[1]] || ""); }
    else if (!NOVAL.includes(f.t)) v[f.k] = initVal(f, obj);
  }
  return v;
}

export function OpenForm({ title, fields, obj, onSave, extraBtns = [], extra = null }) {
  const [vals, setVals] = useState(() => initVals(fields, obj));
  const set = (k, x) => setVals((o) => ({ ...o, [k]: x }));
  const val = (f, k = f.k) => (k in vals ? vals[k] : f.t === "period" ? String(obj[k] || "") : initVal(f, obj));
  const formRef = useRef(null);
  useEffect(() => { const t = setTimeout(() => formRef.current?.querySelector("[data-k]")?.focus(), 30); return () => clearTimeout(t); }, []);

  const cell = (f, i) => {
    let input;
    if (f.t === "textarea") input = <textarea data-k={f.k} placeholder={f.ph || ""} value={val(f)} onChange={(e) => set(f.k, e.target.value)} />;
    else if (f.t === "select") input = (
      <select data-k={f.k} value={val(f)} onChange={(e) => set(f.k, e.target.value)}>
        {f.opts.map((o) => { const [ov, ol] = optPair(o); return <option key={ov} value={ov}>{ol}</option>; })}
      </select>
    );
    else if (f.t === "multi") input = f.opts.length
      ? <select multiple data-k={f.k} data-multi="1" value={val(f)} onChange={(e) => set(f.k, [...e.target.selectedOptions].map((o) => o.value))}>
          {f.opts.map(([ov, ol]) => <option key={ov} value={ov}>{ol}</option>)}
        </select>
      : <div className="muted small">(등록된 항목 없음)</div>;
    else if (f.t === "ro") input = <input type="text" value={String(pick(obj, f))} disabled readOnly className="mono" />;
    else if (f.t === "html") input = <div className="ro-box">{f.html || <span className="muted">-</span>}</div>;
    else if (f.t === "sec") return <div key={i} className="full form-sec">{f.l}</div>;
    else if (f.t === "check") return (
      <div key={i} className="full"><label className="check"><input type="checkbox" data-k={f.k} data-check="1" checked={val(f)} onChange={(e) => set(f.k, e.target.checked)} /> {f.l}</label></div>
    );
    else if (f.t === "period") {
      const [a, b] = f.k;
      return (
        <div key={i} className="full"><label>{f.l}</label><div className="date-pair">
          <input type="date" data-k={a} value={val(f, a)} max={val(f, b)} onChange={(e) => set(a, e.target.value)} />
          <span className="muted">~</span>
          <input type="date" data-k={b} value={val(f, b)} min={val(f, a)} onChange={(e) => set(b, e.target.value)} />
        </div></div>
      );
    }
    else input = (
      <>
        <input type={f.t} data-k={f.k} value={val(f)} placeholder={f.ph || ""} list={f.list ? `dl_${f.k}` : undefined} onChange={(e) => set(f.k, e.target.value)} />
        {f.list ? <datalist id={`dl_${f.k}`}>{f.list.map((o) => <option key={o} value={o} />)}</datalist> : null}
      </>
    );
    return (
      <div key={i} className={f.full ? "full" : ""}>
        <label>{f.l}{f.req ? <> <span className="req">*</span></> : null}</label>{input}{f.hint ? <div className="hint">{f.hint}</div> : null}
      </div>
    );
  };

  const save = () => {
    const v = {};
    fields.filter((f) => f.t === "multi").forEach((f) => (v[f.k] = []));
    for (const f of fields) {
      if (f.t === "multi") { if (f.opts.length) v[f.k] = [...val(f)]; }
      else if (f.t === "check") v[f.k] = val(f);
      else if (f.t === "period") { v[f.k[0]] = val(f, f.k[0]).trim(); v[f.k[1]] = val(f, f.k[1]).trim(); }
      else if (!NOVAL.includes(f.t)) v[f.k] = String(val(f)).trim();
    }
    const miss = fields.find((f) => f.req && !v[f.k]);
    if (miss) { E.toast(`${miss.l} 입력 필요`); return; }
    if (v.start && ((v.end && v.start > v.end) || (v.due && v.start > v.due))) { E.toast("시작일이 종료일보다 늦을 수 없어"); return; }
    const r = onSave(v);
    if (r !== false && r !== KEEP) E.closeModal();
  };

  const side = fields.filter((f) => f.side);
  return (
    <Modal title={title} wide={fields.length > 9 || side.length > 0}
      buttons={[...extraBtns, { l: "취소", close: true }, { l: "저장", cls: "primary", fn: save }]}>
      {side.length
        ? <>
            <div className="form-split" id="fForm" ref={formRef}>
              <div className="fs-main"><div className="form">{fields.filter((f) => !f.side).map(cell)}</div></div>
              <div className="fs-side">{side.map(cell)}</div>
            </div>
            {extra ? <div className="form-below">{extra}</div> : null}
          </>
        : <><div className="form" id="fForm" ref={formRef}>{fields.map(cell)}</div>{extra}</>}
    </Modal>
  );
}

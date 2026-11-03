import { useEffect, useRef } from "react";
import { useModal } from "../lib/modal.js";
import * as E from "../legacy/engine.js";

// 지금 열린 React 창
export function ModalHost() {
  const m = useModal();
  if (!m) return null;
  const { Component, props, id } = m;
  return <Component key={id} {...props} />;
}

// 창 틀: 오프라인판 openModal 과 같은 마크업·동작
//  - buttons: [{ l: "이름", cls: "primary" | "danger" | "left …", fn }]  ("left"가 붙은 버튼은 왼쪽, 나머지는 오른쪽)
//  - Esc · × · 바깥 클릭 · 취소: 입력값이 열 때와 다르면 물어보고 닫음
//  - Ctrl+Enter: primary 버튼
export function Modal({ title, wide = false, buttons = [], children, bodyRef }) {
  const body = useRef(null), snap = useRef(null);
  const ref = bodyRef || body;
  const values = () => [...(ref.current?.querySelectorAll("input, textarea, select") || [])].map((el) => (el.type === "checkbox" ? el.checked : el.value)).join("");
  const tryClose = () => {
    if (snap.current != null && values() !== snap.current && !confirm("작성 중인 내용이 있어. 저장하지 않고 닫을까?")) return;
    E.closeModal();   // 오프라인판 closeModal: React 창도 닫고, 이 창을 연 앞 창(예: WBS)이 있으면 다시 엶
  };
  // 열 때 한 번만 입력값을 기억 (닫을 때 이것과 다르면 물어봄)
  useEffect(() => {
    const t = setTimeout(() => (snap.current = values()), 60);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); tryClose(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const b = buttons.find((x) => /primary/.test(x.cls || ""));
        if (b) { e.preventDefault(); b.fn(); }
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  const isLeft = (b) => /\bleft\b/.test(b.cls || "");
  return (
    <div className="modal-bg open" onMouseDown={(e) => { if (e.target === e.currentTarget) tryClose(); }}>
      <div className={"modal" + (wide ? " wide" : "")}>
        <div className="modal-h">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={tryClose} title="닫기 (Esc)">
            <svg className="ico" viewBox="0 0 24 24"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>
        <div className="modal-b" ref={ref}>{children}</div>
        {buttons.length > 0 && (
          <div className="modal-f" style={{ display: "flex" }}>
            {buttons.map((b, i) => (
              <span key={i} style={{ display: "contents" }}>
                {!isLeft(b) && i > 0 && isLeft(buttons[i - 1]) && <span style={{ flex: 1 }} />}
                <button className={"btn " + (b.cls || "").replace(/\bleft\b/, "")} title={/primary/.test(b.cls || "") ? "Ctrl+Enter" : undefined}
                  onClick={b.close ? tryClose : b.fn}>{b.l}</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

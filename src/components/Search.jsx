import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store.js";
import * as E from "../legacy/engine.js";
import { TypeIcon } from "./ui.jsx";

// 통합 검색 (Ctrl+K): 오프라인판 gSearch·gKey·gOpen. 찾는 대상과 순서는 E.gSearchItems
export default function Search() {
  const { S } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const box = useRef(null), input = useRef(null);
  const list = q.trim() ? E.gSearchItems(q).slice(0, 40) : [];

  useEffect(() => {
    const onDown = (e) => { if (!e.target.closest(".gsearch")) setOpen(false); };
    addEventListener("mousedown", onDown);
    return () => removeEventListener("mousedown", onDown);
  }, []);
  useEffect(() => { box.current?.querySelector(".gi.on")?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const show = (v) => { setQ(v); setSel(0); setOpen(!!v.trim()); };
  const go = (r) => { if (!r) return; setOpen(false); input.current.blur(); r.open(); };
  const onKey = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); if (!list.length) return;
      setSel((s) => (s + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length);
    } else if (e.key === "Enter" && list[sel]) { e.preventDefault(); go(list[sel]); }
    else if (e.key === "Escape") { setOpen(false); e.target.blur(); }
  };
  const t = q.trim();
  const mark = (s) => {
    const i = s.toLowerCase().indexOf(t.toLowerCase());
    return i < 0 ? s : <>{s.slice(0, i)}<mark>{s.slice(i, i + t.length)}</mark>{s.slice(i + t.length)}</>;
  };

  let last = "";
  return (
    <div className="gsearch">
      <svg className="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input ref={input} id="gq" type="text" placeholder="검색 (Ctrl+K) — 업무·전달·산출물·데이터·화면·테스트·메모" autoComplete="off"
        value={q} onChange={(e) => show(e.target.value)} onKeyDown={onKey} onFocus={(e) => show(e.target.value)} />
      <div ref={box} id="gres" className={`gres ${open ? "open" : ""}`}>
        {open && (list.length ? list.map((r, i) => {
          const head = r.group !== last ? <div className="gh">{r.group}</div> : null;
          last = r.group;
          const p = E.proj(r.pid);
          return (
            <div key={i} style={{ display: "contents" }}>
              {head}
              <div className={`gi ${i === sel ? "on" : ""}`} onMouseDown={() => go(r)}>
                <TypeIcon kind={r.kind} /><span className="nm">{mark(r.title)}</span><span className="sub">{r.sub || ""}</span>
                <span className="sub"><span className="ptag"><i style={{ background: E.projColor(r.pid) }}></i>{p ? p.name : E.projName(r.pid)}</span></span>
              </div>
            </div>
          );
        }) : <div className="empty">"{q}" 결과 없음</div>)}
      </div>
    </div>
  );
}

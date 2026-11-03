import { useEffect, useRef } from "react";
import { useStore, update, replaceAll, toast } from "../lib/store.js";
import { parseImport, COLS } from "../lib/model.js";
import { stamp } from "../lib/date.js";

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type: type + ";charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Settings({ onClose }) {
  const { S } = useStore();
  const file = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const count = COLS.reduce((a, k) => a + S[k].length, 0);
  const set = (k, v) => update((s) => { s.settings[k] = v; }, { undo: false });

  async function onImport(e) {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const d = parseImport(await f.text());
      const n = COLS.reduce((a, k) => a + (d[k]?.length || 0), 0);
      if (!confirm(`'${f.name}' 데이터(프로젝트 ${d.projects.length}개 · 항목 ${n}건)로 바꿀까요?\n지금 데이터(항목 ${count}건)는 사라집니다.`)) return;
      replaceAll(d);
      toast("가져왔어요");
      onClose();
    } catch (err) { toast("가져오기 실패: " + err.message, { level: "danger" }); }
  }

  function onExport() {
    const { _ords, ...rest } = S;
    download(`${stamp()}_planner-desk.json`, JSON.stringify(rest), "application/json");
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-[rgba(9,30,66,.45)] pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[520px] max-w-[calc(100vw-32px)] rounded-lg bg-panel shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[17px] font-bold">설정</h2>
          <button className="btn ghost px-2" onClick={onClose} title="닫기 (Esc)">
            <svg className="ico" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="space-y-5 px-5 py-4 text-[14px]">
          <section>
            <h3 className="mb-2 font-bold">데이터</h3>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => file.current.click()}>가져오기 (HTML · JSON)</button>
              <button className="btn" onClick={onExport}>JSON 내보내기</button>
            </div>
            <input ref={file} type="file" accept=".html,.htm,.json" className="hidden" onChange={onImport} />
          </section>
          <section>
            <h3 className="mb-2 font-bold">화면</h3>
            <label className="flex items-center gap-3">
              <span className="w-20 text-dim">글자 크기</span>
              <select className="rounded border border-line2 bg-panel px-2 py-1.5" value={S.settings.fontScale} onChange={(e) => set("fontScale", e.target.value)}>
                {[["0.9", "작게"], ["1", "보통"], ["1.1", "크게"], ["1.2", "더 크게"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}

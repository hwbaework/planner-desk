import { useEffect, useState } from "react";
import { onToast } from "../lib/store.js";

export default function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => onToast((t) => {
    const id = Math.random();
    setList((l) => [...l, { ...t, id }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 2600);
  }), []);
  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {list.map((t) => (
        <div key={t.id} className={`rounded-md px-4 py-2.5 text-[14px] text-white shadow-lg ${t.level === "danger" ? "bg-danger" : "bg-[#172b4d]"}`}>{t.text}</div>
      ))}
    </div>
  );
}

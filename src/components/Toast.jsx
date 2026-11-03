import { useEffect, useRef, useState } from "react";
import { onToast } from "../lib/store.js";
import * as E from "../legacy/engine.js";

// 아래 가운데 알림 한 줄 (오프라인판 toast). 되돌리기 버튼이 있으면 6초, 없으면 2.6초
export default function Toast() {
  const [t, setT] = useState(null);
  const timer = useRef(null);
  useEffect(() => onToast((x) => {
    setT(x); clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), x.withUndo ? 6000 : 2600);
  }), []);
  return (
    <div id="toast" style={{ display: t ? "block" : "none" }}>
      {t?.text}
      {t?.withUndo && <> <button className="btn sm" style={{ marginLeft: 10 }} onClick={() => E.undo()}>되돌리기</button></>}
    </div>
  );
}

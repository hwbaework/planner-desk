import { useStore, setUI } from "../lib/store.js";
import { TABS, NAV_GROUPS, NAV_SHORT, NAV_SUB, activeProjects } from "../lib/model.js";

const LABEL = Object.fromEntries(TABS);

export default function Side() {
  const { S, ui } = useStore();
  const fold = !!ui.sideFold;
  const projItem = (id, name, color) => (
    <div key={id} title={name} onClick={() => setUI({ pid: id })}
      className={`flex cursor-pointer items-center gap-2 rounded px-2.5 py-[7px] text-[14px] ${fold ? "justify-center px-0" : ""} ${ui.pid === id ? "bg-accentw font-semibold text-accent" : "hover:bg-sub"}`}>
      <span className="size-2 flex-none rounded-full" style={{ background: color || "var(--line2)" }} />
      {!fold && <span className="min-w-0 flex-1 truncate">{name}</span>}
    </div>
  );
  const arch = S.projects.filter((p) => p.archived);
  return (
    <aside className={`sticky top-[53px] h-[calc(100vh-53px)] self-start overflow-y-auto border-r border-line bg-panel ${fold ? "px-1.5 py-3" : "px-2.5 py-3.5"}`}>
      <h3 className={`mb-1 flex items-center text-xs font-bold text-faint ${fold ? "justify-center" : "justify-between px-2.5"}`}>
        {!fold && <span>프로젝트</span>}
        <button className="rounded p-1 hover:bg-sub" title={fold ? "메뉴 펴기" : "메뉴 접기"} onClick={() => setUI({ sideFold: !fold })}>
          <svg className="ico size-4" viewBox="0 0 24 24"><path d={fold ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} /></svg>
        </button>
      </h3>
      {projItem("all", "전체 보기 (PMO)", "")}
      {activeProjects(S).map((p) => projItem(p.id, p.name, p.color))}
      {!fold && arch.length > 0 && (
        <div className="mt-3">
          <h3 className="px-2.5 text-xs font-bold text-faint">보관됨</h3>
          {arch.map((p) => <div key={p.id} className="truncate px-2.5 py-1.5 text-[13.5px] text-faint">{p.name}</div>)}
        </div>
      )}
      <div className="mt-3 border-t border-line pt-2">
        {NAV_GROUPS.map((keys, gi) => (
          <div key={gi} className={gi ? "mt-1.5 border-t border-line pt-1.5" : ""}>
            {keys.map((k) => (
              <div key={k} onClick={() => setUI({ tab: k })} title={LABEL[k]}
                className={`flex cursor-pointer items-center rounded py-[7px] text-[14px] ${fold ? "justify-center text-xs" : NAV_SUB.includes(k) ? "pl-6 pr-2.5" : "px-2.5"} ${ui.tab === k ? "bg-accentw font-semibold text-accent" : "text-dim hover:bg-sub hover:text-text"}`}>
                {fold ? NAV_SHORT[k] : LABEL[k]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

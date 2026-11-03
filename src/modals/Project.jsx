import { useRef, useState } from "react";
import * as E from "../legacy/engine.js";
import { useStore } from "../lib/store.js";
import { closeModal } from "../lib/modal.js";
import { Modal } from "../components/Modal.jsx";
import { useForm, FormBody, isWide, formButtons } from "./kit/form.jsx";

// 프로젝트 추가·정보 (오프라인판 editProject + 차년도 줄 pyRow/pyAdd/pyAuto/pyRenum, 시스템 접속 줄 lnRow)
export const opens = ["editProject"];
export const samples = (S) => [
  ["editProject", S.projects[0]?.id],
  ["editProject", S.projects.find((p) => (p.years || []).length || (p.links || []).length)?.id],
  ["editProject", S.projects.find((p) => p.archived)?.id],
  ["editProject"],
];

const COLOR_NAMES = ["파랑", "빨강", "초록", "주황", "보라", "청록", "자주", "회색"];
const Del = ({ onClick }) => <button className="ico-btn del" onClick={onClick} title="삭제" dangerouslySetInnerHTML={{ __html: E.ICO_DEL }} />;

export default function ProjectModal({ args: [id] }) {
  const { S } = useStore();
  const p = id ? E.proj(id) : { archived: false };
  const seq = useRef(0);
  const row = (o) => ({ key: ++seq.current, ...o });
  // 차년도 기간 줄
  const [years, setYears] = useState(() => (p.years || []).map((y) => row({ start: y.start || "", end: y.end || "" })));
  // 시스템 접속 줄
  const [links, setLinks] = useState(() => (p.links || []).map((l) => row({ name: l.name || "", url: l.url || "", user: l.user || "", pass: l.pass || "", memo: l.memo || "" })));
  const setYear = (key, k, x) => setYears((ys) => ys.map((y) => (y.key === key ? { ...y, [k]: x } : y)));
  const setLink = (key, k, x) => setLinks((ls) => ls.map((l) => (l.key === key ? { ...l, [k]: x } : l)));

  const pyAdd = () => {
    const last = years.map((y) => y.end).filter(Boolean).pop();
    const st = last ? E.addDays(last, 1) : form.vals.start || "";
    const en = st ? E.fmtD(new Date(E.parseD(st).getFullYear(), 11, 31)) : "";
    setYears((ys) => [...ys, row({ start: st, end: en })]);
  };
  // 사업 시작~종료를 달력 연도로 나눔 (1차: 시작일~12/31, 마지막: 1/1~종료일)
  const pyAuto = () => {
    const st = form.vals.start, en = form.vals.end;
    if (!st || !en || st > en) { E.toast("시작일·종료일을 먼저 넣어줘"); return; }
    const out = [];
    for (let y = E.parseD(st).getFullYear(); y <= E.parseD(en).getFullYear(); y++) {
      const a = `${y}-01-01` < st ? st : `${y}-01-01`, b = `${y}-12-31` > en ? en : `${y}-12-31`;
      out.push(row({ start: a, end: b }));
    }
    setYears(out);
  };

  const fields = [
    { k: "name", l: "프로젝트명", t: "text", full: true, req: true },
    { k: "client", l: "주관사", t: "text" },
    { k: "pm", l: "PM", t: "text" },
    { k: "devLead", l: "개발업체", t: "text" },
    { k: "idPrefix", l: "ID 키", t: "text", ph: "KAN" },
    { k: ["start", "end"], l: "기간", t: "period" },
    { k: "color", l: "색상", t: "select", opts: E.PROJ_COLORS.map((c, i) => [c, COLOR_NAMES[i]]), v: E.PROJ_COLORS[S.projects.length % E.PROJ_COLORS.length] },
    ...(id ? [{ k: "archived", l: "보관 (종료된 프로젝트)", t: "check" }] : []),
    { k: "_py", l: "차년도 기간", t: "raw", full: true,
      html: (
        <div id="pyList">
          {years.map((y, i) => (
            <div className="py-row" key={y.key}>
              <span className="py-n">{`${i + 1}차년도`}</span>
              <input type="date" className="py-s" value={y.start} onChange={(e) => setYear(y.key, "start", e.target.value)} />
              <span className="muted">~</span>
              <input type="date" className="py-e" value={y.end} onChange={(e) => setYear(y.key, "end", e.target.value)} />
              <Del onClick={() => setYears((ys) => ys.filter((z) => z.key !== y.key))} />
            </div>
          ))}
        </div>
      ),
      btn: <span className="raw-btns"><button className="btn sm ghost" onClick={pyAdd}>＋ 추가</button><button className="btn sm ghost" onClick={pyAuto}>기간으로 채우기</button></span> },
    { k: "memo", l: "메모", t: "textarea", side: true },
    { k: "_ln", l: "시스템 접속", t: "raw", side: true,
      html: (
        <div id="lnList">
          {links.map((l) => (
            <div className="ln-row" key={l.key}>
              <input type="text" className="ln-n" placeholder="이름" value={l.name} onChange={(e) => setLink(l.key, "name", e.target.value)} />
              <input type="text" className="ln-u" placeholder="주소" value={l.url} onChange={(e) => setLink(l.key, "url", e.target.value)} />
              <Del onClick={() => setLinks((ls) => ls.filter((z) => z.key !== l.key))} />
              <input type="text" className="ln-id" placeholder="아이디" value={l.user} onChange={(e) => setLink(l.key, "user", e.target.value)} />
              <input type="text" className="ln-pw" placeholder="비밀번호" value={l.pass} onChange={(e) => setLink(l.key, "pass", e.target.value)} />
              <input className="ln-m" type="hidden" value={l.memo} readOnly />
            </div>
          ))}
        </div>
      ),
      btn: <span className="raw-btns"><button className="btn sm ghost" onClick={() => setLinks((ls) => [...ls, row({ name: "", url: "", user: "", pass: "", memo: "" })])}>＋ 추가</button></span> },
  ];

  const form = useForm(fields, p, (v) => {
    const ys = years.map((y) => ({ start: y.start, end: y.end })).filter((y) => y.start && y.end);
    if (ys.some((y) => y.start > y.end)) { E.toast("차년도 시작일이 종료일보다 늦어"); return false; }
    v.years = ys.sort((a, b) => a.start.localeCompare(b.start));
    v.links = links.map((l) => ({ name: l.name.trim(), url: l.url.trim(), user: l.user.trim(), pass: l.pass, memo: l.memo.trim() })).filter((l) => l.url || l.user || l.name);
    const keyChanged = id && (p.idPrefix || "") !== (v.idPrefix || "");
    if (id) Object.assign(p, v);
    if (keyChanged) { E.wbsAutoIds(id); const nk = E.wbsIdPrefix(id); [...S.tasks, ...S.handoffs].filter((x) => x.projectId === id && /-T\d+$/.test(x.code || "")).forEach((x) => (x.code = x.code.replace(/^.*-T(\d+)$/, `${nk}-T$1`))); }
    else if (!id) {
      const np = Object.assign({ id: E.uid("p"), color: E.PROJ_COLORS[S.projects.length % E.PROJ_COLORS.length] }, v);
      S.projects.push(np); S.ui.pid = np.id;
    }
    E.commit();
  });

  const extraBtns = id ? [{ l: "삭제", cls: "danger left", fn: () => {
    if (!confirm(`「${p.name}」와 관련 데이터(업무·일정·산출물·전달·화면·WBS·메모)를 모두 삭제할까? 되돌릴 수 없어. (보관 처리를 추천)`)) return;
    ["tasks", "events", "recurring", "datas", "tcs", "reqs", "risks", "docs", "handoffs", "screens", "wbs", "funcs", "notes"].forEach((k) => (S[k] = S[k].filter((x) => x.projectId !== id)));
    S.projects = S.projects.filter((x) => x.id !== id); E.commit(); closeModal();
  } }] : [];

  return (
    <Modal title={id ? "프로젝트 정보" : "프로젝트 추가"} wide={isWide(fields)} buttons={formButtons(extraBtns, form.save)}>
      <FormBody form={form} fields={fields} />
    </Modal>
  );
}

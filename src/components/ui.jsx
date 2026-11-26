import * as E from "../legacy/engine.js";

// 오프라인판 도우미가 만든 작은 HTML 조각(아이콘 SVG 등)을 그대로 넣을 때만. 화면 구조는 JSX로 쓴다
export function Raw({ html, tag: Tag = "span", ...rest }) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: html || "" }} />;
}
// 글자 대신 아이콘만 있는 작은 버튼 (복사·보기·편집·폴더·링크·삭제). 무엇인지는 마우스를 올리면 뜸
const ICONS = {
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  del: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};
export function IconBtn({ icon, title, className = "", ...rest }) {
  return (
    <button type="button" className={`ico-btn ${icon === "del" ? "del " : ""}${className}`} title={title} aria-label={title} {...rest}
      dangerouslySetInnerHTML={{ __html: `<svg class="ico" viewBox="0 0 24 24">${ICONS[icon]}</svg>` }} />
  );
}
export const Badge = ({ cls, children, ...rest }) => <span className={`badge b-${cls}`} {...rest}>{children}</span>;
export const TypeIcon = ({ kind }) => <Raw html={E.typeIcon(kind)} style={{ display: "contents" }} />;
export const PriIcon = ({ p }) => <Raw html={E.priIcon(p)} style={{ display: "contents" }} />;

// 오프라인판 epicTag 와 같은 색
export function EpicTag({ name }) {
  if (!name) return null;
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [fg, bg] = E.EPIC_COLORS[h % E.EPIC_COLORS.length];
  return <span className="epic-lz" style={{ color: fg, background: bg, borderColor: fg + "33" }}>{name}</span>;
}

// 오프라인판 pageHead
export function PageHead({ title, meta, actions }) {
  return (
    <div className="page-head">
      <div><h2>{title}</h2>{meta ? <div className="meta">{meta}</div> : null}</div>
      <div className="actions">{actions}</div>
    </div>
  );
}

// 오프라인판의 onchange 와 같은 때(칸을 벗어나거나 Enter)에만 저장하는 입력칸.
// React의 onChange는 글자마다 불리므로, 오프라인판에서 onchange로 저장하던 글·날짜·숫자 칸은 이것을 쓴다.
// value가 바깥에서 바뀌면 다시 그린다(key). select·checkbox는 React onChange를 그대로 써도 된다.
export function ChangeInput({ value, onCommit, as: Tag = "input", ...rest }) {
  const v = value ?? "";
  // 날짜 칸은 오프라인판처럼 달력에서 고르는 순간 저장 (브라우저 change 와 같음)
  const isDate = rest.type === "date";
  return (
    <Tag key={String(v)} defaultValue={v} {...rest}
      onChange={isDate ? (e) => { rest.onChange?.(e); if (e.target.value !== String(v)) onCommit(e.target.value, e); } : rest.onChange}
      onBlur={(e) => { rest.onBlur?.(e); if (!isDate && e.target.value !== String(v)) onCommit(e.target.value, e); }}
      onKeyDown={(e) => { rest.onKeyDown?.(e); if (Tag === "input" && e.key === "Enter") e.currentTarget.blur(); }} />
  );
}

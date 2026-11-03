import * as E from "../legacy/engine.js";

// 오프라인판 도우미가 만든 작은 HTML 조각(아이콘 SVG 등)을 그대로 넣을 때만. 화면 구조는 JSX로 쓴다
export function Raw({ html, tag: Tag = "span", ...rest }) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: html || "" }} />;
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

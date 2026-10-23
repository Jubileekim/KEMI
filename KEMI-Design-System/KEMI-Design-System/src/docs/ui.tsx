import type { ReactNode } from "react";

export function Section({ id, title, lead, children }: { id: string; title: ReactNode; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="doc-section" id={id}>
      <h2>{title}</h2>
      {lead && <p className="doc-lead">{lead}</p>}
      {children}
    </section>
  );
}

export function Sub({ children, small }: { children: ReactNode; small?: ReactNode }) {
  return <h3 className="doc-sub">{children}{small && <small>{small}</small>}</h3>;
}

export function Demo({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return dark
    ? <div className="doc-demo doc-demo--dark" data-theme="dark">{children}</div>
    : <div className="doc-demo">{children}</div>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="doc-note">{children}</p>;
}

const TAG = { obs: "관찰", pro: "제안", asm: "가정" } as const;
/** 근거 종류 표시 */
export function Tag({ kind }: { kind: keyof typeof TAG }) {
  return <span className={`tag tag--${kind}`}>{TAG[kind]}</span>;
}

export function Table({ head, rows, id }: { head: ReactNode[]; rows: ReactNode[][]; id?: string }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table" id={id}>
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function Sw({ color }: { color: string }) {
  return <span className="sw" style={{ background: color }} />;
}

export function Caption({ children }: { children: ReactNode }) {
  return <div className="doc-caption">{children}</div>;
}

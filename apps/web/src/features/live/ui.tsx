import type { ReactNode } from "react";
import { errorText } from "./errors";
import Label from "../../components/ui/label";

// 실제 API 화면에서 함께 쓰는 작은 조각. 디자인 시스템 컴포넌트와 기존 클래스만 쓴다.

export function Card({
  title,
  children,
  label: aria,
}: {
  title?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <section className="showcase-card grid gap-4" aria-label={aria ?? title}>
      {title && <h2 className="type-heading-md">{title}</h2>}
      {children}
    </section>
  );
}

export function Loading({ text = "불러오고 있어요." }: { text?: string }) {
  return <p role="status">{text}</p>;
}

export function Failure({ error }: { error: unknown }) {
  return <p role="alert">{errorText(error)}</p>;
}

export function Field({
  id,
  label: text,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{text}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term} className="grid gap-1">
          <dt className="text-sm text-muted-foreground">{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

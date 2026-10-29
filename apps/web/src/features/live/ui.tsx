import type { ReactNode } from "react";
import { Link } from "react-router";
import { errorText } from "./errors";
import Label from "../../components/ui/label";
import Button from "../../components/ui/button";
import { ApiError } from "../../shared/api/client";

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
  if (error instanceof ApiError && [403, 404].includes(error.status))
    return (
      <section role="alert" className="showcase-card grid gap-4">
        <h1 className="type-heading-lg">
          {error.status === 403
            ? "접근 권한이 없어요"
            : "접근 권한이 없거나 존재하지 않는 페이지예요"}
        </h1>
        <p>
          현재 계정으로 이 정보를 볼 수 없어요. 계정과 주소를 확인해 주세요.
        </p>
        <div>
          <Button asChild variant="outline">
            <Link to="/">홈으로</Link>
          </Button>
        </div>
      </section>
    );
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

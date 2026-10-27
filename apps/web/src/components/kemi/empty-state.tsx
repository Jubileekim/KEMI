import type { ReactNode } from "react";
import { SearchIcon } from "lucide-react";

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-3 py-8 text-center">
      <SearchIcon aria-hidden="true" className="size-6 text-muted-foreground" />
      <h3 className="type-title">{title}</h3>
      <p className="type-body-sm max-w-prose text-muted-foreground">
        {description}
      </p>
      {action}
    </div>
  );
}

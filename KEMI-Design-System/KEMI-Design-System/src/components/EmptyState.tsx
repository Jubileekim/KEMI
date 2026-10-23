import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName;
  /** 막다른 화면을 만들지 않는다. 예) 검색 결과 없음 → "이 조건으로 제작 의뢰하기" */
  actions?: ReactNode;
}

export function EmptyState({ title, description, icon = "search", actions }: EmptyStateProps) {
  return (
    <div className="empty">
      <span className="empty__icon"><Icon name={icon} size={24} /></span>
      <h3 className="empty__title">{title}</h3>
      {description && <p className="empty__desc">{description}</p>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}

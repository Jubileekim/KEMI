import { useId, type ReactNode } from "react";
import { Icon } from "./Icon";

export interface InfoTipProps {
  /** 버튼의 접근성 이름. 예) "독점 가능 기준" */
  label: string;
  children: ReactNode;
}

/** ⓘ 설명. 배지·필터 항목의 판단 기준을 공개할 때 쓴다(원칙: 신뢰 표시는 기준과 함께). */
export function InfoTip({ label, children }: InfoTipProps) {
  const id = useId();
  return (
    <span className="infotip">
      <button type="button" className="infotip__btn" aria-label={label} aria-describedby={id}>
        <Icon name="info" size={16} />
      </button>
      <span role="tooltip" id={id} className="infotip__bubble">{children}</span>
    </span>
  );
}

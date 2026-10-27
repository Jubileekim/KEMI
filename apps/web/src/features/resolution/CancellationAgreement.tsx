import { useState } from "react";
import type { z } from "zod";
import type { cancellationVersionSchema } from "../../mocks/resolution-model";
import Button from "../../components/ui/button";

export default function CancellationAgreement({
  version,
  userId,
  disabled,
  onConfirm,
}: {
  version: z.infer<typeof cancellationVersionSchema>;
  userId: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [consent, setConsent] = useState(false);
  return (
    <section
      className="grid min-w-0 gap-3 rounded-xl border p-4"
      aria-label="취소 합의 버전"
    >
      <h2 className="type-heading-sm">동일 버전 양측 확인</h2>
      <p>
        버전 {version.id} · {version.at}
      </p>
      <dl className="grid min-w-0 gap-2 whitespace-pre-wrap">
        <dt>취소 사유·진행 내역</dt>
        <dd>
          {version.values.reason} / {version.values.progress}
        </dd>
        <dt>완료 대가</dt>
        <dd>{version.values.compensation.toLocaleString("ko-KR")}원</dd>
        <dt>합의 환불액</dt>
        <dd>{version.refund.toLocaleString("ko-KR")}원</dd>
        <dt>파일 인도</dt>
        <dd>{version.values.files}</dd>
        <dt>미완성 작업</dt>
        <dd>{version.values.unfinished}</dd>
        <dt>원본·프로젝트</dt>
        <dd>{version.values.originals}</dd>
        <dt>사용권</dt>
        <dd>{version.values.rights}</dd>
      </dl>
      <p role="status">
        양측 확인 {version.confirmations.length}/2 ·{" "}
        {version.confirmations.length === 2
          ? "취소 합의 확인 · 환불·정산 미실행"
          : "취소 협의 중 · 정산 보류"}
      </p>
      {!version.confirmations.includes(userId) && (
        <>
          <label htmlFor="cancel-consent" className="flex items-start gap-2">
            <input
              id="cancel-consent"
              type="checkbox"
              checked={consent}
              disabled={disabled}
              onChange={(e) => setConsent(e.target.checked)}
            />
            표시된 동일 버전의 금액·파일·원본·사용권에 동의해요
          </label>
          <Button disabled={disabled || !consent} onClick={onConfirm}>
            이 취소 버전 확인 (Mock)
          </Button>
        </>
      )}
    </section>
  );
}

import type { z } from "zod";
import type { resolutionViewSchema } from "../../mocks/resolution-model";
import Button from "../../components/ui/button";

const labels = {
  PROCESSING: "테스트 환불 처리 중",
  UNKNOWN: "테스트 환불 결과 확인 중",
  FAILED: "테스트 환불 실패",
  SUCCEEDED: "테스트 환불 성공",
};
export default function RefundStatusPanel({
  view,
  disabled,
  onRefund,
  onSettle,
}: {
  view: z.infer<typeof resolutionViewSchema>;
  disabled: boolean;
  onRefund: () => void;
  onSettle: () => void;
}) {
  const { workflow } = view.state;
  const version = view.state.versions.at(-1);
  const refund = workflow.refunds.at(-1);
  const { settlement } = workflow;
  const agreed = version?.confirmations.length === 2;
  const open = workflow.disputes.some((d) => !d.released);
  let completion = "취소 완료 아님 · 정산 보류";
  if (settlement?.status === "SUCCEEDED")
    completion =
      version?.values.compensation === 0
        ? "전액 취소 완료 (Mock)"
        : "부분 취소 완료 (Mock)";
  return (
    <section
      className="grid gap-3 rounded-xl border p-4"
      aria-label="테스트 환불·잔여 정산"
    >
      <h2 className="type-heading-sm">테스트 환불·잔여 대가</h2>
      <p>원결제 {view.orderId ?? "미확인"} · 실제 Toss Sandbox 미연결</p>
      <p role="status">
        {refund ? labels[refund.status] : "환불 미실행"} · {completion}
      </p>
      {refund && (
        <p>
          환불 요청 {refund.id} · 합의 버전 {refund.versionId} ·{" "}
          {refund.amount.toLocaleString("ko-KR")}원
        </p>
      )}
      {agreed && !open && view.orderId && refund?.status !== "SUCCEEDED" && (
        <Button disabled={disabled} onClick={onRefund}>
          {refund && ["UNKNOWN", "PROCESSING"].includes(refund.status)
            ? "기존 테스트 환불 결과 확인"
            : "합의 금액 테스트 환불 확인 (Mock)"}
        </Button>
      )}
      <p>
        환불 성공만으로 취소 완료·잔여 정산하지 않아요. 합의 파일 인도·수령,
        운영 검토의 근거 있는 보류 해제를 확인해요. D12 세금·절사는
        미결정이에요.
      </p>
      {workflow.release && (
        <p>
          보류 해제 근거: {workflow.release.reason} · {workflow.release.actorId}{" "}
          · {workflow.release.at}
        </p>
      )}
      {settlement && (
        <dl className="grid gap-2" aria-label="잔여 모의 정산 내역">
          <dt>완료 대가</dt>
          <dd>{settlement.compensation.toLocaleString("ko-KR")}원</dd>
          <dt>수수료 10%</dt>
          <dd>{settlement.fee.toLocaleString("ko-KR")}원</dd>
          <dt>잔여 모의 정산</dt>
          <dd>{settlement.net.toLocaleString("ko-KR")}원</dd>
          <dt>결과</dt>
          <dd>
            {settlement.status === "SUCCEEDED"
              ? "모의 정산 확정"
              : `잔여 정산 ${settlement.status} · 완료 아님`}
          </dd>
        </dl>
      )}
      {workflow.release && !open && settlement?.status !== "SUCCEEDED" && (
        <Button disabled={disabled} onClick={onSettle}>
          취소 완료·잔여 모의 정산 확인
        </Button>
      )}
    </section>
  );
}

import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";

const PaymentMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/PaymentMock"))
  : null;
export default function PaymentPage({
  contractId,
  orderId,
  result = false,
}: {
  contractId?: string;
  orderId?: string;
  result?: boolean;
}) {
  const params = useParams();
  const id = contractId ?? params.contractId ?? "";
  if (mockEnabled && PaymentMock)
    return (
      <Suspense fallback={<p role="status">결제 화면 준비 중…</p>}>
        <PaymentMock
          key={`${id}/${orderId ?? ""}/${result}`}
          contractId={id}
          orderId={orderId}
          result={result}
        />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">테스트 결제 연결 준비 중</h1>
      <p>
        결제·주문·결과 조회 API와 Toss Sandbox 서버 검증 계약 조율 후 연결해요.
        실제 결제 결과는 아직 확인할 수 없어요.
      </p>
    </section>
  );
}

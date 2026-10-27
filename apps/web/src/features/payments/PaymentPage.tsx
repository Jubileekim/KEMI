import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";

const PaymentLive = lazy(() => import("./PaymentLive"));

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
    <Suspense fallback={<p role="status">결제 화면 준비 중…</p>}>
      <PaymentLive contractId={id} result={result} />
    </Suspense>
  );
}

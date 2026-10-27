import { useSearchParams } from "react-router";
import PaymentPage from "./PaymentPage";

export default function PaymentResultPage() {
  const [params] = useSearchParams();
  // Amount, paymentKey, success/fail are untrusted return hints, never approval evidence.
  return (
    <PaymentPage
      result
      contractId={params.get("contractId") ?? ""}
      orderId={params.get("orderId") ?? ""}
    />
  );
}

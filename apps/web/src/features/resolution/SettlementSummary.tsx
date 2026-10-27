import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";
import SettlementLive from "./SettlementLive";

const SettlementMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/SettlementMock"))
  : null;
export default function SettlementSummary() {
  const { contractId = "" } = useParams();
  if (mockEnabled && SettlementMock)
    return (
      <Suspense fallback={<p role="status">정산 화면 로딩 중…</p>}>
        <SettlementMock key={contractId} contractId={contractId} />
      </Suspense>
    );
  return <SettlementLive key={contractId} contractId={contractId} />;
}

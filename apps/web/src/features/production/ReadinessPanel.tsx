import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";
import ProductionLive from "./ProductionLive";

const ProductionMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/ProductionMock"))
  : null;
export default function ReadinessPanel() {
  const { contractId = "" } = useParams();
  if (mockEnabled && ProductionMock)
    return (
      <Suspense fallback={<p role="status">준비 화면 로딩 중…</p>}>
        <ProductionMock key={contractId} contractId={contractId} />
      </Suspense>
    );
  return <ProductionLive key={contractId} contractId={contractId} />;
}

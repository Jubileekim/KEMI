import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";
import DeliveryLive from "./DeliveryLive";

const DeliveryMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/DeliveryMock"))
  : null;
export default function DeliveryVersions() {
  const { contractId = "" } = useParams();
  if (mockEnabled && DeliveryMock)
    return (
      <Suspense fallback={<p role="status">영상 버전 로딩 중…</p>}>
        <DeliveryMock key={contractId} contractId={contractId} />
      </Suspense>
    );
  return <DeliveryLive key={contractId} contractId={contractId} />;
}

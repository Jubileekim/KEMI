import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled, useSession } from "../../app/session";
import CancellationLive from "./CancellationLive";

const CancellationMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/CancellationMock"))
  : null;
export default function CancellationPage() {
  const { contractId = "" } = useParams();
  const { user } = useSession();
  if (mockEnabled && CancellationMock)
    return (
      <Suspense fallback={<p role="status">취소 화면 로딩 중…</p>}>
        <CancellationMock
          key={`${contractId}:${user?.id}`}
          contractId={contractId}
        />
      </Suspense>
    );
  return <CancellationLive key={contractId} contractId={contractId} />;
}

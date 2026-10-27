import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";
import { DisputeLive } from "../operations/OpsLive";

const DisputeMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/DisputeMock"))
  : null;
export default function DisputePage() {
  const { disputeId = "" } = useParams();
  if (mockEnabled && DisputeMock)
    return (
      <Suspense fallback={<p role="status">분쟁 화면 로딩 중…</p>}>
        <DisputeMock key={disputeId} disputeId={disputeId} />
      </Suspense>
    );
  return <DisputeLive />;
}

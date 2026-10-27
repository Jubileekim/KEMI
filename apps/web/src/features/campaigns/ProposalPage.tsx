import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";
import RequestsLive from "../requests/RequestsLive";

const ProposalMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/ProposalMock"))
  : null;
export default function ProposalPage() {
  if (mockEnabled && ProposalMock)
    return (
      <Suspense fallback={<p role="status">의뢰 화면 준비 중…</p>}>
        <ProposalMock />
      </Suspense>
    );
  return <RequestsLive />;
}

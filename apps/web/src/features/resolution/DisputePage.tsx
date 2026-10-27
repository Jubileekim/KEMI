import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";

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
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">분쟁 현황 연결 준비 중</h1>
      <p>실제 분쟁 API와 증빙·보류 해제 정책 조율 후 연결해요.</p>
    </section>
  );
}

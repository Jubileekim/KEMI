import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled, useSession } from "../../app/session";

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
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">취소·환불 연결 준비 중</h1>
      <p>실제 취소 합의·환불·분쟁 API와 정책 조율 후 연결해요.</p>
    </section>
  );
}

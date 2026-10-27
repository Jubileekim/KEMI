import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";

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
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">영상 제출 연결 준비 중</h1>
      <p>
        제출·버전·비공개 영상 API 계약을 확인한 후 연결해요. 실제 제출 내역은
        아직 확인할 수 없어요.
      </p>
    </section>
  );
}

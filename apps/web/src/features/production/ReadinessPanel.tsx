import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";

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
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">제작 준비 연결 준비 중</h1>
      <p>
        준비·제작 시작·납기 API 및 D09/D10 정책 조율 후 연결해요. 실제 준비·납기
        결과는 아직 확인할 수 없어요.
      </p>
    </section>
  );
}

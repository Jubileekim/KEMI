import { lazy, Suspense } from "react";
import { useParams } from "react-router";
import { mockEnabled } from "../auth/config";

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
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">정산 연결 준비 중</h1>
      <p>
        정산·취소·분쟁 보류 API와 금액 정책 조율 후 연결해요. 실제 정산·지급
        결과는 아직 확인할 수 없어요.
      </p>
    </section>
  );
}

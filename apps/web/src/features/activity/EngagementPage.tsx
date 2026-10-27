import { lazy, Suspense } from "react";
import { useLocation } from "react-router";
import { mockEnabled } from "../auth/config";

const EngagementMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/EngagementMock"))
  : null;
export default function EngagementPage() {
  const { pathname } = useLocation();
  if (mockEnabled && EngagementMock)
    return (
      <Suspense fallback={<p role="status">알림·리뷰 준비 중…</p>}>
        <EngagementMock key={pathname} />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">알림·리뷰 연결 준비 중</h1>
      <p>거래 사건·이동 대상과 리뷰 API 계약을 조율하고 있어요.</p>
    </section>
  );
}

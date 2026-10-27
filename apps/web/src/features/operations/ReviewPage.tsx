import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";

const ReviewMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/ReviewMock"))
  : null;
export default function ReviewPage() {
  if (mockEnabled && ReviewMock)
    return (
      <Suspense fallback={<p role="status">검토 화면 로딩 중…</p>}>
        <ReviewMock />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">분쟁 운영 검토 연결 준비 중</h1>
      <p>실제 운영 API와 D13/D18 권한·해제 정책 조율이 필요해요.</p>
    </section>
  );
}

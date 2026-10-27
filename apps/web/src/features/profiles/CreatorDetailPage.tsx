import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";

const CreatorMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/CreatorMock"))
  : null;
export default function CreatorDetailPage() {
  if (mockEnabled && CreatorMock)
    return (
      <Suspense fallback={<p role="status">제작자 준비 중…</p>}>
        <CreatorMock />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">제작자·공개 패키지</h1>
      <p>공개 프로필·패키지 API 계약 조율 후 연결해요.</p>
    </section>
  );
}

import { lazy, Suspense } from "react";
import { useLocation } from "react-router";
import { mockEnabled } from "../auth/config";

const DirectMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/DirectMock"))
  : null;
export default function DirectRequestForm() {
  const location = useLocation();
  if (mockEnabled && DirectMock)
    return (
      <Suspense fallback={<p role="status">의뢰 준비 중…</p>}>
        <DirectMock key={location.pathname + location.search} />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">직접 의뢰</h1>
      <p>직접 의뢰 API 계약 조율 후 연결해요. 실제 의뢰는 발송되지 않아요.</p>
    </section>
  );
}

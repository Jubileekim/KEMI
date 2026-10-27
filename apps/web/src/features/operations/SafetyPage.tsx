import { lazy, Suspense } from "react";
import { useLocation } from "react-router";
import { mockEnabled } from "../auth/config";

const SafetyMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/SafetyMock"))
  : null;
export default function SafetyPage() {
  const { pathname, search } = useLocation();
  if (mockEnabled && SafetyMock)
    return (
      <Suspense fallback={<p role="status">신고 안내 준비 중…</p>}>
        <SafetyMock key={pathname + search} />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">신고·이용 제한 안내 연결 준비 중</h1>
      <p>신고·운영 권한·이의 API 계약 D18 조율이 필요해요.</p>
    </section>
  );
}

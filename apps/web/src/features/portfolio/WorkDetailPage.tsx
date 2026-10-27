import { lazy, Suspense } from "react";
import { Link, useLocation } from "react-router";
import { mockEnabled } from "../auth/config";

const CatalogMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/CatalogMock"))
  : null;

export default function WorkDetailPage() {
  const location = useLocation();
  if (mockEnabled && CatalogMock)
    return (
      <Suspense fallback={<p role="status">작품 준비 중…</p>}>
        <CatalogMock key={location.pathname + location.search} />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">작품 상세</h1>
      <p>공개 작품 조회·재생 API 연결 준비 중이에요.</p>
      <Link to="/">작품 피드로 돌아가기</Link>
    </section>
  );
}

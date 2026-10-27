import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";
import ScreenLinks from "../../app/ScreenLinks";

const CatalogMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/CatalogMock"))
  : null;
export default function FeedPage() {
  if (mockEnabled && CatalogMock)
    return (
      <Suspense fallback={<p role="status">작품 준비 중…</p>}>
        <CatalogMock />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-6">
      <h1 className="type-heading-lg">작품 피드</h1>
      <p>공개 작품 API 연결 준비 중이에요.</p>
      <ScreenLinks />
    </section>
  );
}

import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";
import CatalogLive from "./CatalogLive";

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
  return <CatalogLive />;
}

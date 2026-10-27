import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";
import { CreatorDetailLive } from "../portfolio/CatalogLive";

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
  return <CreatorDetailLive />;
}

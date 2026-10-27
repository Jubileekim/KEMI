import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";

const DiscoveryMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/DiscoveryMock"))
  : null;
export default function CampaignBrowsePage() {
  if (mockEnabled && DiscoveryMock)
    return (
      <Suspense fallback={<p role="status">모집 화면 준비 중…</p>}>
        <DiscoveryMock />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">공개 모집 연결 준비 중</h1>
      <p>
        검색·제품 분야·상태와 자동 마감 계약을 조율하고 있어요. 실제
        목록·상세·마감은 아직 연결되지 않았어요.
      </p>
    </section>
  );
}

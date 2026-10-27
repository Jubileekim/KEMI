import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";

const CampaignMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/CampaignMock"))
  : null;
export default function CampaignEditor() {
  if (mockEnabled && CampaignMock)
    return (
      <Suspense fallback={<p role="status">작성 화면 준비 중…</p>}>
        <CampaignMock />
      </Suspense>
    );
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">캠페인 작성·공개 준비 중</h1>
      <p>
        임시 저장·초안 재편집·공개 시각 기준 모집 기간 API 계약을 조율하고
        있어요. 실제 저장·공개는 아직 연결되지 않았어요.
      </p>
    </section>
  );
}

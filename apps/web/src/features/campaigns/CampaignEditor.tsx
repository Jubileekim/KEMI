import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";
import CampaignEditorLive from "./CampaignEditorLive";

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
  return <CampaignEditorLive />;
}

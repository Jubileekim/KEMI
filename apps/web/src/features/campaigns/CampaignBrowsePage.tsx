import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";
import CampaignBrowseLive from "./CampaignBrowseLive";

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
  return <CampaignBrowseLive />;
}

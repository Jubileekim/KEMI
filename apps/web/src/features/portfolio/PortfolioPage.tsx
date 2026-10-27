import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";
import StudioLive from "../packages/StudioLive";

const Studio = import.meta.env.DEV
  ? lazy(() => import("../../mocks/StudioMock"))
  : null;
export default function PortfolioPage() {
  if (mockEnabled && Studio)
    return (
      <Suspense fallback={<p role="status">관리 화면 준비 중…</p>}>
        <Studio portfolio />
      </Suspense>
    );
  return <StudioLive />;
}

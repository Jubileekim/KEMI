import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";
import OpsLive from "./OpsLive";

const ReviewMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/ReviewMock"))
  : null;
export default function ReviewPage() {
  if (mockEnabled && ReviewMock)
    return (
      <Suspense fallback={<p role="status">검토 화면 로딩 중…</p>}>
        <ReviewMock />
      </Suspense>
    );
  return <OpsLive />;
}

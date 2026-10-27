import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";
import StudioLive from "./StudioLive";

const Studio = import.meta.env.DEV
  ? lazy(() => import("../../mocks/StudioMock"))
  : null;

export default function PackagesPage() {
  if (mockEnabled && Studio)
    return (
      <Suspense fallback={<p role="status">관리 화면 준비 중…</p>}>
        <Studio />
      </Suspense>
    );
  return <StudioLive />;
}

import { lazy, Suspense } from "react";
import { useLocation } from "react-router";
import { mockEnabled } from "../auth/config";
import DirectRequestLive from "./DirectRequestLive";

const DirectMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/DirectMock"))
  : null;
export default function DirectRequestForm() {
  const location = useLocation();
  if (mockEnabled && DirectMock)
    return (
      <Suspense fallback={<p role="status">의뢰 준비 중…</p>}>
        <DirectMock key={location.pathname + location.search} />
      </Suspense>
    );
  return <DirectRequestLive />;
}

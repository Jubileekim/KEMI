import { lazy, Suspense } from "react";
import { mockEnabled } from "../auth/config";

const NoticeMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/RestrictionNoticeMock"))
  : null;
export default function RestrictionNotice() {
  return mockEnabled && NoticeMock ? (
    <Suspense fallback={null}>
      <NoticeMock />
    </Suspense>
  ) : null;
}

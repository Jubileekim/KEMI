import { lazy, Suspense } from "react";
import { useLocation } from "react-router";
import ScreenLinks from "../../app/ScreenLinks";
import { mockEnabled } from "../auth/config";

const ActivityMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/ActivityMock"))
  : null;
export default function ActivityPage() {
  const { pathname } = useLocation();
  return (
    <div className="grid gap-6">
      {mockEnabled && ActivityMock ? (
        <Suspense fallback={<p role="status">활동 준비 중…</p>}>
          <ActivityMock key={pathname} />
        </Suspense>
      ) : (
        <section className="showcase-card grid gap-4">
          <h1 className="type-heading-lg">활동 연결 준비 중</h1>
          <p>현재 모집·거래 데이터와 활동 API 계약을 조율하고 있어요.</p>
        </section>
      )}
      {pathname === "/me/activity" && <ScreenLinks />}
    </div>
  );
}

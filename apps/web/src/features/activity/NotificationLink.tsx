import { lazy, Suspense } from "react";
import { Link } from "react-router";
import { mockEnabled } from "../auth/config";

const BadgeMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/NotificationBadgeMock"))
  : null;
export default function NotificationLink() {
  if (mockEnabled && BadgeMock)
    return (
      <Suspense fallback={<Link to="/notifications">알림 확인 중</Link>}>
        <BadgeMock />
      </Suspense>
    );
  return <Link to="/notifications">알림</Link>;
}

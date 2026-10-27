import { lazy, Suspense } from "react";
import { Link } from "react-router";
import { mockEnabled } from "../auth/config";

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
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">패키지·서비스 관리 준비 중</h1>
      <p>
        패키지·대표 지정·서비스 공개 API 계약을 조율하고 있어요. 실제 저장과
        공개는 아직 연결되지 않았어요.
      </p>
      <Link to="/me/profile">내 프로필로 이동</Link>
    </section>
  );
}

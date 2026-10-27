import { lazy, Suspense } from "react";
import { Link } from "react-router";
import { mockEnabled } from "../auth/config";

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
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">작업물 관리 준비 중</h1>
      <p>
        작업물·파일 저장·공개 권한 API 계약을 조율하고 있어요. 실제
        등록·업로드·공개는 아직 연결되지 않았어요.
      </p>
      <Link to="/me/profile">내 프로필로 이동</Link>
    </section>
  );
}

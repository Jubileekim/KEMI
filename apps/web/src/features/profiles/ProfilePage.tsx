import { lazy, Suspense } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useSession, session } from "../../app/session";
import { mockEnabled } from "../auth/config";
import Button from "../../components/ui/button";
import { getProfile, profileError } from "./api";
import ProfileForm from "./ProfileForm";

const ExtrasMock = import.meta.env.DEV
  ? lazy(() => import("../../mocks/ProfileExtrasMock"))
  : null;

export default function ProfilePage() {
  const { user } = useSession();
  const role = user?.role === "CREATOR" ? "CREATOR" : "CLIENT";
  const key = ["my-profile", user?.id, role, session.epoch()] as const;
  const query = useQuery({
    queryKey: key,
    enabled: !!user && user.role !== "ADMIN",
    queryFn: ({ signal }) => getProfile(role, signal),
    refetchOnMount: "always",
    refetchOnReconnect: false,
  });
  if (!user)
    return (
      <section className="showcase-card grid gap-4" role="status">
        <h1 className="type-heading-lg">프로필을 확인할 회원 정보가 없어요</h1>
        <p>
          역할 전환만으로는 회원 프로필을 불러올 수 없어요. 로그아웃 후 계정으로
          로그인해 주세요.
        </p>
        <Button onClick={() => session.logout()}>
          로그아웃하고 다시 로그인
        </Button>
      </section>
    );
  if (query.isPending || query.isFetching)
    return <p role="status">프로필을 불러오고 있어요.</p>;
  if (query.error || !query.data)
    return (
      <section className="showcase-card grid gap-4" role="alert">
        <h1 className="type-heading-lg">프로필을 불러오지 못했어요</h1>
        <p>{profileError(query.error)}</p>
        <Button onClick={() => query.refetch()}>프로필 다시 불러오기</Button>
      </section>
    );
  const { data } = query;
  const status =
    data.profile.type === "CREATOR"
      ? { DRAFT: "초안", PUBLIC: "공개", PRIVATE: "비공개" }[
          data.profile.serviceStatus
        ]
      : null;
  return (
    <section className="mx-auto grid w-full max-w-3xl gap-6">
      <div className="grid gap-2">
        <p className="type-label-sm text-primary">MY PROFILE</p>
        <h1 className="type-heading-lg">내 프로필</h1>
        <p className="text-muted-foreground">
          {role === "CLIENT" ? "의뢰인" : "크리에이터"} · 함께할 사람에게 나를
          소개해요.
        </p>
      </div>
      {role === "CREATOR" && (
        <nav aria-label="제작 관리" className="flex flex-wrap gap-4">
          <Button asChild variant="outline">
            <Link to="/studio/packages">패키지·제작 서비스 관리</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/studio/portfolio">내 작업물 관리하기</Link>
          </Button>
        </nav>
      )}
      {mockEnabled && (
        <p role="status" className="rounded-lg bg-muted p-4">
          개발용 Mock 프로필 · 실제 서버에 저장되지 않아요. 기본 정보는 이
          탭에서만 보관해요.
        </p>
      )}
      {status && (
        <div className="showcase-card grid gap-2">
          <h2 className="type-heading-sm">제작 서비스 상태: {status}</h2>
          <p>
            프로필을 미완성 상태로 저장할 수 있어요. 저장만으로 서비스가
            공개되지 않아요.
          </p>
        </div>
      )}
      <div className="showcase-card">
        <ProfileForm
          key={user?.id}
          data={data}
          queryKey={key}
          reload={() => {
            query.refetch();
          }}
        />
      </div>
      {mockEnabled && ExtrasMock && (
        <Suspense fallback={<p role="status">추가 정보 준비 중…</p>}>
          <ExtrasMock key={user?.id} role={role} />
        </Suspense>
      )}
    </section>
  );
}

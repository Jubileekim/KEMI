import { Fragment, type ReactNode } from "react";
import {
  Link,
  Navigate,
  matchPath,
  useLocation,
  useSearchParams,
} from "react-router";
import Button from "../components/ui/button";
import { mockEnabled, useSession, session } from "./session";
import { authEnabled } from "../features/auth/config";
import { screens, type Role, type Screen } from "./routes";
import ScreenLinks from "./ScreenLinks";

const roleNames: Record<Role, string> = {
  guest: "비회원",
  client: "의뢰인",
  creator: "크리에이터",
  ops: "운영자",
};

export function Guard({
  screen,
  children,
}: {
  screen: Screen;
  children: ReactNode;
}) {
  const { role, status } = useSession();
  const location = useLocation();
  if (!screen.roles) {
    // Session reset clears Query cache and cancels in-flight reads. Remount
    // public query observers for the new epoch so they cannot stay pending
    // on a removed query. Auth forms own their in-flight state and must stay mounted.
    const authPage = ["/login", "/signup", "/auth/social/callback"].includes(
      screen.path,
    );
    return authPage ? (
      children
    ) : (
      <Fragment key={session.epoch()}>{children}</Fragment>
    );
  }
  if (!authEnabled)
    return (
      <section role="status">
        <h1 className="type-heading-lg">인증 연결 준비 중</h1>
        <p>실제 세션 계약 연결 후 이용할 수 있어요.</p>
      </section>
    );
  if (status === "checking")
    return <p role="status">세션을 확인하고 있어요.</p>;
  if (status === "error")
    return (
      <section role="alert">
        <p>세션을 확인하지 못했어요.</p>
        <Button onClick={() => session.bootstrap()}>세션 다시 확인</Button>
      </section>
    );
  // A remembered role alone must never authorize a protected page.
  if (status !== "authenticated" || role === "guest")
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  if (!screen.roles.includes(role))
    return (
      <section role="alert" className="showcase-card grid gap-6">
        <h1 className="type-heading-lg">접근 권한이 없어요</h1>
        <p>
          이 페이지는{" "}
          {screen.roles.map((allowed) => roleNames[allowed]).join(" · ")} 계정만
          이용할 수 있어요. 현재 계정은 {roleNames[role]}입니다.
        </p>
        <p className="text-muted-foreground">
          필요한 권한이 있는 계정으로 다시 로그인하거나 홈으로 이동해 주세요.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/">홈으로</Link>
          </Button>
          <Button onClick={() => session.logout()}>다른 계정으로 로그인</Button>
        </div>
      </section>
    );
  return children;
}
export function Placeholder({
  screen,
  title,
}: {
  screen?: Screen;
  title?: string;
}) {
  const [params] = useSearchParams();
  const { role } = useSession();
  const entry = screen?.path === "/" || screen?.path === "/me/activity";
  let description = "주소를 확인하거나 홈으로 이동해 주세요.";
  if (screen)
    description =
      "화면 경로와 레이아웃을 준비했어요. 제품 기능과 데이터는 아직 연결하지 않았어요.";
  if (entry)
    description =
      "이 화면의 피드·활동 내역은 아직 연결 준비 중이에요. 아래에서 이용할 화면으로 이동해 주세요.";
  const candidate = params.get("returnTo") ?? "/me/activity";
  const returnTo =
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\") &&
    screens.some((s) => matchPath(s.path, candidate.split("?")[0] ?? ""))
      ? candidate
      : "/me/activity";
  return (
    <section className="showcase-card grid gap-6">
      <h1 className="type-heading-lg">{screen?.title ?? title}</h1>
      <p className="text-muted-foreground">{description}</p>
      {entry && <ScreenLinks />}
      {mockEnabled && screen?.roles && (
        <p>개발용 Mock 접근 · 소유자·거래 당사자 검증 미연결</p>
      )}
      <div>
        <Button asChild variant="outline">
          <Link to="/">홈으로</Link>
        </Button>
      </div>
      {screen?.path === "/login" && mockEnabled && role !== "guest" && (
        <Link to={returnTo}>이전 화면으로 돌아가기</Link>
      )}
    </section>
  );
}

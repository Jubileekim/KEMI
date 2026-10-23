import type { ReactNode } from "react";
import {
  Link,
  Navigate,
  matchPath,
  useLocation,
  useSearchParams,
} from "react-router";
import Button from "@/components/ui/button";
import { mockEnabled, useSession, session } from "./session";
import { authEnabled } from "../features/auth/config";
import { screens, type Screen } from "./routes";

export function Guard({
  screen,
  children,
}: {
  screen: Screen;
  children: ReactNode;
}) {
  const { role, status } = useSession();
  const location = useLocation();
  if (!screen.roles) return children;
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
  if (role === "guest")
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  if (!screen.roles.includes(role))
    return (
      <section role="alert">
        <h1 className="type-heading-lg">접근 권한이 없어요</h1>
        <p>현재 계정으로 이용할 수 없는 화면이에요.</p>
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
      <p className="text-muted-foreground">
        {screen
          ? "화면 경로와 레이아웃을 준비했어요. 제품 기능과 데이터는 아직 연결하지 않았어요."
          : "주소를 확인하거나 홈으로 이동해 주세요."}
      </p>
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

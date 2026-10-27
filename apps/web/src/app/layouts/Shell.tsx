import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, matchRoutes, useLocation } from "react-router";
import Brand from "@/components/kemi/brand";
import { screens } from "../routes";
import { mockEnabled, session, useSession } from "../session";
import { NotificationLink } from "../../features/activity/ActivityLive";
import { RestrictionNotice } from "../../features/operations/SafetyLive";
import Button from "../../components/ui/button";

export default function Shell() {
  const location = useLocation();
  const { role, status, notice } = useSession();
  const main = useRef<HTMLElement>(null);
  const screen = matchRoutes(screens, location)?.[0]?.route;
  useEffect(() => {
    document.title = `${screen?.title ?? "페이지 없음"} | KEMI`;
    main.current?.focus();
  }, [location.pathname, screen?.title]);
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-card focus:p-4"
      >
        본문으로 건너뛰기
      </a>
      <header className="border-b bg-card">
        <div className="page-container shell-header">
          <Link to="/" aria-label="KEMI 홈">
            <Brand />
          </Link>
          <nav aria-label="주 메뉴" className="flex flex-wrap gap-6">
            <NavLink to="/" end>
              작품
            </NavLink>
            <NavLink to="/campaigns">공개 모집</NavLink>
            {role === "ops" && (
              <>
                <NavLink to="/ops/disputes">분쟁·보류 검토</NavLink>
                {!mockEnabled && <NavLink to="/ops/reports">신고 검토</NavLink>}
              </>
            )}
            {role === "client" && (
              <NavLink to="/campaigns/new">캠페인 작성</NavLink>
            )}
            <NavLink to="/me/activity">내 활동</NavLink>
            {(role === "client" || role === "creator") && (
              <>
                {!mockEnabled && <NotificationLink />}
                <NavLink to="/me/profile">내 프로필</NavLink>
              </>
            )}
            {(role === "client" || role === "creator") && (
              <NavLink to="/requests">내 제안·협의</NavLink>
            )}
            {role === "creator" && (
              <>
                {!mockEnabled && (
                  <NavLink to="/recommendations">추천 캠페인</NavLink>
                )}
                <NavLink to="/studio/packages">패키지·서비스</NavLink>
                <NavLink to="/studio/portfolio">작업물 관리</NavLink>
              </>
            )}
            {role === "guest" ? (
              <NavLink to="/login">로그인</NavLink>
            ) : (
              <Button variant="ghost" onClick={() => session.logout()}>
                로그아웃
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main
        id="main-content"
        ref={main}
        tabIndex={-1}
        className="page-container grid gap-6"
        data-layout={screen?.layout ?? "public"}
      >
        <p className="text-sm text-muted-foreground">
          {
            {
              public: "함께 만드는 KEMI",
              member: "회원 공간",
              workspace: "작업 공간",
              ops: "운영 공간 · 권한 정책 D18 확인 필요",
            }[screen?.layout ?? "public"]
          }
        </p>
        {status === "logging-out" || status === "logout-error" ? (
          <section role="status">
            <p>
              {status === "logging-out"
                ? "로그아웃을 처리하고 있어요."
                : notice}
            </p>
            {status === "logout-error" && (
              <Button onClick={() => session.logout()}>
                서버 로그아웃 다시 시도
              </Button>
            )}
          </section>
        ) : (
          <>
            {/* 실제 API 모드에서만: 이용 제한 중이면 안내를 먼저 보여준다(개발 Mock 화면은 그대로). */}
            {!mockEnabled && <RestrictionNotice />}
            <Outlet />
          </>
        )}
      </main>
      <footer className="page-container text-sm text-muted-foreground">
        KEMI · 화면 기반 구성 중
      </footer>
    </>
  );
}

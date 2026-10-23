import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, matchRoutes, useLocation } from "react-router";
import Brand from "@/components/kemi/brand";
import { screens } from "../routes";

export default function Shell() {
  const location = useLocation();
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
            <NavLink to="/me/activity">내 활동</NavLink>
            <NavLink to="/login">로그인</NavLink>
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
        <Outlet />
      </main>
      <footer className="page-container text-sm text-muted-foreground">
        KEMI · 화면 기반 구성 중
      </footer>
    </>
  );
}

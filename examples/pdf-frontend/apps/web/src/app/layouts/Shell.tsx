import { useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  matchRoutes,
  useLocation,
} from 'react-router-dom';
import { Brand } from '@/components/kemi/brand';
import { screens } from '../routes';
import { useDemo } from '../../features/demo/context';
import type { Role } from '../../features/demo/model';
import {
  Bell,
  ArrowUpRight,
  Menu,
  X,
  ArrowRight,
  RotateCcw,
  Film,
  BriefcaseBusiness,
  MessageSquare,
  User,
  Bookmark,
  Layers,
  LayoutGrid,
} from 'lucide-react';
import { Empty, Button } from '../../features/demo/ui';
export function Shell() {
  const location = useLocation();
  const main = useRef<HTMLElement>(null);
  const screen = matchRoutes(screens, location)?.[0]?.route;
  const { role, setRole, reset, state, storageError } = useDemo();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === location.pathname;
  const [view, setView] = useState('normal');
  const [confirmReset, setConfirmReset] = useState(false);
  const member = role === 'client' || role === 'creator';
  const unread = state.notifications.filter(
    (n) => n.role === role && !n.read,
  ).length;
  useEffect(() => {
    document.title = `${screen?.title ?? '페이지 없음'} | KEMI`;
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
      <aside
        className="demo-banner"
        aria-label="로컬 시연 안내"
        data-demo-role={role}
      >
        <div>
          <span className="demo-badge">DEMO</span>
          <span>PDF 기반 프론트엔드 · 실제 인증·결제·AI 미연결</span>
        </div>
        <label>
          시연 역할
          <select
            aria-label="시연 역할"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="guest">비회원</option>
            <option value="client">의뢰인</option>
            <option value="creator">제작자</option>
            <option value="ops">운영 (시연)</option>
          </select>
        </label>
      </aside>
      {storageError && (
        <p className="notice" role="alert">
          브라우저 저장소를 사용할 수 없어 새로고침하면 변경 사항이 사라질 수
          있어요.
        </p>
      )}
      <header className="product-header">
        <div className="product-container header-inner">
          <Link to="/" aria-label="KEMI 홈">
            <Brand />
          </Link>
          <nav aria-label="주 메뉴" className="desktop-nav">
            <NavLink to="/" end>
              작품 둘러보기
            </NavLink>
            <NavLink to="/campaigns">공개 모집</NavLink>
            <NavLink to="/requests">대화 · 작업</NavLink>
          </nav>
          <div className="header-actions">
            {member ? (
              <>
                <Link
                  to="/notifications"
                  aria-label={`알림 ${unread}개`}
                  className="icon-button bell"
                >
                  <Bell size={20} />
                  {unread > 0 && <b>{unread}</b>}
                </Link>
                <Link to="/me/activity" className="avatar small">
                  {role === 'client' ? 'C' : 'M'}
                </Link>
                <button
                  className="logout-button"
                  onClick={() => setRole('guest')}
                >
                  로그아웃
                </button>
              </>
            ) : role === 'ops' ? (
              <Link to="/ops/reports">운영 화면</Link>
            ) : (
              <Link to="/login" className="login-link">
                로그인
              </Link>
            )}
            <Link className="header-cta" to="/campaigns/new">
              프로젝트 시작하기 <ArrowUpRight size={16} />
            </Link>
            <button
              className="mobile-menu icon-button"
              aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={menuOpen}
              onClick={() => setMenuPath(menuOpen ? null : location.pathname)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="mobile-nav" aria-label="모바일 메뉴">
            <Link to="/">작품 둘러보기</Link>
            <Link to="/campaigns">공개 모집</Link>
            <Link to="/requests">대화 · 작업</Link>
            <Link to="/me/activity">내 활동</Link>
            <Link to="/me/profile">프로필</Link>
          </nav>
        )}
      </header>
      {member && (
        <nav className="member-nav product-container" aria-label="회원 메뉴">
          {[
            ['/me/activity', '내 활동', LayoutGrid],
            ['/requests', '의뢰 · 대화', MessageSquare],
            ['/me/profile', '내 프로필', User],
            ...(role === 'creator'
              ? [
                  ['/studio/portfolio', '작품 관리', Film],
                  ['/studio/packages', '패키지', Layers],
                  ['/bookmarks', '저장한 모집', Bookmark],
                ]
              : [['/campaigns/new', '모집 작성', BriefcaseBusiness]]),
          ].map(([to, title, Icon]) => {
            const Component = Icon as typeof User;
            return (
              <NavLink to={to as string} key={to as string}>
                <Component size={15} />
                {title as string}
              </NavLink>
            );
          })}
        </nav>
      )}
      <main
        id="main-content"
        ref={main}
        tabIndex={-1}
        className="product-container product-main"
        data-layout={screen?.layout ?? 'public'}
      >
        {view === 'normal' ? (
          <Outlet key={location.pathname} />
        ) : view === 'loading' ? (
          <div className="loading-state" role="status">
            <span className="loading-dot" />
            화면을 불러오고 있어요.
            <Button variant="secondary" onClick={() => setView('normal')}>
              로딩 시연 마치기
            </Button>
          </div>
        ) : view === 'empty' ? (
          <Empty
            title="아직 표시할 내용이 없어요"
            description="빈 결과 상태를 확인하고 있어요."
          >
            <Button variant="secondary" onClick={() => setView('normal')}>
              원래 화면으로
            </Button>
          </Empty>
        ) : (
          <div role="alert">
            <Empty
              title="화면을 불러오지 못했어요"
              description="오류 상태 시연입니다. 다시 시도해 주세요."
            >
              <Button onClick={() => setView('normal')}>다시 시도</Button>
            </Empty>
          </div>
        )}
      </main>
      <footer className="product-footer">
        <div className="product-container">
          <div className="footer-top">
            <Link to="/">
              <Brand />
            </Link>
            <p>좋은 만남이 만드는, 다음 장면.</p>
            <Link to="/campaigns">
              함께 시작해요 <ArrowRight size={16} />
            </Link>
          </div>
          <div className="footer-bottom">
            <span>© 2026 KEMI. PDF 기반 로컬 시연.</span>
            <details className="demo-controls">
              <summary>시연 도구</summary>
              <div>
                <label>
                  화면 상태
                  <select
                    aria-label="화면 상태 시연"
                    value={view}
                    onChange={(e) => setView(e.target.value)}
                  >
                    <option value="normal">기본</option>
                    <option value="loading">로딩</option>
                    <option value="empty">빈 결과</option>
                    <option value="error">오류</option>
                  </select>
                </label>
                {confirmReset ? (
                  <>
                    <p>이 브라우저의 시연 작업 기록을 모두 초기화할까요?</p>
                    <Button
                      variant="danger"
                      onClick={() => {
                        reset();
                        setConfirmReset(false);
                      }}
                    >
                      초기화 확인
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmReset(false)}
                    >
                      취소
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmReset(true)}>
                    <RotateCcw size={14} /> 시연 데이터 초기화
                  </Button>
                )}
              </div>
            </details>
          </div>
        </div>
      </footer>
    </>
  );
}

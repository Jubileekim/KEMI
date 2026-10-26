import type { ReactNode } from 'react';
import {
  Link,
  Navigate,
  matchPath,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { mockEnabled, useSession } from './session';
import { screens, type Screen } from './routes';
export function Guard({
  screen,
  children,
}: {
  screen: Screen;
  children: ReactNode;
}) {
  const { role } = useSession();
  const location = useLocation();
  if (!screen.roles) return children;
  if (!mockEnabled)
    return (
      <section role="status">
        <h1 className="type-heading-lg">인증 연결 준비 중</h1>
        <p>실제 세션 계약 연결 후 이용할 수 있어요.</p>
      </section>
    );
  if (role === 'guest')
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
        <p>개발용 Mock 역할 기준입니다. 서버 권한 검증은 미연결 상태예요.</p>
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
  const candidate = params.get('returnTo') ?? '/me/activity';
  const returnTo =
    candidate.startsWith('/') &&
    !candidate.startsWith('//') &&
    !candidate.includes('\\') &&
    screens.some((s) => matchPath(s.path, candidate.split('?')[0]))
      ? candidate
      : '/me/activity';
  return (
    <section className="showcase-card grid gap-6">
      <h1 className="type-heading-lg">{screen?.title ?? title}</h1>
      <p className="text-muted-foreground">
        {screen
          ? '화면 경로와 레이아웃을 준비했어요. 제품 기능과 데이터는 아직 연결하지 않았어요.'
          : '주소를 확인하거나 홈으로 이동해 주세요.'}
      </p>
      {mockEnabled && screen?.roles && (
        <p>개발용 Mock 접근 · 소유자·거래 당사자 검증 미연결</p>
      )}
      <div>
        <Button asChild variant="outline">
          <Link to="/">홈으로</Link>
        </Button>
      </div>
      {screen?.path === '/login' && mockEnabled && role !== 'guest' && (
        <Link to={returnTo}>이전 화면으로 돌아가기</Link>
      )}
    </section>
  );
}

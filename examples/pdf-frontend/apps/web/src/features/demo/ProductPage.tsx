import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Screen } from '../../app/routes';
import { useDemo } from './context';
import { Empty, ActionLink } from './ui';
import { Feed, WorkDetail, CreatorDetail, DirectRequest } from './Discovery';
import { Campaigns, CampaignDetail, CampaignForm, Apply } from './Campaigns';
import {
  Login,
  Profile,
  Packages,
  Portfolios,
  Notifications,
  SocialCallback,
} from './Account';
import { Requests, RequestDetail, Workspace } from './Workspace';
import {
  Payment,
  Cancellation,
  Dispute,
  Operations,
  ReviewPage,
  Reports,
} from './Transaction';
export function DemoGuard({
  screen,
  children,
}: {
  screen: Screen;
  children: ReactNode;
}) {
  const { role } = useDemo();
  const location = useLocation();
  if (!screen.roles) return children;
  if (role === 'guest')
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  if (!screen.roles.includes(role))
    return (
      <Empty
        title="다른 역할의 화면이에요"
        description="상단 시연 역할을 변경하면 해당 화면을 확인할 수 있어요."
      >
        <ActionLink to="/" secondary>
          홈으로 돌아가기
        </ActionLink>
      </Empty>
    );
  return children;
}
export function ProductPage({ path }: { path: string }) {
  switch (path) {
    case '/':
      return <Feed />;
    case '/works/:workId':
      return <WorkDetail />;
    case '/creators/:creatorId':
      return <CreatorDetail />;
    case '/creators/:creatorId/request':
      return <DirectRequest />;
    case '/login':
      return <Login />;
    case '/signup':
      return <Login signup />;
    case '/onboarding':
      return <Login onboarding />;
    case '/auth/social/callback':
      return <SocialCallback />;
    case '/me/profile':
      return <Profile />;
    case '/studio/packages':
      return <Packages />;
    case '/studio/portfolio':
      return <Portfolios />;
    case '/campaigns':
      return <Campaigns />;
    case '/bookmarks':
      return <Campaigns mode="bookmarks" />;
    case '/recommendations':
      return <Campaigns mode="recommended" />;
    case '/campaigns/:campaignId':
      return <CampaignDetail />;
    case '/campaigns/new':
    case '/campaigns/:campaignId/edit':
      return <CampaignForm />;
    case '/campaigns/:campaignId/apply':
      return <Apply />;
    case '/campaigns/:campaignId/proposals':
      return <Requests proposals />;
    case '/requests':
      return <Requests />;
    case '/me/activity':
      return <Requests activity />;
    case '/requests/:requestId':
      return <RequestDetail />;
    case '/workspace/:requestId':
      return <Workspace />;
    case '/contracts/:contractId/payment':
      return <Payment />;
    case '/payments/result':
      return <Payment result />;
    case '/contracts/:contractId/cancellation':
      return <Cancellation />;
    case '/contracts/:contractId/review':
      return <ReviewPage />;
    case '/disputes/:disputeId':
      return <Dispute />;
    case '/reports/new':
      return <Reports />;
    case '/notifications':
      return <Notifications />;
    case '/ops/reports':
    case '/ops/disputes':
      return <Operations />;
    default:
      return <Empty title="페이지를 찾을 수 없어요" />;
  }
}

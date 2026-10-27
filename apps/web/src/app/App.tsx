import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import Providers from "./providers";
import Shell from "./layouts/Shell";
import { Guard, Placeholder } from "./route-pages";
import { screens } from "./routes";

const SafetyPage = lazy(() => import("../features/operations/SafetyPage"));
const safetyPaths = ["/reports/new", "/ops/reports"];
const EngagementPage = lazy(
  () => import("../features/activity/EngagementPage"),
);
const engagementPaths = ["/notifications", "/contracts/:contractId/review"];
const ActivityPage = lazy(() => import("../features/activity/ActivityPage"));
const activityPaths = ["/me/activity", "/bookmarks", "/recommendations"];
const AuthForm = lazy(() => import("../features/auth/AuthForm"));
const GoogleCallback = lazy(() => import("../features/auth/GoogleCallback"));
const ProfilePage = lazy(() => import("../features/profiles/ProfilePage"));
const CreatorDetailPage = lazy(
  () => import("../features/profiles/CreatorDetailPage"),
);
const DirectRequestForm = lazy(
  () => import("../features/requests/DirectRequestForm"),
);
const FeedPage = lazy(() => import("../features/portfolio/FeedPage"));
const WorkDetailPage = lazy(
  () => import("../features/portfolio/WorkDetailPage"),
);
const PortfolioPage = lazy(() => import("../features/portfolio/PortfolioPage"));
const PackagesPage = lazy(() => import("../features/packages/PackagesPage"));
const CampaignEditor = lazy(
  () => import("../features/campaigns/CampaignEditor"),
);
const CampaignBrowsePage = lazy(
  () => import("../features/campaigns/CampaignBrowsePage"),
);
const ProposalPage = lazy(() => import("../features/campaigns/ProposalPage"));
const PaymentPage = lazy(() => import("../features/payments/PaymentPage"));
const ReadinessPanel = lazy(
  () => import("../features/production/ReadinessPanel"),
);
const DeliveryVersions = lazy(
  () => import("../features/production/DeliveryVersions"),
);
const SettlementSummary = lazy(
  () => import("../features/resolution/SettlementSummary"),
);
const CancellationPage = lazy(
  () => import("../features/resolution/CancellationPage"),
);
const DisputePage = lazy(() => import("../features/resolution/DisputePage"));
const ReviewPage = lazy(() => import("../features/operations/ReviewPage"));
const PaymentResultPage = lazy(
  () => import("../features/payments/PaymentResultPage"),
);
const proposalPaths = [
  "/campaigns/:campaignId/apply",
  "/campaigns/:campaignId/proposals",
  "/requests",
  "/requests/:requestId",
  "/workspace/:requestId",
];
const GoogleProvider = import.meta.env.DEV
  ? lazy(() => import("../mocks/GoogleProvider"))
  : null;

const DevTools = import.meta.env.DEV
  ? lazy(() => import("../mocks/DevTools"))
  : null;
const Showcase = import.meta.env.DEV
  ? lazy(() => import("./UiShowcase"))
  : null;

const HealthDiagnostic = import.meta.env.DEV
  ? lazy(() => import("../dev/HealthDiagnostic"))
  : null;

export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Suspense fallback={<p role="status">화면을 준비하고 있어요.</p>}>
          {DevTools && <DevTools />}
          <Routes>
            <Route element={<Shell />}>
              {screens.map((screen) => (
                <Route
                  key={screen.path}
                  path={screen.path}
                  element={
                    <Guard screen={screen}>
                      {activityPaths.includes(screen.path) && <ActivityPage />}
                      {safetyPaths.includes(screen.path) && <SafetyPage />}
                      {engagementPaths.includes(screen.path) && (
                        <EngagementPage />
                      )}
                      {(screen.path === "/login" ||
                        screen.path === "/signup") && (
                        <AuthForm
                          key={screen.path}
                          signup={screen.path === "/signup"}
                        />
                      )}
                      {screen.path === "/auth/social/callback" && (
                        <GoogleCallback />
                      )}
                      {screen.path === "/me/profile" && <ProfilePage />}
                      {screen.path === "/creators/:creatorId" && (
                        <CreatorDetailPage />
                      )}
                      {screen.path === "/creators/:creatorId/request" && (
                        <DirectRequestForm />
                      )}
                      {screen.path === "/" && <FeedPage />}
                      {screen.path === "/works/:workId" && <WorkDetailPage />}
                      {screen.path === "/studio/packages" && <PackagesPage />}
                      {screen.path === "/studio/portfolio" && <PortfolioPage />}
                      {proposalPaths.includes(screen.path) && <ProposalPage />}
                      {screen.path === "/contracts/:contractId/payment" && (
                        <PaymentPage />
                      )}
                      {screen.path === "/payments/result" && (
                        <PaymentResultPage />
                      )}
                      {screen.path === "/contracts/:contractId/production" && (
                        <ReadinessPanel />
                      )}
                      {screen.path === "/contracts/:contractId/deliveries" && (
                        <DeliveryVersions />
                      )}
                      {screen.path === "/contracts/:contractId/settlement" && (
                        <SettlementSummary />
                      )}
                      {screen.path ===
                        "/contracts/:contractId/cancellation" && (
                        <CancellationPage />
                      )}
                      {screen.path === "/disputes/:disputeId" && (
                        <DisputePage />
                      )}
                      {screen.path === "/ops/disputes" && <ReviewPage />}
                      {(screen.path === "/campaigns/new" ||
                        screen.path === "/campaigns/:campaignId/edit") && (
                        <CampaignEditor />
                      )}
                      {(screen.path === "/campaigns" ||
                        screen.path === "/campaigns/:campaignId") && (
                        <CampaignBrowsePage />
                      )}
                      {![
                        ...proposalPaths,
                        ...activityPaths,
                        ...engagementPaths,
                        ...safetyPaths,
                        "/",
                        "/works/:workId",
                        "/creators/:creatorId",
                        "/creators/:creatorId/request",
                        "/contracts/:contractId/payment",
                        "/payments/result",
                        "/contracts/:contractId/production",
                        "/contracts/:contractId/deliveries",
                        "/contracts/:contractId/settlement",
                        "/contracts/:contractId/cancellation",
                        "/disputes/:disputeId",
                        "/ops/disputes",
                        "/login",
                        "/signup",
                        "/auth/social/callback",
                        "/me/profile",
                        "/studio/packages",
                        "/studio/portfolio",
                        "/campaigns",
                        "/campaigns/:campaignId",
                        "/campaigns/new",
                        "/campaigns/:campaignId/edit",
                      ].includes(screen.path) && (
                        <Placeholder screen={screen} />
                      )}
                    </Guard>
                  }
                />
              ))}
              <Route
                path="*"
                element={<Placeholder title="페이지를 찾을 수 없어요" />}
              />
            </Route>
            {Showcase && <Route path="/__dev/ui" element={<Showcase />} />}
            {GoogleProvider && (
              <Route path="/__mock__/google" element={<GoogleProvider />} />
            )}
            {HealthDiagnostic && (
              <Route path="/__dev/health" element={<HealthDiagnostic />} />
            )}
          </Routes>
        </Suspense>
      </BrowserRouter>
    </Providers>
  );
}

import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import Providers from "./providers";
import Shell from "./layouts/Shell";
import { Guard, Placeholder } from "./route-pages";
import { screens } from "./routes";

const AuthForm = lazy(() => import("../features/auth/AuthForm"));
const GoogleCallback = lazy(() => import("../features/auth/GoogleCallback"));
const ProfilePage = lazy(() => import("../features/profiles/ProfilePage"));
const PortfolioPage = lazy(() => import("../features/portfolio/PortfolioPage"));
const PackagesPage = lazy(() => import("../features/packages/PackagesPage"));
const CampaignEditor = lazy(
  () => import("../features/campaigns/CampaignEditor"),
);
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
                      {screen.path === "/studio/packages" && <PackagesPage />}
                      {screen.path === "/studio/portfolio" && <PortfolioPage />}
                      {(screen.path === "/campaigns/new" ||
                        screen.path === "/campaigns/:campaignId/edit") && (
                        <CampaignEditor />
                      )}
                      {![
                        "/login",
                        "/signup",
                        "/auth/social/callback",
                        "/me/profile",
                        "/studio/packages",
                        "/studio/portfolio",
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

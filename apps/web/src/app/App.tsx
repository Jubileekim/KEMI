import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import Providers from "./providers";
import Shell from "./layouts/Shell";
import { Guard, Placeholder } from "./route-pages";
import { screens } from "./routes";

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
                      <Placeholder screen={screen} />
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
            {HealthDiagnostic && (
              <Route path="/__dev/health" element={<HealthDiagnostic />} />
            )}
          </Routes>
        </Suspense>
      </BrowserRouter>
    </Providers>
  );
}

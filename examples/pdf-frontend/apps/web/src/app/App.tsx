import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Providers } from './providers';
import { Shell } from './layouts/Shell';
import { Placeholder } from './route-pages';
import { screens } from './routes';
import { DemoProvider } from '../features/demo/store';
import { ProductPage, DemoGuard } from '../features/demo/ProductPage';
import { Toaster } from '@/components/ui/sonner';

const Showcase = import.meta.env.DEV
  ? lazy(() => import('./UiShowcase').then((m) => ({ default: m.UiShowcase })))
  : null;

export function App() {
  return (
    <Providers>
      <DemoProvider>
        <BrowserRouter>
          <Toaster position="bottom-right" closeButton />
          <Suspense fallback={<p role="status">화면을 준비하고 있어요.</p>}>
            <Routes>
              <Route element={<Shell />}>
                {screens.map((screen) => (
                  <Route
                    key={screen.path}
                    path={screen.path}
                    element={
                      <DemoGuard screen={screen}>
                        <ProductPage path={screen.path} />
                      </DemoGuard>
                    }
                  />
                ))}
                <Route
                  path="*"
                  element={<Placeholder title="페이지를 찾을 수 없어요" />}
                />
              </Route>
              {Showcase && <Route path="/__dev/ui" element={<Showcase />} />}
            </Routes>
          </Suspense>
        </BrowserRouter>
      </DemoProvider>
    </Providers>
  );
}

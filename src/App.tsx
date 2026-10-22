import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthGate } from './components/auth/AuthGate';
import { AuthProvider } from './components/auth/AuthProvider';
import { AppLayout } from './components/layout/AppLayout';
import { MODULES } from './config/modules';
import { HomePage } from './pages/HomePage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Skeleton } from './components/ui/Card';

// Loaded on demand so Home stays light; the service worker precaches it for offline use.
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <AuthGate>
                <AppLayout />
              </AuthGate>
            }
          >
            <Route index element={<HomePage />} />
            <Route
              path="inventory"
              element={
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <InventoryPage />
                </Suspense>
              }
            />
            {MODULES.filter((m) => m.id !== 'home' && m.id !== 'inventory').map((m) => (
              <Route key={m.id} path={m.path.slice(1)} element={<ModulePlaceholderPage moduleId={m.id} />} />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

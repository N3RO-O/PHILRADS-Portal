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
const ResponsePage = lazy(() => import('./pages/ResponsePage').then((m) => ({ default: m.ResponsePage })));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage').then((m) => ({ default: m.ResourcesPage })));
const LiveMapPage = lazy(() => import('./pages/LiveMapPage').then((m) => ({ default: m.LiveMapPage })));
const LogsPage = lazy(() => import('./pages/LogsPage').then((m) => ({ default: m.LogsPage })));
const StaffPage = lazy(() => import('./pages/StaffPage').then((m) => ({ default: m.StaffPage })));
const TasksPage = lazy(() => import('./pages/TasksPage').then((m) => ({ default: m.TasksPage })));

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
            <Route
              path="resources"
              element={
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <ResourcesPage />
                </Suspense>
              }
            />
            <Route
              path="response"
              element={
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <ResponsePage />
                </Suspense>
              }
            />
            <Route
              path="tasks"
              element={
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <TasksPage />
                </Suspense>
              }
            />
            <Route
              path="staff"
              element={
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <StaffPage />
                </Suspense>
              }
            />
            <Route
              path="logs"
              element={
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <LogsPage />
                </Suspense>
              }
            />
            <Route
              path="live-map"
              element={
                <Suspense fallback={<Skeleton className="h-96" />}>
                  <LiveMapPage />
                </Suspense>
              }
            />
            {MODULES.filter((m) => !['home', 'inventory', 'resources', 'response', 'staff', 'tasks', 'live-map', 'logs'].includes(m.id)).map((m) => (
              <Route key={m.id} path={m.path.slice(1)} element={<ModulePlaceholderPage moduleId={m.id} />} />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

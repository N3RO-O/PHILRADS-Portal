import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthGate } from './components/auth/AuthGate';
import { AuthProvider } from './components/auth/AuthProvider';
import { AppLayout } from './components/layout/AppLayout';
import { MODULES } from './config/modules';
import { HomePage } from './pages/HomePage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';

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
            {MODULES.filter((m) => m.id !== 'home').map((m) => (
              <Route key={m.id} path={m.path.slice(1)} element={<ModulePlaceholderPage moduleId={m.id} />} />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

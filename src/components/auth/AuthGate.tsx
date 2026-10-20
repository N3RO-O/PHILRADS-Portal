import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { SignInPage } from '../../pages/SignInPage';
import { Emblem } from '../ui/Emblem';

function CenteredMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="card flex max-w-md flex-col items-center gap-4 text-center">
        <Emblem className="h-14 w-14" />
        <h1 className="text-xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

/** Requires a signed-in, active staff account when live data is enabled. Demo mode passes straight through. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth();

  if (state.status === 'loading') {
    return (
      <CenteredMessage title="PHILRADS Staff Portal">
        <p className="text-sm text-muted" role="status">
          Checking your sign-in…
        </p>
      </CenteredMessage>
    );
  }
  if (state.status === 'signed-out') return <SignInPage />;
  if (state.status === 'signed-in' && (!state.profile || !state.profile.isActive)) {
    return (
      <CenteredMessage title="Your account is not active yet">
        <p className="text-sm text-muted">
          {state.profileError ?? 'A PHILRADS administrator needs to activate your staff account before you can use the portal.'}
        </p>
        <button type="button" className="btn-ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </CenteredMessage>
    );
  }
  return <>{children}</>;
}

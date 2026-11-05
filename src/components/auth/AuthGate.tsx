import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { SetPasswordPage } from '../../pages/SetPasswordPage';
import { SignInPage } from '../../pages/SignInPage';
import { Emblem } from '../ui/Emblem';

function CenteredMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="panel flex max-w-md flex-col items-center gap-4 text-center">
        <Emblem className="h-14 w-14" />
        <h1 className="text-xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

/** Requires a signed-in, active staff account when live data is enabled. Demo mode passes straight through. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, needsPassword, signOut } = useAuth();

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
  if (needsPassword) return <SetPasswordPage />;
  if (state.status === 'signed-in' && (!state.profile || !state.profile.isActive)) {
    // The profile couldn't be read (often an old copy of the portal after an update), which is
    // not the same as an account that's switched off.
    if (!state.profile && state.profileError) return <ProfileLoadProblem message={state.profileError} onSignOut={() => void signOut()} />;
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

/**
 * The profile didn't load. Usually this device is still running an older copy of the portal that
 * the database no longer answers the same way: fetch the new version and switch to it, then reload.
 */
function ProfileLoadProblem({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  const [state, setState] = useState<'checking' | 'reloading' | 'idle'>('checking');
  const reload = () => {
    setState('reloading');
    window.location.reload();
  };
  useEffect(() => {
    let done = false;
    const sw = navigator.serviceWorker;
    if (!sw) return setState('idle');
    const onSwitch = () => !done && ((done = true), window.location.reload());
    sw.addEventListener('controllerchange', onSwitch);
    void sw
      .getRegistration()
      .then(async (reg) => {
        await reg?.update().catch(() => undefined);
        const waiting = reg?.waiting;
        if (waiting) {
          setState('reloading');
          waiting.postMessage({ type: 'SKIP_WAITING' });
        } else setState('idle');
      })
      .catch(() => setState('idle'));
    return () => sw.removeEventListener('controllerchange', onSwitch);
  }, []);
  return (
    <CenteredMessage title={state === 'idle' ? 'Your profile didn’t load' : 'Updating the portal…'}>
      <p className="text-sm text-muted">
        {state === 'idle' ? `${message} Reload the portal; if it keeps happening, close every PHILRADS tab (or the app) and open it again.` : 'Getting the latest version. This takes a moment.'}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" onClick={reload} disabled={state !== 'idle'}>
          <RefreshCw className={`h-4 w-4 ${state !== 'idle' ? 'animate-spin' : ''}`} aria-hidden /> Reload
        </button>
        <button type="button" className="btn-ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </CenteredMessage>
  );
}

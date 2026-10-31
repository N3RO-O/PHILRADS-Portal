import { useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useAuth } from '../components/auth/AuthProvider';
import { Emblem } from '../components/ui/Emblem';
import { PasswordField } from '../components/ui/PasswordField';
import { SignInBackground } from '../components/auth/SignInBackground';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { takeIdleSignOut } from '../lib/idle';
import { shake } from '../lib/motion';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const resetSchema = schema.pick({ email: true });

export function SignInPage() {
  const { signIn, requestPasswordReset } = useAuth();
  const online = useOnlineStatus();
  const [mode, setMode] = useState<'sign-in' | 'reset'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idleOut] = useState(takeIdleSignOut);
  const card = useRef<HTMLDivElement>(null);
  // Counts failed tries, so the same message still shakes and fades in again.
  const [attempt, setAttempt] = useState(0);

  /** Something is wrong: the card shakes, then the message appears. */
  const fail = (message: string) => {
    setError(message);
    setAttempt((n) => n + 1);
    shake(card.current);
  };

  const switchMode = (next: 'sign-in' | 'reset') => {
    setMode(next);
    setError(null);
    setResetSentTo(null);
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) {
      fail(parsed.error.issues[0]?.message ?? 'Check your email address.');
      return;
    }
    if (!online) {
      fail('You are offline. Sending a reset link needs an internet connection.');
      return;
    }
    setBusy(true);
    const failure = await requestPasswordReset(parsed.data.email);
    if (failure) fail(failure);
    else setError(null);
    setResetSentTo(failure ? null : parsed.data.email);
    setBusy(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      fail(parsed.error.issues[0]?.message ?? 'Check your details.');
      return;
    }
    if (!online) {
      fail('You are offline. Signing in needs an internet connection.');
      return;
    }
    setBusy(true);
    const failure = await signIn(parsed.data.email, parsed.data.password);
    setBusy(false);
    if (failure) fail(failure);
    else setError(null);
  };

  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden p-4">
      <SignInBackground />
      <div ref={card} className="card w-full max-w-sm animate-fade-up gap-0 p-0 shadow-2xl shadow-black/40">
        <div className="flex flex-col items-center gap-3 rounded-t-2xl border-b border-line/70 px-6 py-8 text-center">
          <Emblem className="h-16 w-16" />
          <div>
            <p className="font-display text-2xl tracking-wide">PHILRADS</p>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Staff Portal</p>
          </div>
        </div>
        {mode === 'sign-in' ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-6">
            <h1 className="text-lg font-bold">Sign in</h1>
            {idleOut && !error && (
              <p role="status" className="rounded-xl border border-uplift/30 bg-uplift/10 px-4 py-3 text-sm text-ink-soft">
                You were signed out after 10 minutes without activity. Sign in again to continue.
              </p>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
              Email
              <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sign-in-password" className="text-sm font-medium text-ink-soft">
                Password
              </label>
              <PasswordField
                id="sign-in-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error) || undefined}
                className={error ? 'border-rose/60' : ''}
                required
              />
            </div>
            {error && (
              <p key={attempt} role="alert" className="animate-fade-in rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose [animation-delay:380ms]">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => switchMode('reset')}>
              Forgot your password?
            </button>
            <p className="text-center text-xs text-muted">Staff accounts are created by the PHILRADS administrator.</p>
          </form>
        ) : (
          <form onSubmit={submitReset} noValidate className="flex flex-col gap-4 p-6">
            <div>
              <h1 className="text-lg font-bold">Reset your password</h1>
              <p className="mt-1 text-sm text-muted">We will email you a link to choose a new one.</p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
              Email
              <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {error && (
              <p key={attempt} role="alert" className="animate-fade-in rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose [animation-delay:380ms]">
                {error}
              </p>
            )}
            {resetSentTo && (
              <p role="status" className="rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-soft">
                If {resetSentTo} has a staff account, a reset link is on its way. Check your inbox and spam folder.
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a reset link'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => switchMode('sign-in')}>
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useAuth } from '../components/auth/AuthProvider';
import { Emblem } from '../components/ui/Emblem';
import { SoffitGradient } from '../components/ui/SoffitGradient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

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

  const switchMode = (next: 'sign-in' | 'reset') => {
    setMode(next);
    setError(null);
    setResetSentTo(null);
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your email address.');
      return;
    }
    if (!online) {
      setError('You are offline. Sending a reset link needs an internet connection.');
      return;
    }
    setBusy(true);
    const failure = await requestPasswordReset(parsed.data.email);
    setError(failure);
    setResetSentTo(failure ? null : parsed.data.email);
    setBusy(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your details.');
      return;
    }
    if (!online) {
      setError('You are offline. Signing in needs an internet connection.');
      return;
    }
    setBusy(true);
    setError(await signIn(parsed.data.email, parsed.data.password));
    setBusy(false);
  };

  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden p-4">
      <SoffitGradient className="-z-10" />
      <div className="card w-full max-w-sm animate-fade-up gap-0 p-0 shadow-2xl shadow-black/40">
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
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
              Email
              <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
              Password
              <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {error && (
              <p role="alert" className="rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose">
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
              <p role="alert" className="rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose">
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

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

export function SignInPage() {
  const { signIn } = useAuth();
  const online = useOnlineStatus();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
          <p className="text-center text-xs text-muted">Staff accounts are created by the PHILRADS administrator.</p>
        </form>
      </div>
    </main>
  );
}

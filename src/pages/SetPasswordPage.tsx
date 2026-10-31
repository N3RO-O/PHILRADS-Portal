import { useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useAuth } from '../components/auth/AuthProvider';
import { Emblem } from '../components/ui/Emblem';
import { PasswordField } from '../components/ui/PasswordField';
import { SoffitGradient } from '../components/ui/SoffitGradient';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { shake } from '../lib/motion';

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'The two passwords do not match.' });

/** Shown after someone opens an invite or password-reset email: they choose the password they will sign in with. */
export function SetPasswordPage() {
  const { state, setPassword, signOut } = useAuth();
  const online = useOnlineStatus();
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const card = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);

  /** Something is wrong: the card shakes, then the message appears. */
  const fail = (message: string) => {
    setError(message);
    setAttempt((n) => n + 1);
    shake(card.current);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      fail(parsed.error.issues[0]?.message ?? 'Check your password.');
      return;
    }
    if (!online) {
      fail('You are offline. Saving a password needs an internet connection.');
      return;
    }
    setBusy(true);
    const failure = await setPassword(parsed.data.password);
    setBusy(false);
    if (failure) fail(failure);
    else setError(null);
  };

  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden p-4">
      <SoffitGradient className="-z-10" />
      <div ref={card} className="card w-full max-w-sm animate-fade-up gap-0 p-0 shadow-2xl shadow-black/40">
        <div className="flex flex-col items-center gap-3 rounded-t-2xl border-b border-line/70 px-6 py-8 text-center">
          <Emblem className="h-16 w-16" />
          <div>
            <p className="font-display text-2xl tracking-wide">PHILRADS</p>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Staff Portal</p>
          </div>
        </div>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-6">
          <div>
            <h1 className="text-lg font-bold">Choose your password</h1>
            {email && <p className="mt-1 text-sm text-muted">You will use it with {email} to sign in.</p>}
          </div>
          {/* Lets password managers save the new password against the right account. */}
          {email && <input type="email" autoComplete="username" value={email} readOnly hidden />}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password" className="text-sm font-medium text-ink-soft">
              New password
            </label>
            <PasswordField id="new-password" autoComplete="new-password" value={password} onChange={(e) => setPasswordValue(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-password" className="text-sm font-medium text-ink-soft">
              Type it again
            </label>
            <PasswordField id="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && (
            <p key={attempt} role="alert" className="animate-fade-in rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose [animation-delay:380ms]">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => void signOut()}>
            Cancel and sign out
          </button>
        </form>
      </div>
    </main>
  );
}

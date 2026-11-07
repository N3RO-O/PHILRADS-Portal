import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { HandHeart, Eye } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '../components/auth/AuthProvider';
import { PrismMark } from '../components/ui/PrismMark';
import { PasswordField } from '../components/ui/PasswordField';
import { SignInBackground } from '../components/auth/SignInBackground';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { takeIdleSignOut } from '../lib/idle';
import { errorSound } from '../lib/errorSound';
import { shake } from '../lib/motion';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const resetSchema = schema.pick({ email: true });
const codeSchema = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email.');

export function SignInPage() {
  const { signIn, requestPasswordReset, sendCode, verifyCode } = useAuth();
  const online = useOnlineStatus();
  const [mode, setMode] = useState<'sign-in' | 'reset' | 'volunteer'>('sign-in');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
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
    errorSound.play();
  };

  const switchMode = (next: 'sign-in' | 'reset' | 'volunteer') => {
    setMode(next);
    setError(null);
    setResetSentTo(null);
    setCodeSentTo(null);
    setCode('');
  };

  /** Volunteers: first the email (a code is sent), then the code. */
  const submitVolunteer = async (e: FormEvent) => {
    e.preventDefault();
    if (!online) {
      fail('You are offline. Signing in needs an internet connection.');
      return;
    }
    if (!codeSentTo) {
      const parsed = resetSchema.safeParse({ email });
      if (!parsed.success) {
        fail(parsed.error.issues[0]?.message ?? 'Check your email address.');
        return;
      }
      setBusy(true);
      const failure = await sendCode(parsed.data.email);
      setBusy(false);
      if (failure) fail(failure);
      else {
        setError(null);
        setCodeSentTo(parsed.data.email);
      }
      return;
    }
    const parsed = codeSchema.safeParse(code);
    if (!parsed.success) {
      fail(parsed.error.issues[0]?.message ?? 'Check the code.');
      return;
    }
    setBusy(true);
    const failure = await verifyCode(codeSentTo, parsed.data);
    setBusy(false);
    if (failure) fail(failure);
    else setError(null);
  };

  const resend = async () => {
    if (!codeSentTo || busy) return;
    setBusy(true);
    const failure = await sendCode(codeSentTo);
    setBusy(false);
    if (failure) fail(failure);
    else setError(null);
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
      <div ref={card} className="floating w-full max-w-sm animate-fade-up overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center gap-3 rounded-t-2xl bg-burgundy-500 px-6 py-8 text-center text-cloud">
          <PrismMark className="h-16 w-16" tone="brand" />
          <div>
            <p className="font-display text-3xl tracking-[0.08em]">PRISM</p>
            <p className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-cloud/80">by PHILRADS</p>
          </div>
        </div>
        {mode === 'sign-in' ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-6">
            <h1 className="text-lg font-bold">Sign in</h1>
            {idleOut && !error && (
              <p role="status" className="rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-soft">
                You were signed out after 5 minutes without activity. Sign in again to continue.
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
            <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost min-h-11 px-3 text-sm" onClick={() => switchMode('volunteer')}>
                <HandHeart className="h-4 w-4" aria-hidden /> I’m a volunteer
              </button>
              <Link to="/guest" className="btn-ghost min-h-11 px-3 text-sm">
                <Eye className="h-4 w-4" aria-hidden /> Continue as guest
              </Link>
            </div>
            <p className="text-center text-xs text-muted">Staff and volunteer accounts are created by the PHILRADS administrator.</p>
          </form>
        ) : mode === 'volunteer' ? (
          <form onSubmit={submitVolunteer} noValidate className="flex flex-col gap-4 p-6">
            <div>
              <h1 className="text-lg font-bold">Volunteer sign-in</h1>
              <p className="mt-1 text-sm text-muted">
                {codeSentTo ? `We sent a 6-digit code to ${codeSentTo}. It works for one hour.` : 'No password needed. We’ll email you a 6-digit code.'}
              </p>
            </div>
            {codeSentTo ? (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
                Code from the email
                <input
                  className="field text-center font-mono text-2xl tracking-[0.5em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  aria-invalid={Boolean(error) || undefined}
                  autoFocus
                  required
                />
              </label>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
                Email
                <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
              </label>
            )}
            {error && (
              <p key={attempt} role="alert" className="animate-fade-in rounded-xl border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-rose [animation-delay:380ms]">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? (codeSentTo ? 'Signing in…' : 'Sending…') : codeSentTo ? 'Sign in' : 'Email me a code'}
            </button>
            {codeSentTo && (
              <button type="button" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => void resend()} disabled={busy}>
                Send a new code
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={() => switchMode('sign-in')}>
              Back to staff sign-in
            </button>
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

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, Eye, HandHeart, Volume2, VolumeX, type LucideIcon } from 'lucide-react';
import { launchSound, useLaunchSound } from '../lib/launchSound';
import { z } from 'zod';
import { useAuth } from '../components/auth/AuthProvider';
import { CodeInput, haptic, type CodeInputHandle, type CodeState } from '../components/auth/CodeInput';
import { PrismHero } from '../components/auth/PrismHero';
import { BusyLabel } from '../components/ui/BusyLabel';
import { FloatField } from '../components/auth/FloatField';
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

const emailProblem = (v: string) =>
  !v.trim() ? 'Enter your email address.' : schema.shape.email.safeParse(v).success ? null : 'Check the email address for typos.';
const passwordProblem = (v: string) => (v ? null : 'Enter your password.');
const FIELDS = [
  { id: 'sign-in-email', label: 'Email', problem: emailProblem },
  { id: 'sign-in-password', label: 'Password', problem: passwordProblem },
] as const;

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
  // Code boxes: checking, rejected (red, shakes) or accepted (green). Cleared when the code changes.
  const [codeState, setCodeState] = useState<CodeState>('idle');
  const codeBox = useRef<CodeInputHandle>(null);
  // Signed in: a moment of green before the portal takes over the screen.
  const [signedIn, setSignedIn] = useState(false);
  const [idleOut] = useState(takeIdleSignOut);
  const card = useRef<HTMLDivElement>(null);
  // Counts failed tries, so the same message still shakes and fades in again.
  const [attempt, setAttempt] = useState(0);
  // Bumped on each submit with something missing: the fields show their messages then, not while typing.
  const [reveal, setReveal] = useState(0);

  /** Before sending: anything missing or mistyped is shown on its field, and the first one gets focus. */
  const checkFields = (ids: string[], values: Record<string, string>) => {
    const wrong = FIELDS.filter((f) => ids.includes(f.id) && f.problem(values[f.id]));
    if (!wrong.length) return true;
    setError(null);
    setReveal((n) => n + 1);
    document.getElementById(wrong[0].id)?.focus();
    return false;
  };
  /** Typing again: the old server message goes. */
  const typed = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
  };

  /** Something is wrong: the card shakes, then the message appears. */
  const fail = (message: string, shakeCard = true) => {
    setError(message);
    setAttempt((n) => n + 1);
    // The code boxes shake on their own; the card stays put then.
    if (shakeCard) shake(card.current);
    errorSound.play();
  };

  const switchMode = (next: 'sign-in' | 'reset' | 'volunteer') => {
    setMode(next);
    setError(null);
    setResetSentTo(null);
    setCodeSentTo(null);
    setCode('');
    setCodeState('idle');
    setReveal(0);
  };

  /** Signed in: a short "yes" the hand can feel, while the portal opens. */
  const succeed = () => {
    setError(null);
    setSignedIn(true);
    haptic([18, 50, 28]);
  };

  /** Check a full code (typed, pasted, suggested by the keyboard, or sent with the button). */
  const checkCode = async (value: string) => {
    if (!codeSentTo || busy) return;
    if (!online) {
      fail('You are offline. Signing in needs an internet connection.');
      return;
    }
    const parsed = codeSchema.safeParse(value);
    if (!parsed.success) {
      setCodeState('error');
      fail(parsed.error.issues[0]?.message ?? 'Check the code.', false);
      return;
    }
    setBusy(true);
    setCodeState('checking');
    const failure = await verifyCode(codeSentTo, parsed.data);
    setBusy(false);
    if (failure) {
      setCodeState('error');
      fail(failure, false);
      // After the shake: empty boxes, ready for the right code (the message stays until they type).
      setTimeout(() => {
        setCode('');
        setCodeState('idle');
        codeBox.current?.focus();
      }, 700);
    } else {
      setCodeState('success');
      succeed();
    }
  };

  /** Volunteers: first the email (a code is sent), then the code. */
  const submitVolunteer = async (e: FormEvent) => {
    e.preventDefault();
    if (!online) {
      fail('You are offline. Signing in needs an internet connection.');
      return;
    }
    if (!codeSentTo) {
      if (!checkFields(['sign-in-email'], { 'sign-in-email': email })) return;
      const parsed = resetSchema.safeParse({ email });
      if (!parsed.success) return;
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
    await checkCode(code);
  };

  const resend = async () => {
    if (!codeSentTo || busy) return;
    setBusy(true);
    const failure = await sendCode(codeSentTo);
    setBusy(false);
    if (failure) fail(failure);
    else {
      setError(null);
      setCode('');
      setCodeState('idle');
      codeBox.current?.focus();
    }
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!checkFields(['sign-in-email'], { 'sign-in-email': email })) return;
    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) return;
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
    if (!checkFields(['sign-in-email', 'sign-in-password'], { 'sign-in-email': email, 'sign-in-password': password })) return;
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return;
    if (!online) {
      fail('You are offline. Signing in needs an internet connection.');
      return;
    }
    setBusy(true);
    const failure = await signIn(parsed.data.email, parsed.data.password);
    setBusy(false);
    if (failure) fail(failure);
    else succeed();
  };

  // The PRISM theme, softly, while this screen is open.
  useEffect(() => {
    launchSound.start();
    return () => launchSound.stop();
  }, []);
  const music = useLaunchSound();
  const soundOff = music.muted;

  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden p-4">
      <SignInBackground />
      <div ref={card} className="floating relative w-full max-w-sm animate-fade-up overflow-hidden rounded-2xl bg-transparent">
        <PrismHero className="rounded-t-2xl" markOnly />
        <button
          type="button"
          data-launch-toggle
          className={`tap absolute right-2 top-2 z-10 flex h-11 items-center gap-1.5 rounded-full text-cloud/75 transition-colors hover:bg-white/10 hover:text-cloud ${
            music.state === 'waiting' ? 'launch-hint bg-white/10 pl-3 pr-2.5 text-cloud' : 'w-11 justify-center'
          }`}
          onClick={() => launchSound.toggle()}
          aria-pressed={music.state === 'playing'}
          aria-label={music.state === 'waiting' ? 'Play the PRISM theme' : soundOff ? 'Play the PRISM theme' : 'Turn off the PRISM theme'}
          title={soundOff ? 'Music off' : 'Music on'}
        >
          {music.state === 'waiting' && <span className="text-[0.6875rem] font-semibold">Tap for music</span>}
          {soundOff ? <VolumeX className="h-[1.125rem] w-[1.125rem]" aria-hidden /> : <Volume2 className="h-[1.125rem] w-[1.125rem]" aria-hidden />}
        </button>
        <div className="bg-surface-raised">
        {mode === 'sign-in' ? (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-6">
            <h1 className="text-lg font-bold">Sign in</h1>
            {idleOut && !error && (
              <p role="status" className="rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-soft">
                You were signed out after 5 minutes without activity. Sign in again to continue.
              </p>
            )}
            <div className="flex flex-col gap-1">
              <EmailField value={email} onChange={typed(setEmail)} reveal={reveal} />
              <FloatField
                id="sign-in-password"
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={typed(setPassword)}
                validate={passwordProblem}
                reveal={reveal}
                required
              />
            </div>
            <ServerMessage error={error} attempt={attempt} />
            <SubmitButton busy={busy} done={signedIn} busyText="Signing in…">
              Sign in
            </SubmitButton>
            <button type="button" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => switchMode('reset')}>
              Forgot your password?
            </button>
            <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DoorTile as="button" icon={HandHeart} title="Volunteer" note="Email code" onClick={() => switchMode('volunteer')} />
              <DoorTile as="link" icon={Eye} title="Guest" note="Look around" to="/guest" />
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
              <CodeInput
                ref={codeBox}
                label="Code from the email"
                value={code}
                onChange={(next) => {
                  setCode(next);
                  // Typing again after a wrong code: the red and the message go.
                  if (codeState === 'error') setCodeState('idle');
                  if (error) setError(null);
                }}
                onComplete={(full) => void checkCode(full)}
                state={codeState}
                disabled={signedIn}
                autoFocus
              />
            ) : (
              <EmailField value={email} onChange={typed(setEmail)} reveal={reveal} autoFocus />
            )}
            <ServerMessage error={error} attempt={attempt} />
            <SubmitButton busy={busy} done={signedIn} busyText={codeSentTo ? 'Checking the code…' : 'Sending the code…'}>
              {codeSentTo ? 'Sign in' : 'Email me a code'}
            </SubmitButton>
            {codeSentTo && (
              <button type="button" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => void resend()} disabled={busy || signedIn}>
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
            <EmailField value={email} onChange={typed(setEmail)} reveal={reveal} />
            <ServerMessage error={error} attempt={attempt} />
            {resetSentTo && (
              <p role="status" className="rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-soft">
                If {resetSentTo} has a staff account, a reset link is on its way. Check your inbox and spam folder.
              </p>
            )}
            <SubmitButton busy={busy} done={false} busyText="Sending the link…">
              Email me a reset link
            </SubmitButton>
            <button type="button" className="btn-ghost" onClick={() => switchMode('sign-in')}>
              Back to sign in
            </button>
          </form>
        )}
        </div>
      </div>
    </main>
  );
}

/** The email box all three forms share: praised (green check) as soon as it looks right. */
function EmailField({ value, onChange, reveal, autoFocus }: { value: string; onChange: (v: string) => void; reveal: number; autoFocus?: boolean }) {
  return (
    <FloatField
      id="sign-in-email"
      label="Email"
      type="email"
      inputMode="email"
      autoComplete="username"
      autoCapitalize="none"
      spellCheck={false}
      value={value}
      onChange={onChange}
      validate={emailProblem}
      reveal={reveal}
      praise
      autoFocus={autoFocus}
      required
    />
  );
}

/**
 * What the server said (wrong password, offline...): a note that floats at the top of the screen,
 * so the fields and the button never move. The next keystroke clears it.
 */
function ServerMessage({ error, attempt }: { error: string | null; attempt: number }) {
  const last = useRef(error);
  if (error) last.current = error;
  return (
    <div className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50 mx-auto max-w-sm">
      <p
        key={attempt}
        role={error ? 'alert' : undefined}
        className={`flex items-start gap-2 rounded-xl border border-rose/50 bg-surface-raised px-4 py-3 text-sm text-ink shadow-2xl shadow-black/60 ${
          error ? 'animate-pop-in' : 'invisible opacity-0 transition-opacity duration-200'
        }`}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose" aria-hidden />
        {last.current}
      </p>
    </div>
  );
}

/** The form's main button: the label turns into a spinner while it works (same width), then green with a check once signed in. */
function SubmitButton({ busy, done, busyText, children }: { busy: boolean; done: boolean; busyText: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={`btn-primary ${done ? 'sign-in-done' : ''}`}
      disabled={busy || done}
      aria-busy={busy || undefined}
    >
      {done ? (
        <>
          <Check className="sign-in-done-check h-5 w-5" strokeWidth={3} aria-hidden /> Signed in
        </>
      ) : (
        <BusyLabel busy={busy} busyText={busyText}>
          {children}
        </BusyLabel>
      )}
    </button>
  );
}

/** The volunteer and guest doors under the staff form: two even tiles, a title and what it does. */
function DoorTile(
  props: { icon: LucideIcon; title: string; note: string } & ({ as: 'button'; onClick: () => void } | { as: 'link'; to: string }),
) {
  const { icon: Icon, title, note } = props;
  const className =
    'tap flex min-h-14 items-center gap-2 rounded-xl border border-line/80 bg-surface-sunken/60 px-2.5 py-2.5 text-left transition-colors hover:border-ink-mute hover:bg-surface-sunken';
  const body = (
    <>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-burgundy-500/20 text-ink-soft">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-[0.6875rem] text-muted">{note}</span>
      </span>
    </>
  );
  return props.as === 'link' ? (
    <Link to={props.to} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" className={className} onClick={props.onClick}>
      {body}
    </button>
  );
}

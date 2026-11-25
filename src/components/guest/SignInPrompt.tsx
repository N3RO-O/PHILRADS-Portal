import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Lock, LogIn } from 'lucide-react';
import { z } from 'zod';
import { useGuestAccount } from '../../services/guest/account';
import { CodeInput, type CodeInputHandle, type CodeState } from '../auth/CodeInput';
import { FloatField } from '../auth/FloatField';
import { BusyLabel } from '../ui/BusyLabel';
import { Dialog } from '../ui/Dialog';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

const emailSchema = z.string().trim().email();
const emailProblem = (v: string) => (!v.trim() ? 'Enter your email address.' : emailSchema.safeParse(v).success ? null : 'Check the email address for typos.');
const OFFLINE = 'You are offline. Signing in needs an internet connection.';

/**
 * Guest sign-in, as volunteers sign in to the portal: an email, then the 6-digit code sent to it
 * (it checks itself when the last digit is in). The email's link signs in too.
 */
function EmailCodeForm({ open }: { open: boolean }) {
  const { sendCode, verifyCode } = useGuestAccount();
  const online = useOnlineStatus();
  const id = useId();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeState, setCodeState] = useState<CodeState>('idle');
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const codeBox = useRef<CodeInputHandle>(null);

  // Closed: start again from the email next time.
  useEffect(() => {
    if (open) return;
    setSentTo(null);
    setCode('');
    setCodeState('idle');
    setError(null);
    setBusy(false);
  }, [open]);

  const send = async (to: string) => {
    if (!online) return setError(OFFLINE);
    setBusy(true);
    const problem = await sendCode(to);
    setBusy(false);
    if (problem) return setError(problem);
    setError(null);
    setCode('');
    setCodeState('idle');
    setSentTo(to);
    codeBox.current?.focus();
  };

  const check = async (value: string) => {
    if (!sentTo || busy) return;
    if (!online) return setError(OFFLINE);
    if (!/^\d{6}$/.test(value.trim())) {
      setCodeState('error');
      return setError('Enter the 6-digit code from the email.');
    }
    setBusy(true);
    setCodeState('checking');
    const problem = await verifyCode(sentTo, value.trim());
    setBusy(false);
    if (!problem) return setCodeState('success'); // signed in: the sheet closes itself
    setCodeState('error');
    setError(problem);
    // After the shake: empty boxes, ready for the right code (the message stays until they type).
    setTimeout(() => {
      setCode('');
      setCodeState('idle');
      codeBox.current?.focus();
    }, 700);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (sentTo) return void check(code);
    setReveal((r) => r + 1);
    if (emailProblem(email)) return;
    void send(email.trim());
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">
        {sentTo ? (
          <>
            We sent a 6-digit code to <span className="font-semibold text-ink">{sentTo}</span>. Enter it here, or tap the link in the email.
          </>
        ) : (
          'No password needed. We’ll email you a 6-digit code. New here? This makes your free guest account.'
        )}
      </p>
      {sentTo ? (
        <CodeInput
          ref={codeBox}
          label="Code from the email"
          value={code}
          onChange={(next) => {
            setCode(next);
            if (codeState === 'error') setCodeState('idle');
            if (error) setError(null);
          }}
          onComplete={(full) => void check(full)}
          state={codeState}
          autoFocus
        />
      ) : (
        <FloatField
          id={`${id}-email`}
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (error) setError(null);
          }}
          validate={emailProblem}
          reveal={reveal}
          praise
          data-autofocus
          required
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-status-out">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={busy || codeState === 'success'} aria-busy={busy || undefined}>
        <BusyLabel busy={busy} busyText={sentTo ? 'Checking the code…' : 'Sending the code…'}>
          {sentTo ? 'Sign in' : 'Email me a code'}
        </BusyLabel>
      </button>
      {sentTo && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <button type="button" className="text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setSentTo(null)} disabled={busy}>
            Use another email
          </button>
          <button type="button" className="text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => void send(sentTo)} disabled={busy}>
            Send a new code
          </button>
        </div>
      )}
    </form>
  );
}

/** "Sign in": opens the email-code sheet. `pill` is the small header button. */
export function SignInButton({ label = 'Sign in', className = '', variant = 'primary' }: { label?: string; className?: string; variant?: 'primary' | 'pill' }) {
  const { status } = useGuestAccount();
  const [open, setOpen] = useState(false);
  // Signed in (with the code, or the email's link in another tab): the sheet has done its job.
  useEffect(() => {
    if (status === 'in') setOpen(false);
  }, [status]);
  return (
    <>
      {variant === 'pill' ? (
        <button type="button" className={`tap group grid place-items-center ${className}`} onClick={() => setOpen(true)}>
          <span className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-3 text-xs font-semibold text-ink-soft transition-colors group-hover:border-ink-mute group-hover:text-ink">
            <LogIn className="h-4 w-4" aria-hidden /> {label}
          </span>
        </button>
      ) : (
        <button type="button" className={`btn-primary ${className}`} onClick={() => setOpen(true)}>
          <LogIn className="h-[1.125rem] w-[1.125rem]" aria-hidden /> {label}
        </button>
      )}
      <Dialog open={open} title="Sign in" onClose={() => setOpen(false)}>
        <EmailCodeForm open={open} />
      </Dialog>
    </>
  );
}

/** Where something is for signed-in guests: what they get, and the one button. */
export function SignInPrompt({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-line bg-surface-sunken ${compact ? 'p-4' : 'p-5 sm:flex-row sm:items-center sm:gap-5'}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-ink-soft" aria-hidden>
        <Lock className="h-[1.125rem] w-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-ink-soft">{body}</p>
      </div>
      <SignInButton className="shrink-0" />
    </div>
  );
}

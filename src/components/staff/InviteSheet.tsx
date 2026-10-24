import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Loader2, MailPlus } from 'lucide-react';
import { z } from 'zod';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { STAFF_ROLES, StaffRuleError, type StaffInvite, type StaffMember, type StaffRoleKey } from '../../services/staff/types';
import { Sheet } from '../ui/Sheet';

const emailSchema = z.string().trim().email();

interface Props {
  open: boolean;
  existing: StaffMember[];
  onClose: () => void;
  onInvite: (invite: StaffInvite) => Promise<void>;
  onDone: (message: string) => void;
}

/** Invite someone to the portal: they get an email with a link to choose their password. */
export function InviteSheet({ open, existing, onClose, onInvite, onDone }: Props) {
  const uid = useId();
  const online = useOnlineStatus();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [roleKey, setRoleKey] = useState<StaffRoleKey>('staff');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setFullName('');
    setRoleKey('staff');
    setAttempted(false);
    setServerError(null);
  }, [open]);

  const address = email.trim().toLowerCase();
  const already = existing.find((m) => m.email.toLowerCase() === address);
  const emailError = !attempted
    ? undefined
    : !emailSchema.safeParse(address).success
      ? 'Enter a valid email address, like name@philrads.org.'
      : already && !already.invitePending
        ? `${already.name} already has an account. Change their role in the list instead.`
        : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setAttempted(true);
    setServerError(null);
    if (!emailSchema.safeParse(address).success || (already && !already.invitePending)) {
      requestAnimationFrame(() => emailRef.current?.focus());
      return;
    }
    setBusy(true);
    try {
      await onInvite({ email: address, fullName: fullName.trim(), roleKey });
      onDone(already ? `Sent the invitation to ${address} again.` : `Invitation sent to ${address}.`);
      onClose();
    } catch (err) {
      setServerError(err instanceof StaffRuleError ? err.message : 'Could not reach the server. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Invite someone"
      subtitle="They get an email with a link to choose their password. Their account is ready as soon as they do."
      footer={
        <button type="submit" form={`${uid}-form`} className="btn-primary h-12 w-full text-base" disabled={busy || !online}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <MailPlus className="h-5 w-5" aria-hidden />}
          {!online ? 'Connect to invite' : busy ? 'Sending…' : 'Send invitation'}
        </button>
      }
    >
      <form id={`${uid}-form`} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
        {serverError && (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
            <strong className="font-semibold text-status-out">Not sent.</strong> {serverError}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-email`} className="text-sm font-semibold text-ink-soft">
            Email address
          </label>
          <input
            ref={emailRef}
            id={`${uid}-email`}
            className="field"
            type="email"
            inputMode="email"
            autoComplete="off"
            data-autofocus
            placeholder="name@philrads.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? `${uid}-email-err` : undefined}
          />
          {emailError && (
            <p id={`${uid}-email-err`} role="alert" className="text-xs font-medium text-status-out">
              {emailError}
            </p>
          )}
          {!emailError && already?.invitePending && (
            <p className="text-xs text-muted">{already.name} was invited before but hasn’t accepted yet. This sends the email again.</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={`${uid}-name`} className="text-sm font-semibold text-ink-soft">
              Full name
            </label>
            <span className="text-xs text-muted">Optional</span>
          </div>
          <input id={`${uid}-name`} className="field" autoComplete="off" maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink-soft">What can they do?</legend>
          {STAFF_ROLES.map((r) => (
            <label
              key={r.key}
              className={`tap flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                roleKey === r.key ? 'border-uplift bg-uplift/10' : 'border-line/70 hover:border-ink-mute'
              }`}
            >
              <input type="radio" name={`${uid}-role`} className="mt-0.5 h-4 w-4 accent-uplift" checked={roleKey === r.key} onChange={() => setRoleKey(r.key)} />
              <span>
                <span className="block text-sm font-semibold">{r.label}</span>
                <span className="block text-xs text-muted">{r.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </form>
    </Sheet>
  );
}

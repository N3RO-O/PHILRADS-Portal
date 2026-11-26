import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Star } from 'lucide-react';
import { guestService } from '../../services';
import { GuestRuleError, MESSAGE_MAX, type MessageKind } from '../../services/guest/guestService';
import { BusyLabel } from '../ui/BusyLabel';
import { SuccessTick } from '../ui/SuccessTick';
import { GuestSection } from './guestUi';

/** What a guest can write about, each with the prompt that helps them say it. */
const KINDS: { key: Exclude<MessageKind, 'order'>; label: string; prompt: string }[] = [
  { key: 'thanks', label: 'Say thanks', prompt: 'What did PHILRADS do that helped?' },
  { key: 'need', label: 'A need in my community', prompt: 'What does your community need, and how many families are affected?' },
  { key: 'suggestion', label: 'An idea', prompt: 'What could we do better, or differently?' },
  { key: 'concern', label: 'A concern', prompt: 'What happened? Tell us as much as you are comfortable sharing.' },
  { key: 'volunteer', label: 'I want to volunteer', prompt: 'What would you like to help with, and when are you free?' },
];
const STARS = [1, 2, 3, 4, 5] as const;
const STAR_WORDS = ['', 'Poor', 'Could be better', 'Okay', 'Good', 'Very good'];

export type FeedbackKind = Exclude<MessageKind, 'order'>;
export const isFeedbackKind = (k: string | null): k is FeedbackKind => KINDS.some((x) => x.key === k);

/**
 * Feedback: thanks, needs, ideas, concerns and offers to volunteer. Names are optional, so concerns
 * can be raised anonymously; only coordinators and administrators read what is sent.
 * (Community feedback practice: CHS commitment 5, UNHCR AAP guidance.)
 */
export function FeedbackSection({ initialKind }: { initialKind?: FeedbackKind }) {
  const [kind, setKind] = useState<FeedbackKind>(initialKind ?? 'thanks');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [community, setCommunity] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const text = useRef<HTMLTextAreaElement>(null);
  const meta = KINDS.find((k) => k.key === kind)!;
  const needsContact = kind === 'volunteer';
  const rates = kind === 'thanks' || kind === 'suggestion';

  // Opened from the Volunteer button: straight to the message box.
  useEffect(() => {
    if (initialKind) text.current?.focus({ preventScroll: true });
  }, [initialKind]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await guestService.send({ kind, message, rating: rates ? rating : null, community, name, contact });
      setSent(
        kind === 'volunteer'
          ? `Thank you${name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''}. Our volunteer coordinator will reach you at ${contact.trim()}.`
          : contact.trim()
            ? `Thank you. Your message is with the PHILRADS team, and they may reply at ${contact.trim()}.`
            : 'Thank you. Your message is with the PHILRADS team.',
      );
      setMessage('');
      setRating(null);
    } catch (err) {
      setError(err instanceof GuestRuleError ? err.message : 'Your message could not be sent. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GuestSection id="feedback" title="Feedback" lead="Thanks, needs or offers to help. Your name is optional.">
      {sent ? (
        <div role="status" className="flex flex-col items-start gap-3 rounded-2xl bg-surface-sunken p-5">
          <SuccessTick className="h-10 w-10" />
          <p className="text-sm text-ink">{sent}</p>
          <button type="button" className="chip" onClick={() => setSent(null)}>
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex max-w-xl flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">What is it about?</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What is it about?">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.key}
                  aria-pressed={kind === k.key}
                  className="chip"
                  onClick={() => {
                    setKind(k.key);
                    setError(null);
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </fieldset>

          {rates && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-ink">How did we do? (optional)</legend>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
                {STARS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} of 5: ${STAR_WORDS[n]}`}
                    className="tap grid h-10 w-10 place-items-center rounded-lg hover:bg-surface-sunken"
                    onClick={() => setRating(rating === n ? null : n)}
                  >
                    <Star className={`h-6 w-6 transition-colors ${rating !== null && n <= rating ? 'fill-uplift text-uplift' : 'text-ink-mute'}`} aria-hidden />
                  </button>
                ))}
                <span className="ml-2 text-sm text-muted" aria-live="polite">
                  {rating ? STAR_WORDS[rating] : ''}
                </span>
              </div>
            </fieldset>
          )}

          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Your message
            <textarea
              ref={text}
              className="field min-h-32 font-normal leading-relaxed"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (error) setError(null);
              }}
              placeholder={meta.prompt}
              maxLength={MESSAGE_MAX}
              required
            />
            {message.length > MESSAGE_MAX - 200 && <span className="text-xs font-normal text-muted">{MESSAGE_MAX - message.length} characters left</span>}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Your community (optional)
              <input className="field font-normal" value={community} onChange={(e) => setCommunity(e.target.value)} placeholder="Barangay, town or city" maxLength={120} autoComplete="address-level2" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Your name (optional)
              <input className="field font-normal" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Phone or email{needsContact ? '' : ' (optional)'}
            <input
              className="field font-normal"
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                if (error) setError(null);
              }}
              maxLength={120}
              autoComplete="email"
              required={needsContact}
              aria-describedby="feedback-contact-note"
            />
            <span id="feedback-contact-note" className="text-xs font-normal text-muted">
              {needsContact ? 'So our volunteer coordinator can reach you.' : 'Only if you would like a reply.'}
            </span>
          </label>

          {kind === 'concern' && (
            <p className="rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-soft">
              If someone is in danger right now, call 911. You can leave your name and contact out: the message still reaches us.
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-status-out">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              <BusyLabel busy={busy} busyText="Sending…">
                Send message
              </BusyLabel>
            </button>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              <span>
                Only PHILRADS coordinators and administrators read messages. Nothing is posted publicly.{' '}
                <Link to="/guest/privacy" className="font-semibold text-ink-soft underline underline-offset-2 hover:text-ink">
                  Privacy
                </Link>
              </span>
            </p>
          </div>
        </form>
      )}
    </GuestSection>
  );
}

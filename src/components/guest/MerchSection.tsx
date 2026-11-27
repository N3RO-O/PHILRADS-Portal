import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { HandCoins, Mail, Minus, Plus, Shirt, UserRound } from 'lucide-react';
import { guestService } from '../../services';
import { GuestRuleError, peso, type DonationDrive, type MerchItem } from '../../services/guest/guestService';
import { useGuestAccount } from '../../services/guest/account';
import type { AsyncState } from '../../hooks/useAsyncData';
import { BusyLabel } from '../ui/BusyLabel';
import { Sheet } from '../ui/Sheet';
import { SuccessTick } from '../ui/SuccessTick';
import { SignInPrompt } from './SignInPrompt';
import { GuestSection, Picture, RowsLoading, SectionError } from './guestUi';

/** None left, or switched off by the team. */
export const soldOut = (m: MerchItem) => !m.inStock || m.stockLeft === 0;

/** "Only 3 left" when it's nearly gone, "12 left" otherwise; nothing when the team doesn't count. */
export const leftText = (m: MerchItem) => (m.stockLeft == null || soldOut(m) ? null : m.stockLeft <= 5 ? `Only ${m.stockLeft} left` : `${m.stockLeft} left`);

/** The fundraiser an item supports, when that fundraiser is shown on the guest page. */
export const causeOf = (m: MerchItem, drives: DonationDrive[]) => (m.driveId ? drives.find((d) => d.id === m.driveId) ?? null : null);

/**
 * Ask to order: no payment here; the team replies to arrange payment and pick-up or delivery.
 * Ordering needs a sign-in, and the order goes out with the account's own name and email.
 */
export function OrderSheet({ item, cause, onClose }: { item: MerchItem | null; cause: DonationDrive | null; onClose: () => void }) {
  const { status, orderAs } = useGuestAccount();
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const most = Math.min(20, item?.stockLeft ?? 20);
  const close = () => {
    onClose();
    setTimeout(() => {
      setSize('');
      setQty(1);
      setNote('');
      setError(null);
      setSent(false);
    }, 320);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item || !orderAs) return;
    if (item.sizes.length && !size) return setError('Choose a size.');
    setBusy(true);
    setError(null);
    try {
      await guestService.send({
        kind: 'order',
        merchId: item.id,
        merchSize: size || undefined,
        quantity: Math.min(qty, most),
        // The server takes these from the account; sent too for sample mode.
        name: orderAs.name,
        contact: orderAs.email ?? '',
        message: note.trim() || 'No note.',
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof GuestRuleError ? err.message : 'Your request could not be sent. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  const share = cause && item?.driveShare ? item.driveShare * Math.min(qty, most) : 0;
  return (
    <Sheet
      open={!!item}
      onClose={close}
      title={sent ? 'Request sent' : `Order ${item?.name ?? ''}`}
      subtitle={!sent && item?.price !== null && item ? `${peso(item.price ?? 0)} each. You pay when the team confirms your order.` : undefined}
      dirty={!sent && !!note}
      footer={
        sent ? (
          <button type="button" className="btn-ghost w-full" onClick={close}>
            Close
          </button>
        ) : orderAs ? (
          <div className="flex flex-col gap-2">
            {error && (
              <p role="alert" className="text-sm text-status-out">
                {error}
              </p>
            )}
            <button type="submit" form="merch-order" className="btn-primary w-full" disabled={busy}>
              <BusyLabel busy={busy} busyText="Sending…">
                Send order request
              </BusyLabel>
            </button>
          </div>
        ) : undefined
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <SuccessTick className="h-12 w-12" />
          <p className="max-w-xs text-sm text-ink-soft">
            The PHILRADS team will email {orderAs?.email ?? 'you'} to confirm your order, payment and pick-up or delivery.
            {share > 0 && cause ? ` Once you’ve paid, ${peso(share)} goes to ${cause.title}.` : ''}
          </p>
        </div>
      ) : status === 'loading' ? (
        <RowsLoading rows={2} />
      ) : !orderAs ? (
        <SignInPrompt compact title="Sign in to order" body="It’s free. We’ll email you a code, and fill in your name and email for the order." />
      ) : (
        item && (
          <form id="merch-order" onSubmit={submit} noValidate className="flex flex-col gap-4">
            {cause && item.driveShare ? (
              <p className="flex items-start gap-2 rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink">
                <HandCoins className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
                <span>
                  {peso(item.driveShare)} of each goes to <span className="font-semibold">{cause.title}</span>.
                </span>
              </p>
            ) : null}
            {item.sizes.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink">Size</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
                  {item.sizes.map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={size === s} aria-pressed={size === s} className="chip min-w-12 justify-center" onClick={() => (setSize(s), setError(null))}>
                      {s}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <div>
              <span className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink" id="qty-label">
                How many
                {leftText(item) && <span className="text-xs font-normal text-muted">{leftText(item)}</span>}
              </span>
              <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface-sunken p-1" role="group" aria-labelledby="qty-label">
                <button type="button" className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One fewer" disabled={qty <= 1}>
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span className="w-10 text-center text-base font-semibold tabular-nums" aria-live="polite">
                  {Math.min(qty, most)}
                </span>
                <button type="button" className="icon-btn" onClick={() => setQty((q) => Math.min(most, q + 1))} aria-label="One more" disabled={qty >= most}>
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl border border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Ordering as</p>
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <UserRound className="h-4 w-4 shrink-0" aria-hidden /> {orderAs.name}
              </p>
              <p className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
                <Mail className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{orderAs.email ?? 'Your account’s email'}</span>
              </p>
              <p className="text-xs text-muted">
                From your account. The team replies to this email; only PHILRADS staff see it.{' '}
                <Link to="/guest/privacy" className="font-semibold underline underline-offset-2 hover:text-ink">
                  Privacy
                </Link>
              </p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              Anything else (optional)
              <textarea className="field min-h-20 font-normal" value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="Phone number, delivery town, colour, a date you need it by…" />
            </label>
          </form>
        )
      )}
    </Sheet>
  );
}

/** One item: its picture, price, what's left, the cause it supports and the Order button. */
export function MerchCard({ m, cause, onOrder, showCause = true }: { m: MerchItem; cause: DonationDrive | null; onOrder: () => void; showCause?: boolean }) {
  const left = leftText(m);
  return (
    <li className="flex flex-col">
      <Picture src={m.imageUrl} alt={m.name} icon={Shirt} className="aspect-square w-full rounded-2xl" />
      <h3 className="mt-3 font-semibold leading-snug text-ink">{m.name}</h3>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm tabular-nums text-ink-soft">
        {m.price !== null ? peso(m.price) : 'Ask for the price'}
        {left && <span className={`text-xs font-semibold ${m.stockLeft != null && m.stockLeft <= 5 ? 'text-uplift' : 'text-muted'}`}>{left}</span>}
      </p>
      {m.sizes.length > 0 && <p className="text-xs text-muted">Sizes {m.sizes.join(', ')}</p>}
      {showCause && cause && m.driveShare ? (
        <Link to={`/guest/give?drive=${cause.id}`} className="mt-1.5 inline-flex items-start gap-1.5 text-xs font-semibold text-uplift hover:underline">
          <HandCoins className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {peso(m.driveShare)} of each goes to {cause.title}
          </span>
        </Link>
      ) : null}
      {m.description && <p className="mt-1 line-clamp-3 text-xs text-muted">{m.description}</p>}
      <div className="mt-auto pt-3">
        {soldOut(m) ? (
          <p className="flex min-h-8 items-center justify-center rounded-lg bg-surface-sunken text-xs font-semibold text-muted">Out of stock</p>
        ) : (
          <button type="button" className="chip w-full justify-center" onClick={onOrder}>
            Order
          </button>
        )}
      </div>
    </li>
  );
}

/** Merch: PHILRADS items; each purchase supports the work. Orders are requests the team follows up. */
export function MerchSection({ merch, drives, onRetry }: { merch: AsyncState<MerchItem[]>; drives: DonationDrive[]; onRetry: () => void }) {
  const [ordering, setOrdering] = useState<MerchItem | null>(null);
  const list = merch.data ?? [];
  return (
    <GuestSection id="merch" title="Merch" lead="Every sale goes to relief work.">
      {merch.status === 'loading' ? (
        <RowsLoading rows={2} />
      ) : merch.status === 'error' ? (
        <SectionError message={merch.error.message} onRetry={onRetry} />
      ) : !list.length ? (
        <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink-soft">New merch is on its way. Check back soon.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 2xl:grid-cols-5">
          {list.map((m) => (
            <MerchCard key={m.id} m={m} cause={causeOf(m, drives)} onOrder={() => setOrdering(m)} />
          ))}
        </ul>
      )}
      <OrderSheet item={ordering} cause={ordering ? causeOf(ordering, drives) : null} onClose={() => setOrdering(null)} />
    </GuestSection>
  );
}

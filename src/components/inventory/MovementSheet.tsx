import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { CloudOff, Loader2, ScanLine, Sparkles } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  expiryStatus,
  fefo,
  findItemByCode,
  newClientId,
  reservedFromBatch,
  todayKey,
  validateMovement,
  type FieldErrors,
} from '../../lib/inventory';
import { formatNumber, formatShortDate } from '../../lib/format';
import type { RecordOutcome } from '../../services/inventory/inventoryStore';
import { ITEM_CATEGORIES, type InventorySnapshot, type Movement, type MovementDraft, type MovementType } from '../../services/inventory/types';
import { Sheet } from '../ui/Sheet';
import { MOVEMENT_META } from './Badges';
import { QuantityStepper } from './QuantityStepper';
import { ScannerSheet } from './ScannerSheet';

export interface MovementPreset {
  type?: MovementType;
  itemId?: string;
  locationId?: string;
  batchId?: string;
}

interface Props {
  open: boolean;
  preset: MovementPreset;
  snapshot: InventorySnapshot;
  /** Moves not yet in the ledger, so the same stock can't be promised twice. */
  pending: Movement[];
  canAdjust: boolean;
  onClose: () => void;
  onSubmit: (draft: MovementDraft) => Promise<{ outcome: RecordOutcome; error?: string }>;
  onDone: (message: string) => void;
}

const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const REFERENCE_LABEL: Record<MovementType, string> = {
  receipt: 'Source (donor, PO or delivery receipt no.)',
  release: 'Released to (recipient or DR/RIS no.)',
  transfer: 'Purpose or reference',
  adjustment: 'Reference (count sheet or write-off no.)',
};

export function MovementSheet({ open, preset, snapshot, pending, canAdjust, onClose, onSubmit, onDone }: Props) {
  const online = useOnlineStatus();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [clientId, setClientId] = useState(newClientId);
  const [type, setType] = useState<MovementType>('release');
  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState(localNow);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMiss, setScanMiss] = useState<string | null>(null);

  // A fresh form (and a fresh idempotency key) every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setClientId(newClientId());
    setType(preset.type ?? 'release');
    setItemId(preset.itemId ?? '');
    setLocationId(preset.locationId ?? '');
    setBatchId(preset.batchId ?? '');
    setToLocationId('');
    setLotNumber('');
    setExpiryDate('');
    setQuantity('');
    setReference('');
    setNotes('');
    setOccurredAt(localNow());
    setAttempted(false);
    setServerError(null);
    setScanMiss(null);
  }, [open, preset]);

  const item = snapshot.items.find((i) => i.id === itemId);
  const today = todayKey();
  const lots = useMemo(
    () =>
      snapshot.batches
        .filter((b) => b.itemId === itemId && b.locationId === locationId && b.quantity > 0)
        .sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999')),
    [snapshot.batches, itemId, locationId],
  );
  const suggested = fefo(lots, today)[0];

  // Default to the first-expiry-first-out lot whenever item or location changes.
  useEffect(() => {
    if (type === 'receipt') return;
    if (!lots.some((l) => l.id === batchId)) setBatchId(suggested?.id ?? '');
  }, [lots, suggested, batchId, type]);

  const batch = lots.find((b) => b.id === batchId);
  const available = batch ? batch.quantity - reservedFromBatch(batch.id, pending) : 0;

  const draft: MovementDraft = {
    clientId,
    type,
    itemId,
    locationId,
    toLocationId: type === 'transfer' ? toLocationId : null,
    batchId: type === 'receipt' ? null : batchId || null,
    lotNumber: type === 'receipt' ? lotNumber : null,
    expiryDate: type === 'receipt' ? expiryDate || null : null,
    quantity: quantity === '' || quantity === '-' ? Number.NaN : Number.parseInt(quantity, 10),
    reference,
    notes,
    occurredAt: occurredAt ? new Date(occurredAt).toISOString() : '',
  };
  const errors: FieldErrors = attempted ? validateMovement(draft, { ...snapshot, pending, canAdjust }) : {};

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setAttempted(true);
    setServerError(null);
    const found = validateMovement(draft, { ...snapshot, pending, canAdjust });
    if (Object.keys(found).length) {
      // Move focus to the first problem so it's announced and visible.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    const { outcome, error } = await onSubmit(draft);
    setSaving(false);
    if (outcome === 'failed') {
      setServerError(error ?? 'This could not be saved.');
      return;
    }
    const what = `${MOVEMENT_META[type].label} ${formatNumber(Math.abs(draft.quantity))} ${item?.unit ?? ''} of ${item?.name ?? 'item'}`;
    onDone(
      outcome === 'queued'
        ? `${what}: saved on this device. It will sync automatically when you’re back online.`
        : outcome === 'pending_approval'
          ? `Transfer requested: ${formatNumber(draft.quantity)} ${item?.unit ?? ''} of ${item?.name}. An approver will review it.`
          : `${what}. Saved.`,
    );
    onClose();
  };

  const onScanned = (code: string) => {
    setScanOpen(false);
    const found = findItemByCode(snapshot.items, code);
    if (found) {
      setItemId(found.id);
      setScanMiss(null);
    } else setScanMiss(`No item matches “${code}”.`);
  };

  const types: MovementType[] = canAdjust ? ['receipt', 'release', 'transfer', 'adjustment'] : ['receipt', 'release', 'transfer'];
  const field = (name: keyof FieldErrors) => ({
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${uid}-${String(name)}-err` : undefined,
  });
  const verb = MOVEMENT_META[type].verb;
  const qtyLabel = Number.isFinite(draft.quantity) && draft.quantity !== 0 ? `${formatNumber(Math.abs(draft.quantity))} ${item?.unit ?? ''}` : '';

  return (
    <>
      <Sheet
        open={open && !scanOpen}
        onClose={onClose}
        title="Log a stock movement"
        subtitle={type === 'transfer' && !canAdjust ? 'Transfers are applied once an approver confirms them.' : undefined}
        footer={
          <div className="flex flex-col gap-2">
            {!online && (
              <p className="flex items-center gap-2 text-xs text-sky-300">
                <CloudOff className="h-4 w-4 shrink-0" aria-hidden /> You’re offline. This will be kept on this device and synced automatically.
              </p>
            )}
            <button type="submit" form={`${uid}-form`} className="btn-primary h-12 w-full text-base" disabled={saving}>
              {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              {saving ? 'Saving…' : `${verb}${qtyLabel ? ` ${qtyLabel}` : ''}`}
            </button>
          </div>
        }
      >
        <form id={`${uid}-form`} ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-5">
          <fieldset>
            <legend className="sr-only">Movement type</legend>
            <div className={`grid gap-1 rounded-2xl bg-surface-sunken p-1 ${canAdjust ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {types.map((t) => {
                const M = MOVEMENT_META[t];
                return (
                  <label
                    key={t}
                    className="tap flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold text-ink-soft transition has-[:checked]:bg-surface-raised has-[:checked]:text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-uplift"
                  >
                    <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
                    <M.icon className={`h-4 w-4 ${M.cls}`} aria-hidden />
                    {M.verb}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {errors.form && <ErrorText id={`${uid}-form-err`}>{errors.form}</ErrorText>}
          {serverError && (
            <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm text-ink">
              <strong className="font-semibold text-status-out">Not saved.</strong> {serverError}
            </p>
          )}

          <Field id={`${uid}-item`} label="Item" error={errors.itemId} errorId={`${uid}-itemId-err`}>
            <div className="flex gap-2">
              <select id={`${uid}-item`} className="field" value={itemId} onChange={(e) => setItemId(e.target.value)} {...field('itemId')}>
                <option value="">Choose an item…</option>
                {ITEM_CATEGORIES.map((c) => {
                  const inCat = snapshot.items.filter((i) => i.category === c);
                  return inCat.length ? (
                    <optgroup key={c} label={c}>
                      {inCat.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} · {i.sku}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
              <button type="button" className="btn-ghost shrink-0 px-3" onClick={() => setScanOpen(true)} aria-label="Scan item barcode">
                <ScanLine className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {scanMiss && <p className="mt-1.5 text-xs text-status-low">{scanMiss}</p>}
          </Field>

          <Field id={`${uid}-loc`} label={type === 'receipt' ? 'Received at' : type === 'transfer' ? 'From' : 'Location'} error={errors.locationId} errorId={`${uid}-locationId-err`}>
            <LocationSelect id={`${uid}-loc`} value={locationId} onChange={setLocationId} snapshot={snapshot} {...field('locationId')} />
          </Field>

          {type === 'transfer' && (
            <Field id={`${uid}-to`} label="To" error={errors.toLocationId} errorId={`${uid}-toLocationId-err`}>
              <LocationSelect id={`${uid}-to`} value={toLocationId} onChange={setToLocationId} snapshot={snapshot} exclude={locationId} {...field('toLocationId')} />
            </Field>
          )}

          {type === 'receipt' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field id={`${uid}-lot`} label="Lot / batch no." hint="Optional" error={errors.lotNumber} errorId={`${uid}-lotNumber-err`}>
                <input id={`${uid}-lot`} className="field" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} autoCapitalize="characters" maxLength={40} {...field('lotNumber')} />
              </Field>
              <Field id={`${uid}-exp`} label="Expiry date" hint={item?.tracksExpiry ? 'Required' : 'If any'} error={errors.expiryDate} errorId={`${uid}-expiryDate-err`}>
                <input id={`${uid}-exp`} type="date" className="field" value={expiryDate} min={today} onChange={(e) => setExpiryDate(e.target.value)} {...field('expiryDate')} />
              </Field>
            </div>
          ) : (
            itemId &&
            locationId && (
              <Field id={`${uid}-batch`} label="Lot" error={errors.batchId} errorId={`${uid}-batchId-err`}>
                {lots.length === 0 ? (
                  <p className="tile px-4 py-3 text-sm text-muted" id={`${uid}-batch`}>
                    No stock of this item here.
                  </p>
                ) : (
                  <>
                    <select id={`${uid}-batch`} className="field" value={batchId} onChange={(e) => setBatchId(e.target.value)} {...field('batchId')}>
                      {lots.map((b) => {
                        const expired = expiryStatus(b.expiryDate, today) === 'expired';
                        return (
                          <option key={b.id} value={b.id} disabled={expired && type !== 'adjustment'}>
                            {b.lotNumber ?? 'No lot no.'} · {formatNumber(b.quantity)} left
                            {b.expiryDate ? ` · ${expired ? 'EXPIRED' : 'exp.'} ${formatShortDate(b.expiryDate)}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {suggested && batchId === suggested.id && suggested.expiryDate && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-status-expiring">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden /> First-expiry-first-out: this lot expires soonest.
                      </p>
                    )}
                  </>
                )}
              </Field>
            )
          )}

          <Field
            id={`${uid}-qty`}
            label={type === 'adjustment' ? 'Change (use − to remove)' : 'Quantity'}
            hint={batch && type !== 'receipt' ? `${formatNumber(available)} available` : undefined}
            error={errors.quantity}
          errorId={`${uid}-quantity-err`}
          >
            <QuantityStepper
              id={`${uid}-qty`}
              value={quantity}
              onChange={setQuantity}
              signed={type === 'adjustment'}
              max={type === 'release' || type === 'transfer' ? Math.max(available, 0) || undefined : undefined}
              unit={item?.unit}
              invalid={Boolean(errors.quantity)}
              describedBy={errors.quantity ? `${uid}-quantity-err` : undefined}
            />
          </Field>

          <Field id={`${uid}-ref`} label={REFERENCE_LABEL[type]} hint={type === 'release' ? 'Required' : 'Optional'} error={errors.reference} errorId={`${uid}-reference-err`}>
            <input id={`${uid}-ref`} className="field" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} {...field('reference')} />
          </Field>

          <Field id={`${uid}-notes`} label={type === 'adjustment' ? 'Reason' : 'Notes'} hint={type === 'adjustment' ? 'Required' : 'Optional'} error={errors.notes} errorId={`${uid}-notes-err`}>
            <textarea id={`${uid}-notes`} className="field min-h-20" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} {...field('notes')} />
          </Field>

          <details className="group rounded-xl border border-line/70 px-4 py-1" open={Boolean(errors.occurredAt)}>
            <summary className="tap flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink-soft">Happened earlier? Change the time</summary>
            <div className="pb-3">
              <Field id={`${uid}-when`} label="When" error={errors.occurredAt} errorId={`${uid}-occurredAt-err`}>
                <input id={`${uid}-when`} type="datetime-local" className="field" value={occurredAt} max={localNow()} onChange={(e) => setOccurredAt(e.target.value)} {...field('occurredAt')} />
              </Field>
            </div>
          </details>
        </form>
      </Sheet>
      <ScannerSheet open={open && scanOpen} onClose={() => setScanOpen(false)} onCode={onScanned} title="Scan the item" />
    </>
  );
}

function Field({ id, label, hint, error, errorId, children }: { id: string; label: string; hint?: string; error?: string; errorId: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
          {label}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
}

function ErrorText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs font-medium text-status-out" role="alert">
      {children}
    </p>
  );
}

function LocationSelect({
  id,
  value,
  onChange,
  snapshot,
  exclude,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  snapshot: InventorySnapshot;
  exclude?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} {...aria}>
      <option value="">Choose a location…</option>
      {snapshot.locations
        .filter((l) => l.id !== exclude)
        .map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
    </select>
  );
}

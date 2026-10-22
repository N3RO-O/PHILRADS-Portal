import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, ScanLine } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { validateItem, type FieldErrors } from '../../lib/inventory';
import { InventoryRuleError, ITEM_CATEGORIES, type InventoryItem, type ItemCategory, type ItemDraft } from '../../services/inventory/types';
import { Sheet } from '../ui/Sheet';
import { QuantityStepper } from './QuantityStepper';
import { ScannerSheet } from './ScannerSheet';

interface Props {
  open: boolean;
  /** Edit this item, or create a new one (optionally with a scanned barcode). */
  item: InventoryItem | null;
  initialBarcode?: string;
  items: InventoryItem[];
  onClose: () => void;
  onSave: (draft: ItemDraft) => Promise<InventoryItem>;
  onDone: (message: string) => void;
}

/** Create or edit a catalogue item (administrators). Needs a connection: catalogue edits are not queued offline. */
export function ItemSheet({ open, item, initialBarcode, items, onClose, onSave, onDone }: Props) {
  const uid = useId();
  const online = useOnlineStatus();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Food');
  const [unit, setUnit] = useState('pcs');
  const [reorder, setReorder] = useState('0');
  const [tracksExpiry, setTracksExpiry] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setSku(item?.sku ?? '');
    setBarcode(item?.barcode ?? initialBarcode ?? '');
    setCategory(ITEM_CATEGORIES.find((c) => c === item?.category) ?? 'Food');
    setUnit(item?.unit ?? 'pcs');
    setReorder(String(item?.reorderLevel ?? 0));
    setTracksExpiry(item?.tracksExpiry ?? true);
    setAttempted(false);
    setServerError(null);
  }, [open, item, initialBarcode]);

  const draft: ItemDraft = {
    id: item?.id,
    name,
    sku,
    barcode: barcode || null,
    category,
    unit,
    reorderLevel: reorder === '' ? Number.NaN : Number.parseInt(reorder, 10),
    tracksExpiry,
  };
  const errors: FieldErrors = attempted ? validateItem(draft, items) : {};
  const aria = (k: keyof FieldErrors) => ({
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${uid}-${String(k)}-err` : undefined,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setAttempted(true);
    setServerError(null);
    if (Object.keys(validateItem(draft, items)).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave(draft);
      onDone(`${item ? 'Updated' : 'Added'} ${saved.name}.`);
      onClose();
    } catch (err) {
      setServerError(err instanceof InventoryRuleError ? err.message : 'Could not reach the server. Check the connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet
        open={open && !scanOpen}
        onClose={onClose}
        title={item ? `Edit ${item.name}` : 'Add an item'}
        subtitle="Catalogue changes are recorded in the activity log."
        footer={
          <button type="submit" form={`${uid}-form`} className="btn-primary h-12 w-full text-base" disabled={saving || !online}>
            {saving && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {!online ? 'Connect to save catalogue changes' : saving ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </button>
        }
      >
        <form id={`${uid}-form`} ref={formRef} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
          {serverError && (
            <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
              <strong className="font-semibold text-status-out">Not saved.</strong> {serverError}
            </p>
          )}
          <F id={`${uid}-name`} label="Item name" error={errors.name} errId={`${uid}-name-err`}>
            <input id={`${uid}-name`} data-autofocus={item ? undefined : true} className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} {...aria('name')} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F id={`${uid}-sku`} label="SKU" error={errors.sku} errId={`${uid}-sku-err`}>
              <input
                id={`${uid}-sku`}
                className="field uppercase"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                maxLength={24}
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="FD-001"
                {...aria('sku')}
              />
            </F>
            <F id={`${uid}-cat`} label="Category" error={errors.category} errId={`${uid}-category-err`}>
              <select id={`${uid}-cat`} className="field" value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)} {...aria('category')}>
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </F>
          </div>
          <F id={`${uid}-code`} label="Barcode or QR code" hint="Optional" error={errors.barcode} errId={`${uid}-barcode-err`}>
            <div className="flex gap-2">
              <input id={`${uid}-code`} className="field" value={barcode} onChange={(e) => setBarcode(e.target.value.trim())} spellCheck={false} {...aria('barcode')} />
              <button type="button" className="btn-ghost shrink-0 px-3" onClick={() => setScanOpen(true)} aria-label="Scan barcode">
                <ScanLine className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F id={`${uid}-unit`} label="Unit" error={errors.unit} errId={`${uid}-unit-err`}>
              <input id={`${uid}-unit`} className="field" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={16} placeholder="packs" {...aria('unit')} />
            </F>
            <F id={`${uid}-reorder`} label="Reorder level" hint="Per location" error={errors.reorderLevel} errId={`${uid}-reorderLevel-err`}>
              <QuantityStepper id={`${uid}-reorder`} value={reorder} onChange={setReorder} invalid={Boolean(errors.reorderLevel)} describedBy={errors.reorderLevel ? `${uid}-reorderLevel-err` : undefined} />
            </F>
          </div>
          <label className="tap flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-line/70 px-4">
            <span>
              <span className="block text-sm font-semibold">Perishable</span>
              <span className="block text-xs text-muted">Require an expiry date when this is received.</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-uplift" checked={tracksExpiry} onChange={(e) => setTracksExpiry(e.target.checked)} />
          </label>
        </form>
      </Sheet>
      <ScannerSheet
        open={open && scanOpen}
        onClose={() => setScanOpen(false)}
        onCode={(c) => {
          setBarcode(c);
          setScanOpen(false);
        }}
        title="Scan the item’s barcode"
      />
    </>
  );
}

function F({ id, label, hint, error, errId, children }: { id: string; label: string; hint?: string; error?: string; errId: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
          {label}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={errId} role="alert" className="text-xs font-medium text-status-out">
          {error}
        </p>
      )}
    </div>
  );
}

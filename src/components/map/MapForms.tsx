import { useEffect, useId, useState, type FormEvent } from 'react';
import { Crosshair, Loader2, LocateFixed, MapPin, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { currentPosition, distanceM, formatDistance, formatLatLng, type GeoResult } from '../../lib/geo';
import type { InventorySnapshot } from '../../services/inventory/types';
import { MapRuleError, PLACE_KINDS, type CheckInDraft, type MapPlace, type PlaceDraft } from '../../services/map/types';
import { Sheet } from '../ui/Sheet';

const errorText = (e: unknown) => (e instanceof MapRuleError ? e.message : 'Could not reach the server. Check the connection and try again.');

interface PlaceFormProps {
  draft: PlaceDraft;
  snapshot: InventorySnapshot | null;
  onChange: (d: PlaceDraft) => void;
  /** Close the form and pick the spot on the map (the draft is kept). */
  onPick: () => void;
  onSave: (d: PlaceDraft) => Promise<void>;
  onRemove?: () => Promise<void>;
  onClose: () => void;
}

/** Add or edit a place. Its spot is picked on the map (crosshair) or from the phone's GPS. */
export function PlaceForm({ draft: d, snapshot, onChange, onPick, onSave, onRemove, onClose }: PlaceFormProps) {
  const uid = useId();
  const online = useOnlineStatus();
  const [busy, setBusy] = useState<'save' | 'remove' | 'gps' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const set = (patch: Partial<PlaceDraft>) => onChange({ ...d, ...patch });
  const hasSpot = Number.isFinite(d.lat) && Number.isFinite(d.lng);
  const nameError = attempted && !d.name.trim() ? 'Give the place a name.' : null;
  const spotError = attempted && !hasSpot ? 'Set where the place is.' : null;
  const imsLocations = snapshot?.locations.map((l) => l.name) ?? [];
  const imsEvents = snapshot?.imsEvents ?? [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    setError(null);
    if (!d.name.trim() || !hasSpot) return;
    setBusy('save');
    try {
      await onSave(d);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };
  const useGps = async () => {
    setBusy('gps');
    setError(null);
    const r = await currentPosition();
    setBusy(null);
    if (r.ok) set({ lat: r.lat, lng: r.lng });
    else setError(r.reason);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      dirty={Boolean(d.name.trim())}
      title={d.id ? 'Edit place' : 'Add a place'}
      subtitle="Warehouses, hubs, response sites, distribution points, evacuation centers and offices."
      footer={
        <div className="flex gap-2">
          {onRemove && (
            <button
              type="button"
              className="btn-ghost px-4 text-status-out"
              disabled={Boolean(busy) || !online}
              onClick={async () => {
                if (!window.confirm(`Take “${d.name}” off the map? Its history is kept.`)) return;
                setBusy('remove');
                try {
                  await onRemove();
                } catch (err) {
                  setError(errorText(err));
                  setBusy(null);
                }
              }}
            >
              {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              <span className="sr-only sm:not-sr-only">Remove</span>
            </button>
          )}
          <button type="submit" form={`${uid}-form`} className="btn-primary h-12 flex-1 text-base" disabled={Boolean(busy) || !online}>
            {busy === 'save' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {!online ? 'Connect to save' : busy === 'save' ? 'Saving…' : d.id ? 'Save changes' : 'Add to the map'}
          </button>
        </div>
      }
    >
      <form id={`${uid}-form`} noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
        {error && (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-name`} className="text-sm font-semibold text-ink-soft">
            Name
          </label>
          <input
            id={`${uid}-name`}
            className="field"
            maxLength={120}
            data-autofocus={d.id ? undefined : true}
            placeholder="e.g. Tacloban Field Hub"
            value={d.name}
            onChange={(e) => set({ name: e.target.value })}
            aria-invalid={nameError ? true : undefined}
          />
          {nameError && <p className="text-xs font-medium text-status-out">{nameError}</p>}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink-soft">What is it?</legend>
          <div className="grid grid-cols-2 gap-2">
            {PLACE_KINDS.map((k) => (
              <label
                key={k.key}
                className={`tap flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm leading-tight transition-colors ${d.kind === k.key ? 'border-uplift bg-uplift/10 font-semibold' : 'border-line/70 hover:border-ink-mute'}`}
              >
                <input type="radio" name={`${uid}-kind`} className="sr-only" checked={d.kind === k.key} onChange={() => set({ kind: k.key })} />
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: k.color }} aria-hidden />
                <span className="min-w-0">{k.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink-soft">Where it is</span>
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${spotError ? 'border-status-out/60' : 'border-line/70'}`}>
            <MapPin className={`h-4 w-4 shrink-0 ${hasSpot ? 'text-uplift' : 'text-muted'}`} aria-hidden />
            <span className={hasSpot ? 'tabular-nums' : 'text-muted'}>{hasSpot ? formatLatLng(d) : 'Not set yet'}</span>
          </div>
          {spotError && <p className="text-xs font-medium text-status-out">{spotError}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost min-h-11 whitespace-nowrap px-3 text-sm" onClick={onPick}>
              <Crosshair className="h-4 w-4" aria-hidden /> Pick on map
            </button>
            <button type="button" className="btn-ghost min-h-11 whitespace-nowrap px-3 text-sm" onClick={() => void useGps()} disabled={busy === 'gps'}>
              {busy === 'gps' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LocateFixed className="h-4 w-4" aria-hidden />} I’m here now
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${uid}-addr`} className="text-sm font-semibold text-ink-soft">
              Address or landmark
            </label>
            <span className="text-xs text-muted">Optional</span>
          </div>
          <input id={`${uid}-addr`} className="field" maxLength={300} value={d.address} onChange={(e) => set({ address: e.target.value })} placeholder="e.g. Brgy. 62 Sagkahan, beside the chapel" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${uid}-loc`} className="text-sm font-semibold text-ink-soft">
              Stock location in the IMS
            </label>
            <select id={`${uid}-loc`} className="field truncate" value={d.imsLocation ?? ''} onChange={(e) => set({ imsLocation: e.target.value || null })}>
              <option value="">Not linked</option>
              {d.imsLocation && !imsLocations.includes(d.imsLocation) && <option value={d.imsLocation}>{d.imsLocation}</option>}
              {imsLocations.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">Shows this place’s live stock on the map.</p>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${uid}-ev`} className="text-sm font-semibold text-ink-soft">
              Relief event in the IMS
            </label>
            <select id={`${uid}-ev`} className="field truncate" value={d.imsEventId ?? ''} onChange={(e) => set({ imsEventId: e.target.value || null })}>
              <option value="">Not linked</option>
              {imsEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">Shows people served here.</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${uid}-notes`} className="text-sm font-semibold text-ink-soft">
              Notes for the team
            </label>
            <span className="text-xs text-muted">Optional</span>
          </div>
          <textarea id={`${uid}-notes`} className="field min-h-20" rows={2} maxLength={500} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Access road, contact person, opening hours…" />
        </div>
      </form>
    </Sheet>
  );
}

interface CheckInProps {
  places: MapPlace[];
  onClose: () => void;
  onShare: (d: CheckInDraft) => Promise<void>;
}

/** "Check in here": one GPS reading, an optional note, shared with the team for 24 hours. */
export function CheckInSheet({ places, onClose, onShare }: CheckInProps) {
  const uid = useId();
  const online = useOnlineStatus();
  const [pos, setPos] = useState<GeoResult | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = async () => {
    setPos(null);
    setPos(await currentPosition());
  };
  useEffect(() => {
    void locate();
  }, []);

  const nearest = pos?.ok ? places.map((p) => ({ p, d: distanceM(p, pos) })).sort((a, b) => a.d - b.d)[0] : null;

  return (
    <Sheet
      open
      onClose={onClose}
      dirty={Boolean(note.trim())}
      title="Check in here"
      subtitle="Let the team see where you are right now."
      footer={
        <button
          type="button"
          className="btn-primary h-12 w-full text-base"
          disabled={!pos?.ok || busy || !online}
          onClick={async () => {
            if (!pos?.ok) return;
            setBusy(true);
            setError(null);
            try {
              await onShare({ lat: pos.lat, lng: pos.lng, accuracyM: pos.accuracyM, note });
            } catch (e) {
              setError(errorText(e));
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          {!online ? 'Connect to check in' : busy ? 'Sharing…' : 'Share where I am'}
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="tile flex items-center gap-3 p-4" aria-live="polite">
          {!pos ? (
            <>
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-uplift" aria-hidden />
              <span className="text-sm">Finding your location…</span>
            </>
          ) : pos.ok ? (
            <>
              <LocateFixed className="h-5 w-5 shrink-0 text-status-in" aria-hidden />
              <span className="min-w-0 text-sm">
                <span className="block font-semibold">Found you, within {formatDistance(pos.accuracyM)}</span>
                <span className="block text-xs text-muted">{nearest && nearest.d < 50_000 ? `${formatDistance(nearest.d)} from ${nearest.p.name}` : formatLatLng(pos)}</span>
              </span>
            </>
          ) : (
            <div className="flex w-full flex-col gap-3">
              <p className="text-sm">{pos.reason}</p>
              <button type="button" className="btn-ghost self-start" onClick={() => void locate()}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Try again
              </button>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${uid}-note`} className="text-sm font-semibold text-ink-soft">
              What are you doing here?
            </label>
            <span className="text-xs text-muted">Optional</span>
          </div>
          <input id={`${uid}-note`} className="field" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Distribution day 2, 150 families so far" />
        </div>
        <p className="flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-uplift" aria-hidden />
          Only PHILRADS staff see it, and it disappears after 24 hours. Your location is shared only when you tap the button; it’s never tracked in the background.
        </p>
      </div>
    </Sheet>
  );
}

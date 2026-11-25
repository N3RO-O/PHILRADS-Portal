import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, HandCoins, HeartHandshake, ImagePlus, Inbox, Mail, Megaphone, Phone, Plus, Shirt, Star, Trash2, type LucideIcon } from 'lucide-react';
import { useAuth } from '../components/auth/AuthProvider';
import { Picture } from '../components/guest/guestUi';
import { CommunityReview } from '../components/guest/CommunityReview';
import { BusyLabel } from '../components/ui/BusyLabel';
import { EmptyState, LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { Sheet } from '../components/ui/Sheet';
import { SlidingPill } from '../components/ui/SlidingPill';
import { Switch } from '../components/ui/Switch';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatDateTime, formatShortDate, formatShortInstant } from '../lib/format';
import { guestService } from '../services';
import {
  amount,
  ANNOUNCEMENT_LEVELS,
  announcementLevelLabel,
  isLive,
  GuestRuleError,
  messageKindLabel,
  STORY_KINDS,
  type AnnouncementDraft,
  type DonationDrive,
  type GuestAnnouncement,
  type GuestHotline,
  type GuestPrayer,
  type HotlineDraft,
  type PrayerDraft,
  type DriveDraft,
  type DriveStatus,
  type GuestMessage,
  type GuestStory,
  type MerchDraft,
  type MerchItem,
  type MessageStatus,
  type StoryDraft,
} from '../services/guest/guestService';

type Tab = 'inbox' | 'community' | 'news' | 'hotlines' | 'stories' | 'prayer' | 'drives' | 'merch';
const TABS: { key: Tab; label: string }[] = [
  { key: 'inbox', label: 'Messages' },
  { key: 'community', label: 'Community' },
  { key: 'news', label: 'News' },
  { key: 'hotlines', label: 'Hotlines' },
  { key: 'stories', label: 'PHILReads' },
  { key: 'prayer', label: 'Prayer' },
  { key: 'drives', label: 'Fundraising' },
  { key: 'merch', label: 'Merch' },
];

const errorText = (e: unknown, fallback: string) => (e instanceof GuestRuleError || e instanceof Error ? e.message : fallback);

// ───────────────────────── Small pieces ─────────────────────────

function Field({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      {children}
      {note && <span className="text-xs font-normal text-muted">{note}</span>}
    </label>
  );
}

function SwitchRow({ label, note, checked, onChange }: { label: string; note?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-sunken px-4 py-3">
      <div id={id}>
        <p className="text-sm font-semibold text-ink">{label}</p>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} labelledBy={id} />
    </div>
  );
}

/** A picture for the guest page: upload one, see it, or take it off. */
function ImageField({ label, value, onChange, icon }: { label: string; value: string | null; onChange: (url: string | null) => void; icon: LucideIcon }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await guestService.uploadImage(file));
    } catch (e) {
      setError(errorText(e, 'The picture could not be uploaded.'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-3">
        <Picture src={value} alt="" icon={icon} className="h-20 w-28 shrink-0 rounded-xl" />
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" className="chip gap-1.5" onClick={() => input.current?.click()} disabled={busy}>
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            <BusyLabel busy={busy} busyText="Uploading…">
              {value ? 'Change picture' : 'Add a picture'}
            </BusyLabel>
          </button>
          {value && (
            <button type="button" className="text-xs font-semibold text-muted hover:text-ink" onClick={() => onChange(null)}>
              Remove picture
            </button>
          )}
          <span className="text-xs text-muted">JPG, PNG or WebP, under 3 MB.</span>
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files?.[0])} />
      {error && <p className="text-xs text-status-out">{error}</p>}
    </div>
  );
}

/** Delete in two presses, so a slip doesn't lose anything. */
function DeleteButton({ onDelete, what }: { onDelete: () => Promise<void>; what: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`chip gap-1.5 ${armed ? 'border-status-out text-status-out' : ''}`}
      disabled={busy}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setBusy(true);
        try {
          await onDelete();
        } finally {
          setBusy(false);
          setArmed(false);
        }
      }}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      {armed ? `Delete this ${what}?` : 'Delete'}
    </button>
  );
}

/** The editor's footer: save, and delete for something that already exists. */
function EditorFooter({ form, busy, error, onDelete, what }: { form: string; busy: boolean; error: string | null; onDelete?: () => Promise<void>; what: string }) {
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-status-out">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        {onDelete && <DeleteButton onDelete={onDelete} what={what} />}
        <button type="submit" form={form} className="btn-primary ml-auto" disabled={busy}>
          <BusyLabel busy={busy} busyText="Saving…">
            Save
          </BusyLabel>
        </button>
      </div>
    </div>
  );
}

/** Editing state shared by the three editors. */
function useEditor<D>(save: (d: D) => Promise<unknown>, remove: (id: string) => Promise<void>, onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (d: D) => {
    setBusy(true);
    setError(null);
    try {
      await save(d);
      onDone();
    } catch (e) {
      setError(errorText(e, 'Could not save. Check the connection and try again.'));
    } finally {
      setBusy(false);
    }
  };
  const del = async (id: string) => {
    setError(null);
    try {
      await remove(id);
      onDone();
    } catch (e) {
      setError(errorText(e, 'Could not delete. Check the connection and try again.'));
    }
  };
  return { busy, error, setError, run, del };
}

// ───────────────────────── News ─────────────────────────

const blankAnnouncement = (): AnnouncementDraft => ({ title: '', body: '', level: 'update', area: '', linkUrl: '', isPublished: false, expiresAt: null });
/** The Philippine date of a moment, for the date box. */
const phDate = (iso: string | null) => (iso ? new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 10) : '');
/** The end of that Philippine day, as the moment it comes down. */
const endOfPhDay = (date: string) => (date ? new Date(`${date}T23:59:59+08:00`).toISOString() : null);

function AnnouncementEditor({ draft, onClose, onSaved }: { draft: AnnouncementDraft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<AnnouncementDraft>(blankAnnouncement);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (draft) {
      setD(draft);
      setDirty(false);
    }
  }, [draft]);
  const set = (patch: Partial<AnnouncementDraft>) => {
    setD((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const ed = useEditor<AnnouncementDraft>(
    async (x) => {
      const saved = await guestService.saveAnnouncement(x);
      // Guests who turned on alerts get an urgent one on their phones right away.
      if (saved.level === 'urgent' && isLive(saved)) guestService.sendAlertsNow();
      return saved;
    },
    guestService.removeAnnouncement,
    onSaved,
  );
  const level = ANNOUNCEMENT_LEVELS.find((l) => l.key === d.level)!;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.title.trim()) return ed.setError('Give the announcement a title.');
    if (d.isPublished && d.expiresAt && Date.parse(d.expiresAt) < Date.now()) return ed.setError('The take-down date has passed. Pick a later one, or leave it empty.');
    void ed.run(d);
  };
  return (
    <Sheet
      open={!!draft}
      onClose={onClose}
      dirty={dirty}
      title={draft?.id ? 'Edit announcement' : 'New announcement'}
      subtitle="Shown at the top of Disaster News on the guest page once published."
      footer={<EditorFooter form="announcement-form" busy={ed.busy} error={ed.error} onDelete={d.id ? () => ed.del(d.id!) : undefined} what="announcement" />}
    >
      <form id="announcement-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Title">
          <input className="field font-normal" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={140} placeholder="Evacuation center open at Virac Central School" data-autofocus />
        </Field>
        <div>
          <div role="radiogroup" aria-label="How important" className="flex flex-wrap gap-2">
            {ANNOUNCEMENT_LEVELS.map((l) => (
              <button key={l.key} type="button" role="radio" aria-checked={d.level === l.key} aria-pressed={d.level === l.key} className="chip" onClick={() => set({ level: l.key })}>
                {l.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">{level.note}</p>
        </div>
        <Field label="Details" note="What is happening, who it is for, and what to do or bring.">
          <textarea className="field min-h-36 font-normal leading-relaxed" value={d.body} onChange={(e) => set({ body: e.target.value })} maxLength={2000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where (optional)">
            <input className="field font-normal" value={d.area ?? ''} onChange={(e) => set({ area: e.target.value })} maxLength={120} placeholder="Virac, Catanduanes" />
          </Field>
          <Field label="Take it down after (optional)" note="It leaves the guest page at the end of that day.">
            <input type="date" className="field font-normal" value={phDate(d.expiresAt)} onChange={(e) => set({ expiresAt: endOfPhDay(e.target.value) })} />
          </Field>
        </div>
        <Field label="Link (optional)" note="An official bulletin or a map, if there is one.">
          <input type="url" inputMode="url" className="field font-normal" value={d.linkUrl ?? ''} onChange={(e) => set({ linkUrl: e.target.value })} maxLength={600} placeholder="https://" />
        </Field>
        <SwitchRow
          label="Published"
          note={d.isPublished ? (d.level === 'urgent' ? 'Guests can see it, and those who turned on alerts get it on their phones.' : 'Guests can see it.') : 'Only staff can see it here.'}
          checked={d.isPublished}
          onChange={(isPublished) => set({ isPublished })}
        />
      </form>
    </Sheet>
  );
}

// ───────────────────────── Hotlines ─────────────────────────

const blankHotline = (order: number): HotlineDraft => ({ name: '', number: '', note: '', area: '', sortOrder: order, isListed: true });

function HotlineEditor({ draft, onClose, onSaved }: { draft: HotlineDraft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<HotlineDraft>(() => blankHotline(0));
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (draft) {
      setD(draft);
      setDirty(false);
    }
  }, [draft]);
  const set = (patch: Partial<HotlineDraft>) => {
    setD((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const ed = useEditor<HotlineDraft>(guestService.saveHotline, guestService.removeHotline, onSaved);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.name.trim()) return ed.setError('Say whose number it is.');
    if (!/^[0-9+() -]{3,30}$/.test(d.number.trim())) return ed.setError('Write the number with digits only (spaces, +, - and brackets are fine).');
    void ed.run(d);
  };
  return (
    <Sheet
      open={!!draft}
      onClose={onClose}
      dirty={dirty}
      title={draft?.id ? 'Edit hotline' : 'New hotline'}
      subtitle="Guests tap it to call. Check the number before saving."
      footer={<EditorFooter form="hotline-form" busy={ed.busy} error={ed.error} onDelete={d.id ? () => ed.del(d.id!) : undefined} what="hotline" />}
    >
      <form id="hotline-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Name">
          <input className="field font-normal" value={d.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} placeholder="Albay PDRRMO" data-autofocus />
        </Field>
        <Field label="Number" note="As it is dialled from a phone, like 0917 123 4567 or (02) 8911-5061.">
          <input className="field font-normal tabular-nums" inputMode="tel" value={d.number} onChange={(e) => set({ number: e.target.value })} maxLength={30} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area (optional)" note="Province or city. Leave empty for a nationwide number.">
            <input className="field font-normal" value={d.area ?? ''} onChange={(e) => set({ area: e.target.value })} maxLength={80} placeholder="Albay" />
          </Field>
          <Field label="Note (optional)">
            <input className="field font-normal" value={d.note ?? ''} onChange={(e) => set({ note: e.target.value })} maxLength={160} placeholder="24 hours, rescue and evacuation" />
          </Field>
        </div>
        <SwitchRow label="Shown to guests" checked={d.isListed} onChange={(isListed) => set({ isListed })} />
      </form>
    </Sheet>
  );
}

// ───────────────────────── Prayer ─────────────────────────

const blankPrayer = (): PrayerDraft => ({ title: '', body: '', area: '', isPublished: false });

function PrayerEditor({ draft, onClose, onSaved }: { draft: PrayerDraft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<PrayerDraft>(blankPrayer);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (draft) {
      setD(draft);
      setDirty(false);
    }
  }, [draft]);
  const set = (patch: Partial<PrayerDraft>) => {
    setD((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const ed = useEditor<PrayerDraft>(guestService.savePrayer, guestService.removePrayer, onSaved);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.title.trim()) return ed.setError('Give the prayer point a title.');
    void ed.run(d);
  };
  return (
    <Sheet
      open={!!draft}
      onClose={onClose}
      dirty={dirty}
      title={draft?.id ? 'Edit prayer point' : 'New prayer point'}
      subtitle="Shown on Pray with us. Guests can say they prayed."
      footer={<EditorFooter form="prayer-form" busy={ed.busy} error={ed.error} onDelete={d.id ? () => ed.del(d.id!) : undefined} what="prayer point" />}
    >
      <form id="prayer-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Title">
          <input className="field font-normal" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={140} placeholder="Families in Cagayan as the river rises" data-autofocus />
        </Field>
        <Field label="What to pray for">
          <textarea className="field min-h-32 font-normal leading-relaxed" value={d.body} onChange={(e) => set({ body: e.target.value })} maxLength={1500} />
        </Field>
        <Field label="Area (optional)">
          <input className="field font-normal" value={d.area ?? ''} onChange={(e) => set({ area: e.target.value })} maxLength={120} placeholder="Cagayan Valley" />
        </Field>
        <SwitchRow label="Published" note={d.isPublished ? 'Guests can see it.' : 'Only staff can see it here.'} checked={d.isPublished} onChange={(isPublished) => set({ isPublished })} />
      </form>
    </Sheet>
  );
}

// ───────────────────────── PHILReads ─────────────────────────

const blankStory = (): StoryDraft => ({ title: '', summary: '', body: '', kind: 'story', place: '', coverUrl: null, authorName: '', isPublished: false });

function StoryEditor({ draft, onClose, onSaved }: { draft: StoryDraft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<StoryDraft>(blankStory);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (draft) {
      setD(draft);
      setDirty(false);
    }
  }, [draft]);
  const set = (patch: Partial<StoryDraft>) => {
    setD((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const ed = useEditor<StoryDraft>(guestService.saveStory, guestService.removeStory, onSaved);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.title.trim()) return ed.setError('Give the story a title.');
    if (d.isPublished && d.body.trim().length < 40) return ed.setError('Write the story before publishing it (at least a few sentences).');
    void ed.run(d);
  };
  return (
    <Sheet
      open={!!draft}
      onClose={onClose}
      dirty={dirty}
      title={draft?.id ? 'Edit story' : 'New story'}
      subtitle="Shown on the guest page under PHILReads once published."
      footer={<EditorFooter form="story-form" busy={ed.busy} error={ed.error} onDelete={d.id ? () => ed.del(d.id!) : undefined} what="story" />}
    >
      <form id="story-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Title">
          <input className="field font-normal" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={140} data-autofocus />
        </Field>
        <div role="radiogroup" aria-label="Kind" className="flex flex-wrap gap-2">
          {STORY_KINDS.map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={d.kind === k.key} aria-pressed={d.kind === k.key} className="chip" onClick={() => set({ kind: k.key })}>
              {k.label}
            </button>
          ))}
        </div>
        <Field label="One-line summary" note="Shown in the list, under the title.">
          <input className="field font-normal" value={d.summary ?? ''} onChange={(e) => set({ summary: e.target.value })} maxLength={300} />
        </Field>
        <Field label="The story" note="Leave an empty line between paragraphs.">
          <textarea className="field min-h-64 font-serif text-base font-normal leading-relaxed" value={d.body} onChange={(e) => set({ body: e.target.value })} maxLength={20000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Where (optional)">
            <input className="field font-normal" value={d.place ?? ''} onChange={(e) => set({ place: e.target.value })} maxLength={120} placeholder="Virac, Catanduanes" />
          </Field>
          <Field label="Written by (optional)">
            <input className="field font-normal" value={d.authorName ?? ''} onChange={(e) => set({ authorName: e.target.value })} maxLength={80} placeholder="PHILRADS field team" />
          </Field>
        </div>
        <ImageField label="Cover picture" value={d.coverUrl} onChange={(coverUrl) => set({ coverUrl })} icon={BookOpen} />
        <p className="text-xs text-muted">Only use photos people agreed to be in. Leave out faces of children and anything that identifies someone at risk.</p>
        <SwitchRow label="Published" note={d.isPublished ? 'Guests can read it.' : 'Only staff can see it here.'} checked={d.isPublished} onChange={(isPublished) => set({ isPublished })} />
      </form>
    </Sheet>
  );
}

// ───────────────────────── Drives ─────────────────────────

const blankDrive = (): DriveDraft => ({ title: '', summary: '', impactNote: '', unit: 'PHP', goal: 0, raised: 0, donorCount: null, startsOn: new Date().toISOString().slice(0, 10), endsOn: null, howToGive: '', coverUrl: null, status: 'draft', report: '', reportPhotos: [], reportReached: null });
const DRIVE_STATUS: { key: DriveStatus; label: string; note: string }[] = [
  { key: 'draft', label: 'Draft', note: 'Only staff can see it.' },
  { key: 'open', label: 'Open', note: 'Shown to guests with its progress.' },
  { key: 'closed', label: 'Closed', note: 'Listed under Completed fundraisers.' },
];

function DriveEditor({ draft, onClose, onSaved }: { draft: DriveDraft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<DriveDraft>(blankDrive);
  const [money, setMoney] = useState(true);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (draft) {
      setD(draft);
      setMoney(draft.unit.toUpperCase() === 'PHP');
      setDirty(false);
    }
  }, [draft]);
  const set = (patch: Partial<DriveDraft>) => {
    setD((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const ed = useEditor<DriveDraft>(guestService.saveDrive, guestService.removeDrive, onSaved);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.title.trim()) return ed.setError('Give the fundraiser a title.');
    if (!(d.goal > 0)) return ed.setError('Set a goal above zero.');
    if (d.raised < 0) return ed.setError('The amount raised can’t be below zero.');
    if (!money && !d.unit.trim()) return ed.setError('Say what is being collected, like “family packs”.');
    if (d.endsOn && d.startsOn && d.endsOn < d.startsOn) return ed.setError('The end date is before the start date.');
    if (d.status === 'open' && !d.howToGive?.trim()) return ed.setError('Add how to give before opening the fundraiser.');
    if (d.report?.trim() && d.status !== 'closed') return ed.setError('Close the fundraiser before posting where the gifts went.');
    void ed.run({ ...d, unit: money ? 'PHP' : d.unit });
  };
  const numberField = (v: number | null, on: (n: number | null) => void, label: string, note?: string) => (
    <Field label={label} note={note}>
      <input
        className="field font-normal tabular-nums"
        inputMode="decimal"
        value={v === null || Number.isNaN(v) ? '' : String(v)}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.]/g, '');
          on(t === '' ? null : Number(t));
        }}
      />
    </Field>
  );
  return (
    <Sheet
      open={!!draft}
      onClose={onClose}
      dirty={dirty}
      title={draft?.id ? 'Edit fundraiser' : 'New fundraiser'}
      subtitle="Guests see the goal, the amount so far and how to give."
      footer={<EditorFooter form="drive-form" busy={ed.busy} error={ed.error} onDelete={d.id ? () => ed.del(d.id!) : undefined} what="fundraiser" />}
    >
      <form id="drive-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Title">
          <input className="field font-normal" value={d.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder="Family food packs for Catanduanes" data-autofocus />
        </Field>
        <Field label="What it's for">
          <textarea className="field min-h-20 font-normal" value={d.summary ?? ''} onChange={(e) => set({ summary: e.target.value })} maxLength={400} />
        </Field>
        <Field label="What a gift does (optional)" note="One line that makes the goal concrete.">
          <input className="field font-normal" value={d.impactNote ?? ''} onChange={(e) => set({ impactNote: e.target.value })} maxLength={200} placeholder="₱650 packs food for a family of five for three days." />
        </Field>
        <div role="radiogroup" aria-label="Collecting" className="flex flex-wrap gap-2">
          <button type="button" role="radio" aria-checked={money} aria-pressed={money} className="chip" onClick={() => (setMoney(true), set({ unit: 'PHP' }))}>
            Money (₱)
          </button>
          <button type="button" role="radio" aria-checked={!money} aria-pressed={!money} className="chip" onClick={() => (setMoney(false), set({ unit: d.unit.toUpperCase() === 'PHP' ? '' : d.unit }))}>
            Goods or items
          </button>
        </div>
        {!money && (
          <Field label="What is collected">
            <input className="field font-normal" value={d.unit} onChange={(e) => set({ unit: e.target.value })} maxLength={30} placeholder="family packs" />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {numberField(d.goal || null, (n) => set({ goal: n ?? 0 }), money ? 'Goal (₱)' : 'Goal')}
          {numberField(d.raised, (n) => set({ raised: n ?? 0 }), money ? 'Raised so far (₱)' : 'Collected so far')}
          {numberField(d.donorCount, (n) => set({ donorCount: n === null ? null : Math.round(n) }), 'Donors (optional)')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            <input type="date" className="field font-normal" value={d.startsOn ?? ''} onChange={(e) => set({ startsOn: e.target.value || null })} />
          </Field>
          <Field label="Ends (optional)">
            <input type="date" className="field font-normal" value={d.endsOn ?? ''} onChange={(e) => set({ endsOn: e.target.value || null })} />
          </Field>
        </div>
        <Field label="How to give" note="Bank, GCash or drop-off details exactly as donors should use them. Guests can copy them in one tap.">
          <textarea className="field min-h-28 font-normal" value={d.howToGive ?? ''} onChange={(e) => set({ howToGive: e.target.value })} maxLength={2000} />
        </Field>
        <ImageField label="Cover picture (optional)" value={d.coverUrl} onChange={(coverUrl) => set({ coverUrl })} icon={HandCoins} />
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink">Status</legend>
          <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
            {DRIVE_STATUS.map((s) => (
              <button key={s.key} type="button" role="radio" aria-checked={d.status === s.key} aria-pressed={d.status === s.key} className="chip" onClick={() => set({ status: s.key })}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">{DRIVE_STATUS.find((s) => s.key === d.status)?.note}</p>
        </fieldset>
        {d.status === 'closed' && (
          <fieldset className="flex flex-col gap-4 border-t border-line/70 pt-4">
            <legend className="sr-only">Where the gifts went</legend>
            <div>
              <p className="text-sm font-semibold text-ink">Where the gifts went</p>
              <p className="text-xs text-muted">Shown on the finished fundraiser, so donors see what their gift did.</p>
            </div>
            <Field label="What the gifts did">
              <textarea className="field min-h-28 font-normal leading-relaxed" value={d.report ?? ''} onChange={(e) => set({ report: e.target.value })} maxLength={2000} placeholder="Your gifts bought 640 roofing sheets…" />
            </Field>
            {numberField(d.reportReached, (n) => set({ reportReached: n === null ? null : Math.round(n) }), 'Families reached (optional)')}
            <div className="grid gap-4 sm:grid-cols-2">
              {[...d.reportPhotos, ...(d.reportPhotos.length < 6 ? [null] : [])].map((url, i) => (
                <ImageField
                  key={url ?? `new-${i}`}
                  label={url ? `Photo ${i + 1}` : d.reportPhotos.length ? 'Another photo' : 'Photos (up to 6)'}
                  value={url}
                  icon={HandCoins}
                  onChange={(next) => set({ reportPhotos: next ? (url ? d.reportPhotos.map((x, j) => (j === i ? next : x)) : [...d.reportPhotos, next]) : d.reportPhotos.filter((_, j) => j !== i) })}
                />
              ))}
            </div>
          </fieldset>
        )}
      </form>
    </Sheet>
  );
}

// ───────────────────────── Merch ─────────────────────────

const blankMerch = (order: number): MerchDraft => ({ name: '', description: '', price: null, sizes: [], imageUrl: null, inStock: true, isListed: false, sortOrder: order });

function MerchEditor({ draft, onClose, onSaved }: { draft: MerchDraft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<MerchDraft>(() => blankMerch(0));
  const [sizes, setSizes] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (draft) {
      setD(draft);
      setSizes(draft.sizes.join(', '));
      setDirty(false);
    }
  }, [draft]);
  const set = (patch: Partial<MerchDraft>) => {
    setD((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const ed = useEditor<MerchDraft>(guestService.saveMerch, guestService.removeMerch, onSaved);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!d.name.trim()) return ed.setError('Give the item a name.');
    const list = sizes.split(',').map((x) => x.trim()).filter(Boolean);
    if (list.length > 12) return ed.setError('Up to 12 sizes.');
    void ed.run({ ...d, sizes: list });
  };
  return (
    <Sheet
      open={!!draft}
      onClose={onClose}
      dirty={dirty}
      title={draft?.id ? 'Edit item' : 'New merch item'}
      subtitle="Guests send an order request; the team replies to arrange payment and delivery."
      footer={<EditorFooter form="merch-form" busy={ed.busy} error={ed.error} onDelete={d.id ? () => ed.del(d.id!) : undefined} what="item" />}
    >
      <form id="merch-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Name">
          <input className="field font-normal" value={d.name} onChange={(e) => set({ name: e.target.value })} maxLength={100} data-autofocus />
        </Field>
        <Field label="Description (optional)">
          <textarea className="field min-h-20 font-normal" value={d.description ?? ''} onChange={(e) => set({ description: e.target.value })} maxLength={600} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price (₱)" note="Leave empty to show “Ask for the price”.">
            <input
              className="field font-normal tabular-nums"
              inputMode="decimal"
              value={d.price === null ? '' : String(d.price)}
              onChange={(e) => {
                const t = e.target.value.replace(/[^\d.]/g, '');
                set({ price: t === '' ? null : Number(t) });
              }}
            />
          </Field>
          <Field label="Sizes (optional)" note="Separate with commas.">
            <input
              className="field font-normal"
              value={sizes}
              onChange={(e) => {
                setSizes(e.target.value);
                setDirty(true);
              }}
              placeholder="S, M, L, XL"
            />
          </Field>
        </div>
        <ImageField label="Photo" value={d.imageUrl} onChange={(imageUrl) => set({ imageUrl })} icon={Shirt} />
        <SwitchRow label="In stock" note={d.inStock ? 'Guests can ask to order it.' : 'Shown as out of stock.'} checked={d.inStock} onChange={(inStock) => set({ inStock })} />
        <SwitchRow label="Shown to guests" note={d.isListed ? 'Listed under Merch.' : 'Hidden from the guest page.'} checked={d.isListed} onChange={(isListed) => set({ isListed })} />
      </form>
    </Sheet>
  );
}

// ───────────────────────── Messages ─────────────────────────

function MessageRow({ m, onMark, onDelete }: { m: GuestMessage; onMark: (s: MessageStatus) => void; onDelete: () => Promise<void> }) {
  const isMail = m.contact?.includes('@');
  return (
    <li className={`flex flex-col gap-2 rounded-2xl border p-4 ${m.status === 'new' ? 'border-uplift/40 bg-surface' : 'border-line bg-surface'}`}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold text-ink">{messageKindLabel(m.kind)}</span>
        {m.status === 'new' && <span className="rounded-full bg-uplift/15 px-2 py-px font-semibold text-uplift">New</span>}
        {m.status === 'done' && <span className="font-semibold text-status-in">Done{m.handledBy ? ` by ${m.handledBy}` : ''}</span>}
        <span className="text-muted">{formatDateTime(m.createdAt)}</span>
        {m.rating && (
          <span className="inline-flex items-center gap-0.5 text-uplift" aria-label={`Rated ${m.rating} of 5`}>
            {Array.from({ length: m.rating }, (_, i) => (
              <Star key={i} className="h-3 w-3 fill-current" aria-hidden />
            ))}
          </span>
        )}
      </p>
      {m.kind === 'order' && (
        <p className="text-sm font-semibold text-ink">
          {m.quantity ?? 1} × {m.merchName ?? 'an item no longer listed'}
          {m.merchSize ? `, size ${m.merchSize}` : ''}
        </p>
      )}
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{m.message}</p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        {m.name ? <span>From {m.name}</span> : <span className="text-muted">No name given</span>}
        {m.community && <span>{m.community}</span>}
        {m.contact && (
          <a className="link" href={isMail ? `mailto:${m.contact}` : `tel:${m.contact.replace(/[^\d+]/g, '')}`}>
            {isMail ? <Mail className="h-3.5 w-3.5" aria-hidden /> : <Phone className="h-3.5 w-3.5" aria-hidden />}
            {m.contact}
          </a>
        )}
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        {m.status !== 'done' && (
          <button type="button" className="chip" onClick={() => onMark('done')}>
            Mark done
          </button>
        )}
        {m.status === 'new' && (
          <button type="button" className="chip" onClick={() => onMark('seen')}>
            Mark seen
          </button>
        )}
        {m.status !== 'new' && (
          <button type="button" className="chip" onClick={() => onMark('new')}>
            Mark as new
          </button>
        )}
        <DeleteButton onDelete={onDelete} what="message" />
      </div>
    </li>
  );
}

function InboxTab() {
  const data = useAsyncData(useCallback(() => guestService.inbox(), []));
  const [show, setShow] = useState<'open' | 'all'>('open');
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<GuestMessage[] | null>(null);
  useEffect(() => {
    if (data.data) setLocal(data.data);
  }, [data.data]);
  if (data.status === 'loading' && !local) return <Skeleton className="h-64" />;
  if (data.status === 'error' && !local) return <LoadError message={data.error.message} onRetry={data.reload} />;
  const list = (local ?? []).filter((m) => show === 'all' || m.status !== 'done');
  const mark = async (m: GuestMessage, status: MessageStatus) => {
    setError(null);
    setLocal((l) => l?.map((x) => (x.id === m.id ? { ...x, status } : x)) ?? l);
    try {
      await guestService.markMessage(m.id, status);
    } catch (e) {
      setError(errorText(e, 'Could not update the message.'));
      data.refresh();
    }
  };
  const remove = async (m: GuestMessage) => {
    setError(null);
    try {
      await guestService.removeMessage(m.id);
      setLocal((l) => l?.filter((x) => x.id !== m.id) ?? l);
    } catch (e) {
      setError(errorText(e, 'Could not delete the message.'));
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">Feedback, community needs, merch orders and volunteers from the guest page. Reply by phone or email, then mark it done.</p>
        <div role="group" aria-label="Show" className="relative flex gap-1 rounded-xl bg-surface-sunken p-1">
          <SlidingPill className="rounded-lg bg-surface-raised shadow-sm shadow-black/30 ring-1 ring-inset ring-ink/[0.06]" />
          {(
            [
              ['open', 'To do'],
              ['all', 'All'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className="tap relative z-10 min-h-9 rounded-lg px-3 text-sm font-semibold text-ink-soft transition-colors duration-500 aria-pressed:text-ink">
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="notice text-status-out">
          {error}
        </p>
      )}
      {list.length ? (
        <ul className="flex flex-col gap-3">
          {list.map((m) => (
            <MessageRow key={m.id} m={m} onMark={(s) => void mark(m, s)} onDelete={() => remove(m)} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={Inbox} title={show === 'open' ? 'Nothing to do' : 'No messages yet'}>
          {show === 'open' ? 'Every guest message has been handled.' : 'Messages guests send from the guest page appear here.'}
        </EmptyState>
      )}
    </div>
  );
}

// ───────────────────────── Content tabs ─────────────────────────

function ListTab<T extends { id: string }>({
  load,
  newLabel,
  onNew,
  onEdit,
  empty,
  row,
  reloadKey,
}: {
  load: () => Promise<T[]>;
  newLabel: string;
  onNew: () => void;
  onEdit: (item: T) => void;
  empty: { icon: LucideIcon; title: string; body: string };
  row: (item: T) => ReactNode;
  reloadKey: number;
}) {
  const data = useAsyncData(load);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    data.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={onNew}>
          <Plus className="h-4 w-4" aria-hidden /> {newLabel}
        </button>
      </div>
      {data.status === 'loading' ? (
        <Skeleton className="h-48" />
      ) : data.status === 'error' ? (
        <LoadError message={data.error.message} onRetry={data.reload} />
      ) : data.data.length ? (
        <ul className="divide-y divide-line/70 overflow-hidden rounded-2xl border border-line bg-surface">
          {data.data.map((item) => (
            <li key={item.id}>
              <button type="button" className="tap flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-raised" onClick={() => onEdit(item)}>
                {row(item)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={empty.icon} title={empty.title}>
          {empty.body}
        </EmptyState>
      )}
    </div>
  );
}

const State = ({ on, children }: { on: boolean; children: ReactNode }) => (
  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${on ? 'bg-status-in/15 text-status-in' : 'bg-surface-sunken text-muted'}`}>{children}</span>
);

/**
 * Guest page (guest.manage): the stories, fundraisers and merch guests see, and the messages
 * they send. Opened from the Admin group and from guest-message notifications (?tab=inbox).
 */
export function GuestAdminPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'inbox') as Tab;
  const setTab = (t: Tab) => setParams((p) => (p.set('tab', t), p), { replace: true });
  const [note, setNote] = useState<AnnouncementDraft | null>(null);
  const [hotline, setHotline] = useState<HotlineDraft | null>(null);
  const [prayer, setPrayer] = useState<PrayerDraft | null>(null);
  const [story, setStory] = useState<StoryDraft | null>(null);
  const [drive, setDrive] = useState<DriveDraft | null>(null);
  const [item, setItem] = useState<MerchDraft | null>(null);
  const [reload, setReload] = useState(0);
  const saved = () => {
    setNote(null);
    setHotline(null);
    setPrayer(null);
    setStory(null);
    setDrive(null);
    setItem(null);
    setReload((n) => n + 1);
  };
  const loaders = useMemo(() => ({ hotlines: () => guestService.allHotlines(), prayer: () => guestService.allPrayers(), news: () => guestService.allAnnouncements(), stories: () => guestService.allStories(), drives: () => guestService.allDrives(), merch: () => guestService.allMerch() }), []);

  if (!can('guest.manage'))
    return (
      <p className="notice text-ink-soft" role="alert">
        The guest page is managed by coordinators and administrators.
      </p>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Guest page" className="relative flex gap-1 overflow-x-auto rounded-xl bg-surface-sunken p-1">
          <SlidingPill className="rounded-lg bg-surface-raised shadow-sm shadow-black/30 ring-1 ring-inset ring-ink/[0.06]" />
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className="tap relative z-10 min-h-9 shrink-0 rounded-lg px-3 text-sm font-semibold text-ink-soft transition-colors duration-500 aria-selected:text-ink"
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {guestService.source === 'mock' && <SampleBadge />}
          {/* In the app itself (a new tab would leave the installed app for the browser). */}
          <Link to="/guest" className="link text-sm">
            Open the guest page <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      {tab === 'inbox' && <InboxTab />}
      {tab === 'community' && <CommunityReview />}
      {tab === 'news' && (
        <>
          <p className="text-sm text-ink-soft">Your announcements sit above the typhoon, flood and earthquake alerts, which keep coming in from GDACS and USGS on their own.</p>
          <ListTab<GuestAnnouncement>
            load={loaders.news}
            reloadKey={reload}
            newLabel="New announcement"
            onNew={() => setNote(blankAnnouncement())}
            onEdit={(a) => setNote({ id: a.id, title: a.title, body: a.body, level: a.level, area: a.area ?? '', linkUrl: a.linkUrl ?? '', isPublished: a.isPublished, expiresAt: a.expiresAt })}
            empty={{ icon: Megaphone, title: 'No announcements yet', body: 'Post where relief is being handed out, an evacuation site that opened, or an advisory for an area.' }}
            row={(a) => {
              const live = isLive(a);
              return (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{a.title}</span>
                    <span className="block truncate text-xs text-muted">
                      <span className={a.level === 'urgent' ? 'font-semibold text-status-out' : a.level === 'advisory' ? 'font-semibold text-status-low' : ''}>{announcementLevelLabel(a.level)}</span>
                      {a.area ? `, ${a.area}` : ''}
                      {a.isPublished && a.expiresAt ? `, ${live ? 'until' : 'ended'} ${formatShortDate(phDate(a.expiresAt))}` : ''}
                    </span>
                  </span>
                  <State on={live}>{live ? 'Live' : a.isPublished ? 'Ended' : 'Draft'}</State>
                </>
              );
            }}
          />
        </>
      )}
      {tab === 'hotlines' && (
        <>
          <p className="text-sm text-ink-soft">Numbers guests can tap to call on the Hotlines screen. Add your provincial and city disaster offices, and check numbers now and then: agencies change them.</p>
          <ListTab<GuestHotline>
            load={loaders.hotlines}
            reloadKey={reload}
            newLabel="New hotline"
            onNew={() => setHotline(blankHotline(100))}
            onEdit={(h) => setHotline({ ...h, note: h.note ?? '', area: h.area ?? '' })}
            empty={{ icon: Phone, title: 'No hotlines yet', body: 'Add the numbers people should call in an emergency, nationwide and in your areas.' }}
            row={(h) => (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{h.name}</span>
                  <span className="block truncate text-xs tabular-nums text-muted">
                    {h.number}, {h.area ?? 'nationwide'}
                  </span>
                </span>
                <State on={h.isListed}>{h.isListed ? 'Shown' : 'Hidden'}</State>
              </>
            )}
          />
        </>
      )}
      {tab === 'prayer' && (
        <>
          <p className="text-sm text-ink-soft">Prayer points for Pray with us: an area going through a disaster, a response, the people serving. Guests can press “I prayed”.</p>
          <ListTab<GuestPrayer>
            load={loaders.prayer}
            reloadKey={reload}
            newLabel="New prayer point"
            onNew={() => setPrayer(blankPrayer())}
            onEdit={(x) => setPrayer({ id: x.id, title: x.title, body: x.body, area: x.area ?? '', isPublished: x.isPublished })}
            empty={{ icon: HeartHandshake, title: 'No prayer points yet', body: 'Post the first one: who to pray for this week, and why.' }}
            row={(x) => (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{x.title}</span>
                  <span className="block truncate text-xs tabular-nums text-muted">
                    {x.prayedCount === 1 ? '1 prayed' : `${x.prayedCount.toLocaleString('en-PH')} prayed`}
                    {x.area ? `, ${x.area}` : ''}
                  </span>
                </span>
                <State on={x.isPublished}>{x.isPublished ? 'Published' : 'Draft'}</State>
              </>
            )}
          />
        </>
      )}
      {tab === 'stories' && (
        <ListTab<GuestStory>
          load={loaders.stories}
          reloadKey={reload}
          newLabel="New story"
          onNew={() => setStory(blankStory())}
          onEdit={(s) => setStory({ id: s.id, title: s.title, summary: s.summary ?? '', body: s.body, kind: s.kind, place: s.place ?? '', coverUrl: s.coverUrl, authorName: s.authorName ?? '', isPublished: s.isPublished })}
          empty={{ icon: BookOpen, title: 'No stories yet', body: 'Write the first one: a response, a family you met, or what volunteers did this week.' }}
          row={(s) => (
            <>
              <Picture src={s.coverUrl} alt="" icon={BookOpen} className="h-12 w-16 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-base font-semibold text-ink">{s.title}</span>
                <span className="block truncate text-xs text-muted">
                  {STORY_KINDS.find((k) => k.key === s.kind)?.label}
                  {s.publishedAt ? `, published ${formatShortInstant(s.publishedAt)}` : `, edited ${formatShortInstant(s.updatedAt)}`}
                </span>
              </span>
              <State on={s.isPublished}>{s.isPublished ? 'Published' : 'Draft'}</State>
            </>
          )}
        />
      )}
      {tab === 'drives' && (
        <ListTab<DonationDrive>
          load={loaders.drives}
          reloadKey={reload}
          newLabel="New fundraiser"
          onNew={() => setDrive(blankDrive())}
          onEdit={(d) => setDrive({ ...d, summary: d.summary ?? '', impactNote: d.impactNote ?? '', howToGive: d.howToGive ?? '', report: d.report ?? '' })}
          empty={{ icon: HandCoins, title: 'No fundraisers yet', body: 'Start one when there is a need: say what it’s for, the goal and how to give.' }}
          row={(d) => (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{d.title}</span>
                <span className="block truncate text-xs tabular-nums text-muted">
                  {amount(d.raised, d.unit)} of {amount(d.goal, d.unit)} ({Math.min(100, Math.round((d.raised / d.goal) * 100))}%)
                  {d.endsOn ? `, ends ${formatShortDate(d.endsOn)}` : ''}
                </span>
              </span>
              <State on={d.status === 'open'}>{d.status === 'open' ? 'Open' : d.status === 'closed' ? 'Closed' : 'Draft'}</State>
            </>
          )}
        />
      )}
      {tab === 'merch' && (
        <ListTab<MerchItem>
          load={loaders.merch}
          reloadKey={reload}
          newLabel="New item"
          onNew={() => setItem(blankMerch(Math.floor(Date.now() / 1000)))}
          onEdit={(m) => setItem({ ...m, description: m.description ?? '' })}
          empty={{ icon: Shirt, title: 'No merch yet', body: 'Add shirts, caps or anything else guests can order.' }}
          row={(m) => (
            <>
              <Picture src={m.imageUrl} alt="" icon={Shirt} className="h-12 w-12 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{m.name}</span>
                <span className="block truncate text-xs text-muted">
                  {m.price !== null ? `₱${m.price.toLocaleString('en-PH')}` : 'No price'}
                  {m.inStock ? '' : ', out of stock'}
                </span>
              </span>
              <State on={m.isListed}>{m.isListed ? 'Shown' : 'Hidden'}</State>
            </>
          )}
        />
      )}

      <AnnouncementEditor draft={note} onClose={() => setNote(null)} onSaved={saved} />
      <HotlineEditor draft={hotline} onClose={() => setHotline(null)} onSaved={saved} />
      <PrayerEditor draft={prayer} onClose={() => setPrayer(null)} onSaved={saved} />
      <StoryEditor draft={story} onClose={() => setStory(null)} onSaved={saved} />
      <DriveEditor draft={drive} onClose={() => setDrive(null)} onSaved={saved} />
      <MerchEditor draft={item} onClose={() => setItem(null)} onSaved={saved} />
    </div>
  );
}


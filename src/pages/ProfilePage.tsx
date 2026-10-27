import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Briefcase, Camera, Check, Loader2, Lock, Phone, Pipette, Trash2, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { BADGE_ICON, FRAME_RING, FRAME_TEXT } from '../components/tasks/taskMeta';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { formatNumber, initialsOf } from '../lib/format';
import { badgesFor, levelFor } from '../lib/taskProgress';
import { profileService } from '../services';
import { PhotoCropper } from '../components/profile/PhotoCropper';
import { AVATAR_COLORS, openPicture, type PersonProfile, type ProfilePatch, type ProfileProgress } from '../services/profiles/profileService';

const DEFAULT_COLOR = '#7a0b0b';

/** /profile: your own, editable with a live preview. /profile/:id: a colleague's profile card. */
export function ProfilePage() {
  const { id } = useParams();
  const { profile: me, can, updateProfile } = useAuth();
  const targetId = id ?? me?.id ?? null;
  const mine = Boolean(me && targetId === me.id);
  const [person, setPerson] = useState<PersonProfile | null | undefined>(undefined);
  const [progress, setProgress] = useState<ProfileProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    if (!targetId) return;
    setError(null);
    setPerson(undefined);
    setProgress(null);
    profileService.get(targetId).then(setPerson, (e: Error) => setError(e.message));
    // Badges are a bonus: if they can't load, the profile still shows.
    profileService.progress(targetId).then(setProgress, () => setProgress(null));
  };
  useEffect(load, [targetId]);

  if (error) return <LoadError message={error} onRetry={load} />;
  if (person === undefined) return <ProfileSkeleton />;
  if (!person)
    return (
      <EmptyState icon={UserRound} title="This profile isn’t here" action={<Link to="/profile" className="btn-ghost min-h-10 px-4 text-sm">Your profile</Link>}>
        The account may have been removed.
      </EmptyState>
    );
  if (mine || can('staff.manage'))
    return (
      <EditProfile
        key={person.id}
        person={person}
        progress={progress}
        mine={mine}
        onSaved={(p) => {
          setPerson(p);
          if (mine) updateProfile({ displayName: p.displayName, fullName: p.fullName, jobTitle: p.jobTitle, phone: p.phone, bio: p.bio, avatar: p.avatar, avatarColor: p.avatarColor });
        }}
      />
    );
  return (
    <div className="mx-auto w-full max-w-xl">
      <ProfileCard person={person} progress={progress} />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line/70 bg-surface">
      <Skeleton className="h-32 rounded-none" />
      <div className="flex flex-col gap-3 p-5 pt-16">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

// ───────────────────────── The card ─────────────────────────

const memberSince = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso)) : null;

/**
 * A profile the way a Discord profile reads: a banner in the person's colour, the picture
 * overlapping it (ringed in their level's frame), badges beside it, then who they are.
 * `showLocked` lists badges not earned yet with their progress (your own profile only).
 */
function ProfileCard({ person: p, progress, showLocked = false, narrow = false }: { person: PersonProfile; progress: ProfileProgress | null; showLocked?: boolean; narrow?: boolean }) {
  const strip = narrow ? 5 : 8;
  const color = p.avatarColor ?? DEFAULT_COLOR;
  const level = progress ? levelFor(progress.xp) : null;
  const badges = progress ? badgesFor(progress.stats) : [];
  const earned = badges.filter((b) => b.earned);
  const since = memberSince(p.memberSince);
  return (
    <article className="overflow-hidden rounded-2xl border border-line/70 bg-surface shadow-[0_24px_60px_-28px_rgba(0,0,0,0.8)]" aria-label={`${p.displayName}’s profile`}>
      <div
        className="relative h-28 sm:h-32"
        style={{ background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 55%, #1c1d21) 100%)` }}
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgba(255,255,255,0.18),transparent_55%)]" />
      </div>

      <div className="relative px-4 pb-4 sm:px-5">
        <div className="flex items-end justify-between gap-3">
          <div className="-mt-14 rounded-full bg-surface p-1.5">
            <Avatar initials={p.initials} src={p.avatar} color={p.avatarColor} size="xl" ring={`ring-4 ${FRAME_RING[level?.frame ?? 'none']}`} />
          </div>
          {earned.length > 0 && (
            <ul className="mb-1 flex max-w-[60%] flex-wrap justify-end gap-1 rounded-xl border border-line/70 bg-surface-sunken p-1.5" aria-label="Badges">
              {earned.slice(0, strip).map(({ badge }) => {
                const Icon = BADGE_ICON[badge.icon];
                return (
                  <li key={badge.id} title={`${badge.name}: ${badge.description}`} className="grid h-7 w-7 place-items-center rounded-lg text-uplift">
                    <Icon className="h-[1.05rem] w-[1.05rem]" aria-hidden />
                    <span className="sr-only">{badge.name}</span>
                  </li>
                );
              })}
              {earned.length > strip && <li className="grid h-7 place-items-center px-1 text-xs font-semibold text-muted">+{earned.length - strip}</li>}
            </ul>
          )}
        </div>

        <div className="mt-3">
          <h2 className="break-words text-2xl font-bold leading-tight">{p.displayName || 'Your name'}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            {[p.fullName !== p.displayName ? p.fullName : null, p.jobTitle].filter(Boolean).join(' · ') || p.roleName}
          </p>
          {level && (
            <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full border border-line/70 bg-surface-sunken px-2.5 py-1 text-xs font-semibold ${FRAME_TEXT[level.frame]}`}>
              Level {level.level} · {level.title}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-4 rounded-xl border border-line/50 bg-surface-sunken p-4">
          <Section title="About me">
            {p.bio ? <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft">{p.bio}</p> : <p className="text-sm text-muted">No bio yet.</p>}
          </Section>

          <div className="grid grid-cols-2 gap-4">
            {since && (
              <Section title="Member since">
                <p className="text-sm text-ink-soft">{since}</p>
              </Section>
            )}
            {p.phone && (
              <Section title="Phone">
                <a href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`} className="text-sm text-ink-soft underline-offset-2 hover:text-uplift hover:underline">
                  {p.phone}
                </a>
              </Section>
            )}
          </div>

          {(p.roleName || p.office) && (
            <Section title="Role">
              <ul className="flex flex-wrap gap-1.5">
                {[p.roleName, p.office].filter(Boolean).map((r, i) => (
                  <li key={r} className="inline-flex items-center gap-1.5 rounded-md border border-line/70 bg-surface px-2 py-1 text-xs font-medium text-ink-soft">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: i === 0 ? color : '#9a9ca6' }} aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {level && progress && (
            <Section title="Level">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className={`font-semibold ${FRAME_TEXT[level.frame]}`}>{formatNumber(progress.xp)} XP</span>
                <span className="text-muted">{level.next ? `${formatNumber(level.toNext)} XP to ${level.next.title}` : 'Top level'}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-raised" role="progressbar" aria-label="Progress to the next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)}>
                <div className="h-full rounded-full bg-uplift" style={{ width: `${Math.max(3, level.progress * 100)}%` }} />
              </div>
              {progress.stats.streak > 1 && <p className="mt-1.5 text-xs text-muted">{progress.stats.streak}-day streak · {formatNumber(progress.stats.total)} tasks done</p>}
            </Section>
          )}

          {progress && (showLocked || earned.length > 0) && (
            <Section title={`Badges · ${earned.length} of ${badges.length}`}>
              <ul className={`grid grid-cols-1 gap-2 ${narrow ? '' : 'sm:grid-cols-2'}`}>
                {(showLocked ? badges : earned).map(({ badge, value, earned: got }) => {
                  const Icon = BADGE_ICON[badge.icon];
                  return (
                    <li key={badge.id} className={`flex items-center gap-2.5 rounded-lg border p-2 ${got ? 'border-uplift/30 bg-uplift/[0.07]' : 'border-line/60 bg-surface/60'}`} title={badge.description}>
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${got ? 'bg-uplift/15 text-uplift' : 'bg-surface-raised text-ink-mute'}`}>
                        {got ? <Icon className="h-4 w-4" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-xs font-semibold ${got ? 'text-ink' : 'text-ink-soft'}`}>{badge.name}</span>
                        <span className="block truncate text-[0.6875rem] text-muted">{got ? badge.description : `${value} of ${badge.target}`}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
          {progress && !showLocked && earned.length === 0 && (
            <Section title="Badges">
              <p className="text-sm text-muted">No badges yet. They come from finishing tasks.</p>
            </Section>
          )}
        </div>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-soft">{title}</h3>
      {children}
    </section>
  );
}

// ───────────────────────── Editing ─────────────────────────

function EditProfile({ person, progress, mine, onSaved }: { person: PersonProfile; progress: ProfileProgress | null; mine: boolean; onSaved: (p: PersonProfile) => void }) {
  const uid = useId();
  const file = useRef<HTMLInputElement>(null);
  const start = useMemo<ProfilePatch>(
    () => ({
      fullName: person.fullName,
      displayName: person.displayName,
      jobTitle: person.jobTitle ?? '',
      phone: person.phone ?? '',
      bio: person.bio ?? '',
      avatar: person.avatar,
      avatarColor: person.avatarColor,
    }),
    [person],
  );
  const [d, setD] = useState<ProfilePatch>(start);
  const [busy, setBusy] = useState(false);
  const [picBusy, setPicBusy] = useState(false);
  /** A new photo being positioned. */
  const [cropping, setCropping] = useState<HTMLImageElement | null>(null);
  const closeCropper = () =>
    setCropping((img) => {
      if (img) URL.revokeObjectURL(img.src);
      return null;
    });
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const set = <K extends keyof ProfilePatch>(k: K, v: ProfilePatch[K]) => setD((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(d) !== JSON.stringify(start);

  // What the card looks like with the changes so far.
  const preview: PersonProfile = {
    ...person,
    ...d,
    displayName: d.displayName.trim() || person.displayName,
    fullName: d.fullName.trim() || d.displayName.trim(),
    initials: initialsOf(d.displayName.trim() || '?'),
    jobTitle: d.jobTitle.trim() || null,
    phone: d.phone.trim() || null,
    bio: d.bio.trim() || null,
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setPicBusy(true);
    setMessage(null);
    try {
      setCropping(await openPicture(f));
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'That photo couldn’t be used.', error: true });
    } finally {
      setPicBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await profileService.save(person.id, d);
      onSaved({ ...preview, displayName: d.displayName.trim() });
      setMessage({ text: 'Saved. Your profile is up to date.' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Not saved.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const customColor = d.avatarColor && !AVATAR_COLORS.includes(d.avatarColor);

  return (
    <form
      className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_26rem]"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) void save();
      }}
      noValidate
    >
      <div className="flex min-w-0 flex-col gap-4">
        {!mine && (
          <p className="rounded-xl border border-uplift/30 bg-uplift/10 px-4 py-3 text-sm text-ink-soft">
            You’re editing {person.displayName}’s profile as an administrator.
          </p>
        )}

        <section className="card flex flex-col gap-5">
          <EditGroup title="Profile picture">
            <input ref={file} type="file" accept="image/*" className="sr-only" onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary min-h-11 px-4" onClick={() => file.current?.click()} disabled={picBusy}>
                {picBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />} {d.avatar ? 'Change photo' : 'Upload a photo'}
              </button>
              {d.avatar && (
                <button type="button" className="btn-ghost min-h-11 px-4" onClick={() => set('avatar', null)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Remove photo
                </button>
              )}
            </div>
          </EditGroup>

          <hr className="border-line/70" />

          <EditGroup title="Profile colour">
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Profile colour">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={d.avatarColor === c}
                  aria-label={`Colour ${c}`}
                  onClick={() => set('avatarColor', c)}
                  className={`grid h-10 w-10 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-surface transition ${d.avatarColor === c ? 'ring-ink' : 'ring-transparent hover:ring-line'}`}
                  style={{ background: c }}
                >
                  {d.avatarColor === c && <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />}
                </button>
              ))}
              <label
                className={`relative grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-dashed border-ink-mute ring-2 ring-offset-2 ring-offset-surface ${customColor ? 'ring-ink' : 'ring-transparent'}`}
                style={customColor ? { background: d.avatarColor! } : undefined}
                title="Any colour"
              >
                <Pipette className="h-4 w-4 text-ink" aria-hidden />
                <span className="sr-only">Choose any colour</span>
                <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={d.avatarColor ?? DEFAULT_COLOR} onChange={(e) => set('avatarColor', e.target.value)} />
              </label>
            </div>
          </EditGroup>
        </section>

        <section className="card flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={`${uid}-display`} label="Name on the portal">
              <input id={`${uid}-display`} className="field" maxLength={60} value={d.displayName} onChange={(e) => set('displayName', e.target.value)} autoComplete="nickname" />
            </Field>
            <Field id={`${uid}-full`} label="Full name">
              <input id={`${uid}-full`} className="field" maxLength={120} value={d.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field id={`${uid}-job`} label="Position" hint="Optional">
              <span className="relative block">
                <Briefcase className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input id={`${uid}-job`} className="field pl-10" maxLength={100} value={d.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="e.g. Field officer" />
              </span>
            </Field>
            <Field id={`${uid}-phone`} label="Phone" hint="Optional">
              <span className="relative block">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input id={`${uid}-phone`} type="tel" className="field pl-10" maxLength={30} value={d.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+63 9xx xxx xxxx" autoComplete="tel" />
              </span>
            </Field>
          </div>
          <Field id={`${uid}-bio`} label="About me" hint={`${d.bio.length} / 500`}>
            <textarea
              id={`${uid}-bio`}
              className="field min-h-32"
              rows={5}
              maxLength={500}
              value={d.bio}
              onChange={(e) => set('bio', e.target.value)}
              placeholder="A few words about you and your work with PHILRADS."
            />
          </Field>
          {message && (
            <p role={message.error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${message.error ? 'border-status-out/40 bg-status-out/10' : 'border-status-in/40 bg-status-in/10'}`}>
              {message.text}
            </p>
          )}
        </section>
      </div>

      <aside className="order-first flex flex-col gap-2 lg:order-none lg:sticky lg:top-24 lg:self-start" aria-label="Preview">
        <p className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-soft">
          Preview {profileService.source === 'mock' && <SampleBadge />}
        </p>
        <ProfileCard person={preview} progress={progress} showLocked={mine} narrow />
      </aside>

      <PhotoCropper
        image={cropping}
        onCancel={closeCropper}
        onApply={(url) => {
          set('avatar', url);
          closeCropper();
        }}
      />

      {/* Like Discord: a bar that appears while there are changes to save. */}
      <div
        className={`fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-2xl items-center gap-3 rounded-2xl p-3 pl-4 transition duration-300 glass ${dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
        aria-hidden={!dirty}
      >
        <p className="min-w-0 flex-1 text-sm font-medium">You have changes that aren’t saved yet.</p>
        <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => (setD(start), setMessage(null))} disabled={busy} tabIndex={dirty ? 0 : -1}>
          Undo
        </button>
        <button type="submit" className="btn-primary min-h-10 px-4 text-sm" disabled={busy || !dirty} tabIndex={dirty ? 0 : -1}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Save changes
        </button>
      </div>
    </form>
  );
}

function EditGroup({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-soft">{title}</h3>
        {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink-soft">
          {label}
        </label>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

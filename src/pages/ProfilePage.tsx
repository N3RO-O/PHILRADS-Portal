import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Briefcase, Camera, Check, ChevronDown, Globe2, Loader2, Lock, Phone, Pipette, Trash2, UserRound } from 'lucide-react';
import { ChoiceSwitch } from '../components/ui/ChoiceSwitch';
import { ThemeSwitch } from '../components/ui/ThemeSwitch';
import { useTheme } from '../lib/theme';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { FRAME_RING, FRAME_TEXT } from '../components/tasks/taskMeta';
import { Avatar } from '../components/ui/Avatar';
import { AvatarFrame } from '../components/ui/AvatarFrame';
import { ViewPhoto } from '../components/ui/PhotoViewer';
import { AVATAR_FRAMES, frameUnlocked, hasAllFrames, type AvatarFrameInfo } from '../lib/avatarFrames';
import { EmptyState, LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { Dialog } from '../components/ui/Dialog';
import { formatNumber, initialsOf } from '../lib/format';
import { BADGES, RARITY_LABEL, badgesFor, bestBadges, levelFor } from '../lib/taskProgress';
import { Medal } from '../components/tasks/Medal';
import { profileService } from '../services';
import { PhotoCropper } from '../components/profile/PhotoCropper';
import { BusyLabel } from '../components/ui/BusyLabel';
import { AVATAR_COLORS, openPicture, type PersonProfile, type ProfilePatch, type ProfileProgress } from '../services/profiles/profileService';

const DEFAULT_COLOR = '#7a0b0b';

/** /profile: your own, editable with a live preview. /profile/:id: a colleague's profile card. */
export function ProfilePage() {
  const { id } = useParams();
  const { profile: me, updateProfile } = useAuth();
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
  // Only the person edits their own profile (the database enforces it too).
  if (mine)
    return (
      <EditProfile
        key={person.id}
        person={person}
        progress={progress}
        mine={mine}
        onSaved={(p) => {
          setPerson(p);
          if (mine) updateProfile({ displayName: p.displayName, fullName: p.fullName, jobTitle: p.jobTitle, phone: p.phone, bio: p.bio, avatar: p.avatar, avatarColor: p.avatarColor, avatarFrame: p.avatarFrame });
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
function ProfileCard({
  person: p,
  progress,
  showLocked = false,
  narrow = false,
  onPhoto,
}: {
  person: PersonProfile;
  progress: ProfileProgress | null;
  showLocked?: boolean;
  narrow?: boolean;
  /** Your own profile: the picture is the button to change it. */
  onPhoto?: () => void;
}) {
  const color = p.avatarColor ?? DEFAULT_COLOR;
  const level = progress ? levelFor(progress.xp) : null;
  const badges = progress ? badgesFor(progress.stats) : [];
  const earned = badges.filter((b) => b.earned);
  const best = bestBadges(badges);
  const since = memberSince(p.memberSince);
  const [openBadge, setOpenBadge] = useState<string | null>(null);
  const shown = badges.find((b) => b.badge.id === openBadge) ?? null;
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface" aria-label={`${p.displayName}’s profile`}>
      <div
        className="relative h-28 sm:h-32"
        style={{ background: color }}
        aria-hidden
      />

      <div className="relative px-4 pb-4 sm:px-5">
        <div className="flex items-end justify-between gap-3">
          {onPhoto ? (
            <button type="button" onClick={onPhoto} className="group relative -mt-14 rounded-full bg-surface p-1.5" aria-label="Change your photo" title="Change your photo">
              <AvatarFrame frame={p.avatarFrame}>
                <Avatar initials={p.initials} src={p.avatar} color={p.avatarColor} size="xl" ring={`ring-4 ${FRAME_RING[level?.frame ?? 'none']}`} />
              </AvatarFrame>
              <PhotoOverlay />
            </button>
          ) : (
            <ViewPhoto id={p.id} name={p.displayName} subtitle={p.jobTitle || undefined} profileLink={false} className="-mt-14 bg-surface p-1.5">
              <AvatarFrame frame={p.avatarFrame}>
                <Avatar initials={p.initials} src={p.avatar} color={p.avatarColor} size="xl" ring={`ring-4 ${FRAME_RING[level?.frame ?? 'none']}`} />
              </AvatarFrame>
            </ViewPhoto>
          )}
          {earned.length > 0 && (
            <ul className="mb-1 flex items-center gap-1.5" aria-label="Best badges">
              {best.slice(0, 3).map(({ badge }) => (
                <li key={badge.id}>
                  <button type="button" title={`${badge.name} · ${RARITY_LABEL[badge.rarity]}`} onClick={() => setOpenBadge(badge.id)} className="grid place-items-center rounded-full transition hover:scale-105" aria-label={`${badge.name}, ${RARITY_LABEL[badge.rarity]}. Show details`}>
                    <Medal badge={badge} earned size="md" />
                  </button>
                </li>
              ))}
              {earned.length > 3 && <li className="grid h-7 place-items-center px-1 text-xs font-semibold text-muted">+{earned.length - 3}</li>}
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

        {!p.details ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-line/50 bg-surface-sunken px-4 py-8 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ink/[0.06] text-muted">
              <Lock className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm font-semibold text-ink">{p.displayName.split(' ')[0]} keeps their profile private</p>
            <p className="max-w-xs text-xs text-muted">You can still give them tasks and see the tasks they’ve been given in the Active list.</p>
          </div>
        ) : (
        <div className="mt-4 flex flex-col gap-4 rounded-xl border border-line/50 bg-surface-sunken p-4">
          {!p.isPublic && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Lock className="h-3.5 w-3.5" aria-hidden /> Private: only {showLocked ? 'you' : 'they'} and administrators see these details.
            </p>
          )}
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
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: i === 0 ? color : 'rgb(var(--ink-mute))' }} aria-hidden />
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
              {/* Compact: one icon per badge with a ring showing progress; tap for the details. */}
              <ul className={`grid gap-x-1 gap-y-2.5 ${narrow ? 'grid-cols-5' : 'grid-cols-5 sm:grid-cols-6'}`}>
                {(showLocked ? badges : earned).map(({ badge, value, earned: got }) => {
                  return (
                    <li key={badge.id}>
                      <button
                        type="button"
                        onClick={() => setOpenBadge(badge.id)}
                        aria-label={`${badge.name}, ${RARITY_LABEL[badge.rarity]}: ${got ? 'earned' : `${value} of ${badge.target}`}. Show details`}
                        className="tap group flex w-full flex-col items-center gap-1 rounded-lg p-1 text-center hover:bg-ink/[0.04]"
                      >
                        <Medal badge={badge} earned={got} value={value} size="md" />
                        <span className={`line-clamp-2 text-[0.625rem] font-semibold leading-tight ${got ? 'text-ink' : 'text-muted'}`}>{badge.name}</span>
                        {got && <span className={`text-[0.5625rem] font-bold uppercase tracking-wider rarity-${badge.rarity}`}>{RARITY_LABEL[badge.rarity]}</span>}
                      </button>
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
        )}
      </div>
      {shown && <BadgeDetails item={shown} mine={showLocked} onClose={() => setOpenBadge(null)} />}
    </article>
  );
}

/** One badge: what it's for, and how far along (or when it was earned). */
function BadgeDetails({ item: { badge, value, earned }, mine, onClose }: { item: ReturnType<typeof badgesFor>[number]; mine: boolean; onClose: () => void }) {
  const pct = Math.min(100, Math.round((value / badge.target) * 100));
  return (
    <Dialog open title={badge.name} onClose={onClose}>
      <div className="flex flex-col items-center gap-4 pb-2 text-center">
        <Medal badge={badge} earned={earned} value={value} size="xl" />
        <p className={`-mt-1 text-xs font-bold uppercase tracking-[0.12em] rarity-${badge.rarity}`}>{RARITY_LABEL[badge.rarity]}</p>
        <p className="text-sm text-ink-soft">{badge.description}</p>
        {earned ? (
          <p className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft">
            <Check className="h-3.5 w-3.5" aria-hidden /> Earned
          </p>
        ) : (
          <div className="w-full max-w-xs">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold text-ink">
                {formatNumber(value)} of {formatNumber(badge.target)}
              </span>
              <span className="text-muted">{formatNumber(badge.target - value)} to go</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-raised" role="progressbar" aria-label={`${badge.name} progress`} aria-valuemin={0} aria-valuemax={badge.target} aria-valuenow={value}>
              <div className="h-full rounded-full bg-uplift" style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
            {mine && <p className="mt-2 text-xs text-muted">Badges come from tasks you finish in Tasks.</p>}
          </div>
        )}
      </div>
    </Dialog>
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
      avatarFrame: person.avatarFrame,
      isPublic: person.isPublic,
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
  const choosePhoto = () => file.current?.click();

  return (
    <div className="mx-auto w-full max-w-5xl [container-type:inline-size]">
    <form
      className="grid grid-cols-1 gap-6 pb-24 [@container(min-width:50rem)]:grid-cols-[minmax(0,1fr)_22rem] [@container(min-width:60rem)]:grid-cols-[minmax(0,1fr)_26rem]"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) void save();
      }}
      noValidate
    >
      <div className="flex min-w-0 flex-col gap-4 [container-type:inline-size]">
        {!mine && (
          <p className="rounded-xl border border-line bg-surface-sunken px-4 py-3 text-sm text-ink-soft">
            You’re editing {person.displayName}’s profile as an administrator.
          </p>
        )}

        <section className="card flex flex-col gap-5">
          <EditGroup title="Profile picture">
            <input ref={file} type="file" accept="image/*" className="sr-only" onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
            <div className="flex items-center gap-4">
              {/* The picture is the button: tap it to choose a new one. */}
              <button
                type="button"
                className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uplift focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                onClick={choosePhoto}
                disabled={picBusy}
                aria-busy={picBusy || undefined}
                aria-label={d.avatar ? 'Change your photo' : 'Add a photo'}
                title={d.avatar ? 'Change your photo' : 'Add a photo'}
              >
                <AvatarFrame frame={d.avatarFrame}>
                  <Avatar initials={preview.initials} src={d.avatar} color={d.avatarColor} size="lg" ring="ring-2 ring-line" />
                </AvatarFrame>
                <PhotoOverlay busy={picBusy} small />
              </button>
              <p className="min-w-0 flex-1 text-xs text-muted">{d.avatar ? 'Tap your photo to change it.' : 'Tap to add a photo, so the team knows you in Active.'}</p>
              {d.avatar && (
                <button type="button" className="icon-btn h-10 w-10 shrink-0 text-muted hover:text-status-out" onClick={() => set('avatar', null)} aria-label="Remove photo" title="Remove photo">
                  <Trash2 className="h-[1.125rem] w-[1.125rem]" aria-hidden />
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

          <hr className="border-line/70" />

          <FramePicker
            value={d.avatarFrame ?? null}
            onChange={(f) => set('avatarFrame', f)}
            progress={progress}
            avatar={<Avatar initials={preview.initials} src={d.avatar} color={d.avatarColor} size="md" ring="ring-0" />}
          />
        </section>

        <section className="card flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 [@container(min-width:32rem)]:grid-cols-2">
            <Field id={`${uid}-display`} label="Name on the portal">
              <input id={`${uid}-display`} className="field" maxLength={60} value={d.displayName} onChange={(e) => set('displayName', e.target.value)} autoComplete="nickname" />
            </Field>
            <Field id={`${uid}-full`} label="Full name">
              <input id={`${uid}-full`} className="field" maxLength={120} value={d.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 [@container(min-width:32rem)]:grid-cols-2">
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
          {/* Visibility: the chosen one is filled, with its icon, so it's clear which is on. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line/70 pt-4">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">
                Your profile is {d.isPublic ? 'public' : 'private'}
              </span>
              <span className="block text-xs text-muted">{d.isPublic ? 'Everyone at PHILRADS sees your details.' : 'Colleagues see only your name, picture and role.'}</span>
            </span>
            <ChoiceSwitch
              label="Who can see your profile"
              value={d.isPublic}
              onChange={(v) => set('isPublic', v)}
              options={[
                { value: true, label: 'Public', icon: Globe2 },
                { value: false, label: 'Private', icon: Lock },
              ]}
            />
          </div>
          <ThemeRow />
          {message && (
            <p role={message.error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${message.error ? 'border-status-out/40 bg-status-out/10' : 'border-status-in/40 bg-status-in/10'}`}>
              {message.text}
            </p>
          )}
        </section>
      </div>

      <aside
        className="order-first mx-auto flex w-full max-w-xl flex-col gap-2 [@container(min-width:50rem)]:mx-0 [@container(min-width:50rem)]:max-w-none [@container(min-width:50rem)]:sticky [@container(min-width:50rem)]:top-24 [@container(min-width:50rem)]:order-none [@container(min-width:50rem)]:self-start"
        aria-label="Preview"
      >
        <p className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-soft">
          Preview {profileService.source === 'mock' && <SampleBadge />}
        </p>
        <ProfileCard person={preview} progress={progress} showLocked={mine} narrow onPhoto={choosePhoto} />
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
        className={`fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-2xl items-center gap-3 rounded-2xl p-3 pl-4 transition duration-300 floating ${dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
        aria-hidden={!dirty}
      >
        <p className="min-w-0 flex-1 text-sm font-medium">You have changes that aren’t saved yet.</p>
        <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => (setD(start), setMessage(null))} disabled={busy} tabIndex={dirty ? 0 : -1}>
          Undo
        </button>
        <button type="submit" className="btn-primary min-h-10 px-4 text-sm" disabled={busy || !dirty} tabIndex={dirty ? 0 : -1} aria-busy={busy || undefined}>
          <BusyLabel busy={busy} busyText="Saving…">Save changes</BusyLabel>
        </button>
      </div>
    </form>
    </div>
  );
}

/** The camera badge on a picture you can change (and a dim veil on hover). */
function PhotoOverlay({ busy = false, small = false }: { busy?: boolean; small?: boolean }) {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors group-hover:bg-black/35" />
      <span
        aria-hidden
        className={`pointer-events-none absolute grid place-items-center rounded-full border-2 border-surface bg-uplift text-onaccent shadow-lg transition-transform group-hover:scale-110 group-active:scale-95 ${small ? '-bottom-0.5 -right-0.5 h-6 w-6' : 'bottom-0 right-0 h-8 w-8'}`}
      >
        {busy ? <Loader2 className={`${small ? 'h-3 w-3' : 'h-4 w-4'} animate-spin`} /> : <Camera className={small ? 'h-3 w-3' : 'h-4 w-4'} />}
      </span>
    </>
  );
}

const unlockText = (f: AvatarFrameInfo) =>
  !f.unlock ? '' : 'role' in f.unlock ? 'Administrators only' : 'level' in f.unlock ? `Reach Level ${f.unlock.level}` : `Earn “${BADGES.find((b) => b.id === (f.unlock as { badge: string }).badge)?.name ?? 'a badge'}”`;

/**
 * Avatar frame: folded to the one you wear, opened to change it. Still and moving ones; some are
 * earned with a level or a badge (shown locked, with what unlocks them, until then).
 */
function FramePicker({ value, onChange, progress, avatar }: { value: string | null; onChange: (f: string | null) => void; progress: ProfileProgress | null; avatar: ReactNode }) {
  const [open, setOpen] = useState(false);
  const auth = useAuth();
  const role = auth.profile?.roleKey;
  const all = hasAllFrames(auth.state.status === 'signed-in' ? auth.state.session.user.email : null);
  const level = progress ? levelFor(progress.xp).level : 1;
  const badges = useMemo(() => new Set(progress ? badgesFor(progress.stats).filter((b) => b.earned).map((b) => b.badge.id) : []), [progress]);
  const current = AVATAR_FRAMES.find((f) => f.id === value) ?? null;
  const exclusive = (f: AvatarFrameInfo) => Boolean(f.unlock && 'role' in f.unlock);
  const groups: [string, AvatarFrameInfo[]][] = [
    ['Exclusive', AVATAR_FRAMES.filter((f) => exclusive(f) && frameUnlocked(f, level, badges, role, all))],
    ['Still', AVATAR_FRAMES.filter((f) => !exclusive(f) && !f.animated)],
    ['Moving', AVATAR_FRAMES.filter((f) => !exclusive(f) && f.animated)],
  ];
  // Frames for other roles aren't shown or counted.
  const offered = AVATAR_FRAMES.filter((f) => !exclusive(f) || frameUnlocked(f, level, badges, role, all));
  const unlockedCount = offered.filter((f) => frameUnlocked(f, level, badges, role, all)).length;

  // A plain render function, not a component made inside this one: a component defined here would be
  // a new type on every render, so each pick would rebuild every tile (pictures, filters, motion).
  const option = (f: AvatarFrameInfo | null) => {
    const id = f?.id ?? null;
    const on = value === id;
    const locked = Boolean(f && !frameUnlocked(f, level, badges, role, all));
    return (
      <button
        key={id ?? 'none'}
        type="button"
        role="radio"
        aria-checked={on}
        aria-disabled={locked}
        title={locked && f ? `${f.name}: ${unlockText(f)}` : f?.name ?? 'No frame'}
        onClick={() => !locked && onChange(id)}
        className={`press group flex min-w-0 flex-col items-center gap-2.5 rounded-xl border px-1 pb-2 pt-3.5 transition-colors ${
          on ? 'border-burgundy-400 bg-burgundy-500/25' : locked ? 'cursor-not-allowed border-transparent' : 'border-transparent hover:bg-ink/[0.04]'
        }`}
      >
        <span className={`relative ${locked ? 'opacity-40 grayscale' : ''}`}>
          <AvatarFrame frame={id} motion={on ? 'always' : 'hover'}>{avatar}</AvatarFrame>
        </span>
        <span className={`flex w-full min-w-0 items-center justify-center gap-1 text-[0.6875rem] font-semibold ${on ? 'text-uplift' : 'text-muted'}`}>
          {locked && <Lock className="h-3 w-3 shrink-0" aria-hidden />}
          <span className="truncate">{f?.name ?? 'None'}</span>
        </span>
        {locked && f && <span className="-mt-1.5 w-full truncate text-center text-[0.625rem] leading-tight text-muted">{unlockText(f)}</span>}
      </button>
    );
  };

  return (
    <EditGroup title="Avatar frame" note="A ring around your picture wherever it shows: Active, tasks, your profile.">
      <button
        type="button"
        className="press flex items-center gap-4 rounded-xl border border-line px-3 py-3 text-left transition-colors hover:bg-ink/[0.04]"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center">
          <AvatarFrame frame={value}>{avatar}</AvatarFrame>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{current?.name ?? 'No frame'}</span>
          <span className="block text-xs text-muted">
            {unlockedCount} of {offered.length} unlocked
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-uplift">
          {open ? 'Done' : 'Change'}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Avatar frame">
          <div className="grid grid-cols-4 gap-1.5 [@container(min-width:26rem)]:grid-cols-5 [@container(min-width:34rem)]:grid-cols-7">
            {option(null)}
          </div>
          {groups.filter(([, frames]) => frames.length).map(([title, frames]) => (
            <div key={title} className="flex flex-col gap-1.5">
              <p className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-muted">{title}</p>
              <div className="grid grid-cols-4 gap-1.5 [@container(min-width:26rem)]:grid-cols-5 [@container(min-width:34rem)]:grid-cols-7">
                {frames.map((f) => option(f))}
              </div>
            </div>
          ))}
        </div>
      )}
    </EditGroup>
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

/** Light or dark: saved on this device straight away (no Save needed). */
function ThemeRow() {
  const theme = useTheme();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line/70 pt-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">Appearance</span>
        <span className="block text-xs text-muted">{theme === 'system' ? 'Follows this device’s setting.' : `${theme === 'light' ? 'Light' : 'Dark'} on this device.`} Saved straight away.</span>
      </span>
      <ThemeSwitch />
    </div>
  );
}

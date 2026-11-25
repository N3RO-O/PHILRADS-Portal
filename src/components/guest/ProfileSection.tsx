import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Award, Camera, Check, Eye, EyeOff, Loader2, LogOut, Pipette, Trash2 } from 'lucide-react';
import { useGuestAccount, type GuestMe } from '../../services/guest/account';
import { AVATAR_COLORS, openPicture } from '../../services/profiles/profileService';
import { initialsOf } from '../../lib/format';
import { useTheme } from '../../lib/theme';
import { Avatar } from '../ui/Avatar';
import { BusyLabel } from '../ui/BusyLabel';
import { ChoiceSwitch } from '../ui/ChoiceSwitch';
import { DoneCheck } from '../ui/DoneCheck';
import { ThemeSwitch } from '../ui/ThemeSwitch';
import { PhotoCropper } from '../profile/PhotoCropper';
import { GuestSection } from './guestUi';
import { SignInPrompt } from './SignInPrompt';

const DEFAULT_COLOR = '#7a0b0b';

/** What a guest card shows: the same in the profile preview and in Who's here. */
export interface GuestCardPerson {
  name: string;
  initials: string;
  avatar: string | null;
  color: string | null;
  bio: string;
}

/**
 * A guest's card, built like a staff profile card: their colour across the top, the picture over
 * it, the name, a line about them, and badges (coming soon).
 */
export function GuestCard({ person: p, here = false, onPhoto }: { person: GuestCardPerson; here?: boolean; onPhoto?: () => void }) {
  const avatar = <Avatar initials={p.initials} src={p.avatar} color={p.color} size="xl" ring="ring-4 ring-surface" />;
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface" aria-label={`${p.name}’s profile`}>
      <div className="h-24 sm:h-28" style={{ background: p.color ?? DEFAULT_COLOR }} aria-hidden />
      <div className="px-4 pb-4 sm:px-5">
        {onPhoto ? (
          <button type="button" onClick={onPhoto} className="group relative -mt-12 rounded-full" aria-label="Change your photo" title="Change your photo">
            {avatar}
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors group-hover:bg-black/25" />
          </button>
        ) : (
          <span className="relative -mt-12 inline-block">{avatar}</span>
        )}
        <h2 className="mt-2 break-words text-2xl font-bold leading-tight text-ink">{p.name || 'Your name'}</h2>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
          Guest
          {here && (
            <>
              <span aria-hidden>·</span>
              <span className="h-2 w-2 rounded-full bg-status-in" aria-hidden /> Here now
            </>
          )}
        </p>
        <div className="mt-4 flex flex-col gap-4 rounded-xl border border-line/50 bg-surface-sunken p-4">
          <CardSection title="About me">
            {p.bio.trim() ? <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-soft">{p.bio}</p> : <p className="text-sm text-muted">Nothing yet.</p>}
          </CardSection>
          <CardSection title="Badges">
            <div className="flex items-center gap-3">
              <span className="flex -space-x-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-ink-mute/60 bg-surface text-ink-mute">
                    <Award className="h-4 w-4" />
                  </span>
                ))}
              </span>
              <span className="text-sm text-muted">Coming soon</span>
            </div>
          </CardSection>
        </div>
      </div>
    </article>
  );
}

function CardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-soft">{title}</h3>
      {children}
    </section>
  );
}

/**
 * A guest's own profile, edited the way staff edit theirs: the card as a live preview, the picture
 * and colour, the name and a line about them, Who's here and light or dark, and a bar that
 * appears to save once something changed.
 */
export function ProfileSection() {
  const { status, me, staff } = useGuestAccount();
  if (staff)
    return (
      <GuestSection id="me" title="Your profile">
        <p className="text-sm text-ink-soft">
          You’re signed in as PHILRADS staff.{' '}
          <Link to="/profile" className="font-semibold text-uplift hover:underline">
            Open your profile
          </Link>
        </p>
      </GuestSection>
    );
  if (status !== 'in' || !me)
    return (
      <GuestSection id="me" title="Your profile">
        <SignInPrompt title="Make it yours" body="Sign in to choose your name and picture." />
      </GuestSection>
    );
  return <ProfileForm key={me.id} me={me} />;
}

function ProfileForm({ me }: { me: GuestMe }) {
  const uid = useId();
  const { save, signOut, shown, setShown } = useGuestAccount();
  const start = { name: me.name, bio: me.bio, color: me.color, avatar: me.avatar };
  const [d, setD] = useState(start);
  const set = <K extends keyof typeof start>(k: K, v: (typeof start)[K]) => setD((x) => ({ ...x, [k]: v }));
  const [cropping, setCropping] = useState<HTMLImageElement | null>(null);
  const [picBusy, setPicBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const dirty = d.name.trim() !== me.name || d.bio.trim() !== me.bio || d.color !== me.color || d.avatar !== me.avatar;
  const preview: GuestCardPerson = { ...d, name: d.name.trim() || me.name, initials: initialsOf(d.name.trim() || me.name) };
  const customColor = d.color && !AVATAR_COLORS.includes(d.color);

  const closeCropper = () =>
    setCropping((img) => {
      if (img) URL.revokeObjectURL(img.src);
      return null;
    });
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setPicBusy(true);
    setError(null);
    try {
      setCropping(await openPicture(f));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That photo couldn’t be used.');
    } finally {
      setPicBusy(false);
    }
  };
  const choosePhoto = () => file.current?.click();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setError(null);
    try {
      await save(d);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your profile couldn’t be saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="me" aria-label="Your profile" className="mx-auto w-full max-w-5xl [container-type:inline-size]">
      <form
        onSubmit={submit}
        noValidate
        className="grid grid-cols-1 gap-6 pb-24 [@container(min-width:50rem)]:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="flex min-w-0 flex-col gap-4">
          <section className="card flex flex-col gap-5">
            <Group title="Profile picture">
              <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
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
                  <Avatar initials={preview.initials} src={d.avatar} color={d.color} size="lg" ring="ring-2 ring-line" />
                  <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-black/0 transition-colors group-hover:bg-black/35" />
                  <span aria-hidden className="pointer-events-none absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-surface bg-uplift text-onaccent shadow-lg transition-transform group-hover:scale-110 group-active:scale-95">
                    {picBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                  </span>
                </button>
                <p className="min-w-0 flex-1 text-xs text-muted">{d.avatar ? 'Tap your photo to change it.' : 'Tap to add a photo, or use your initials on a colour.'}</p>
                {d.avatar && (
                  <button type="button" className="icon-btn h-10 w-10 shrink-0 text-muted hover:text-status-out" onClick={() => set('avatar', null)} aria-label="Remove photo" title="Remove photo">
                    <Trash2 className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                  </button>
                )}
              </div>
            </Group>

            <hr className="border-line/70" />

            <Group title="Profile colour">
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Profile colour">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={d.color === c}
                    aria-label={`Colour ${c}`}
                    onClick={() => set('color', c)}
                    className={`grid h-10 w-10 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-surface transition ${d.color === c ? 'ring-ink' : 'ring-transparent hover:ring-line'}`}
                    style={{ background: c }}
                  >
                    {d.color === c && <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />}
                  </button>
                ))}
                <label
                  className={`relative grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-dashed border-ink-mute ring-2 ring-offset-2 ring-offset-surface ${customColor ? 'ring-ink' : 'ring-transparent'}`}
                  style={customColor ? { background: d.color! } : undefined}
                  title="Any colour"
                >
                  <Pipette className="h-4 w-4 text-ink" aria-hidden />
                  <span className="sr-only">Choose any colour</span>
                  <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={d.color ?? DEFAULT_COLOR} onChange={(e) => set('color', e.target.value)} />
                </label>
              </div>
            </Group>
          </section>

          <section className="card flex flex-col gap-4">
            <Field id={`${uid}-name`} label="Name others see" hint={`${d.name.length} / 40`}>
              <input id={`${uid}-name`} className="field" value={d.name} maxLength={40} onChange={(e) => set('name', e.target.value)} autoComplete="nickname" />
            </Field>
            <Field id={`${uid}-bio`} label="About me" hint={`${d.bio.length} / 160`}>
              <textarea id={`${uid}-bio`} className="field min-h-24" rows={3} value={d.bio} maxLength={160} onChange={(e) => set('bio', e.target.value)} placeholder="From Tacloban. Praying for the families in Cagayan." />
            </Field>
            <Row title={shown ? 'You’re shown in Who’s here' : 'You’re hidden from Who’s here'} note={shown ? 'Others see your name and picture.' : 'You’re counted, never named.'}>
              <ChoiceSwitch
                label="Show me in Who’s here"
                value={shown}
                onChange={setShown}
                options={[
                  { value: true, label: 'Shown', icon: Eye },
                  { value: false, label: 'Hidden', icon: EyeOff },
                ]}
              />
            </Row>
            <ThemeRow />
            <div className="flex justify-end border-t border-line/70 pt-4">
              <button type="button" className="btn-ghost min-h-10 gap-1.5 px-3 text-sm" onClick={() => void signOut()}>
                <LogOut className="h-4 w-4" aria-hidden /> Sign out
              </button>
            </div>
            {error && (
              <p role="alert" className="rounded-xl border border-status-out/40 bg-status-out/10 px-4 py-3 text-sm">
                {error}
              </p>
            )}
          </section>
        </div>

        <aside
          aria-label="Preview"
          className="order-first mx-auto flex w-full max-w-xl flex-col gap-2 [@container(min-width:50rem)]:sticky [@container(min-width:50rem)]:top-24 [@container(min-width:50rem)]:order-none [@container(min-width:50rem)]:mx-0 [@container(min-width:50rem)]:max-w-none [@container(min-width:50rem)]:self-start"
        >
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-soft">Preview</p>
          <GuestCard person={preview} here={shown} onPhoto={choosePhoto} />
        </aside>

        <PhotoCropper
          image={cropping}
          onCancel={closeCropper}
          onApply={(url) => {
            set('avatar', url);
            closeCropper();
          }}
        />

        {/* As on the staff profile: a bar that appears while there are changes to save (above the tab bar on phones). */}
        <div
          className={`fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 mx-auto flex w-[calc(100%-2rem)] max-w-2xl items-center gap-3 rounded-2xl p-3 pl-4 transition duration-300 floating lg:bottom-4 ${dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}
          aria-hidden={!dirty}
        >
          <p className="min-w-0 flex-1 text-sm font-medium">You have changes that aren’t saved yet.</p>
          <button type="button" className="btn-ghost min-h-10 px-3 text-sm" onClick={() => (setD(start), setError(null))} disabled={busy} tabIndex={dirty ? 0 : -1}>
            Undo
          </button>
          <button type="submit" className="btn-primary min-h-10 px-4 text-sm" disabled={busy || !dirty} tabIndex={dirty ? 0 : -1} aria-busy={busy || undefined}>
            <BusyLabel busy={busy} busyText="Saving…">
              Save changes
            </BusyLabel>
          </button>
        </div>
        <SavedPop at={savedAt} />
      </form>
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-soft">{title}</h3>
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
        {hint && <span className="text-xs tabular-nums text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line/70 pt-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-muted">{note}</span>
      </span>
      {children}
    </div>
  );
}

/** Light or dark: saved on this device straight away (no Save needed). */
function ThemeRow() {
  const theme = useTheme();
  return (
    <Row title="Appearance" note={`${theme === 'system' ? 'Follows this device.' : `${theme === 'light' ? 'Light' : 'Dark'} on this device.`} Saved straight away.`}>
      <ThemeSwitch />
    </Row>
  );
}

/** After a save: a check that draws itself in a card that pops up, then slips away. */
function SavedPop({ at }: { at: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!at) return;
    setShown(at);
    const t = setTimeout(() => setShown(0), 2600);
    return () => clearTimeout(t);
  }, [at]);
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex justify-center lg:bottom-5" role="status" aria-live="polite">
      {shown > 0 && (
        <div key={shown} className="saved-pop flex items-center gap-3 rounded-2xl border border-status-in/40 bg-surface-raised py-3 pl-3 pr-5 shadow-2xl shadow-black/60">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-status-in/15 text-status-in">
            <DoneCheck className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-sm font-bold text-ink">Profile saved</span>
            <span className="block text-xs text-muted">Others see it now.</span>
          </span>
        </div>
      )}
    </div>
  );
}

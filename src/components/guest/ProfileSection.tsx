import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, LogOut, Trash2 } from 'lucide-react';
import { useGuestAccount, type GuestMe } from '../../services/guest/account';
import { AVATAR_COLORS, openPicture } from '../../services/profiles/profileService';
import { initialsOf } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { BusyLabel } from '../ui/BusyLabel';
import { PhotoCropper } from '../profile/PhotoCropper';
import { GuestSection } from './guestUi';
import { SignInPrompt } from './SignInPrompt';

/**
 * A guest's own profile: their picture (or initials on a colour), the name others see in
 * "Who's here", a line about them, and whether to be shown there at all.
 */
export function ProfileSection() {
  const { status, me, staff } = useGuestAccount();
  if (staff)
    return (
      <GuestSection id="me" title="Your profile">
        <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink-soft">
          You’re signed in as PHILRADS staff, so every guest page is open to you. Your profile is in the portal:{' '}
          <Link to="/profile" className="font-semibold text-uplift hover:underline">
            open your profile
          </Link>
          .
        </p>
      </GuestSection>
    );
  if (status !== 'in' || !me)
    return (
      <GuestSection id="me" title="Your profile" lead="Sign in to set up how others see you here.">
        <SignInPrompt title="Make it yours" body="Sign in with Google to choose your name and picture, read every story, pray with us, and see who else is here." />
      </GuestSection>
    );

  return <ProfileForm key={me.id} me={me} />;
}

function ProfileForm({ me }: { me: GuestMe }) {
  const { save, signOut, shown, setShown } = useGuestAccount();
  const [name, setName] = useState(me.name);
  const [bio, setBio] = useState(me.bio);
  const [color, setColor] = useState<string | null>(me.color);
  const [avatar, setAvatar] = useState<string | null>(me.avatar);
  const [cropping, setCropping] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const changed = name.trim() !== me.name || bio.trim() !== me.bio || color !== me.color || avatar !== me.avatar;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await save({ name, bio, color, avatar });
      setMsg({ ok: true, text: 'Saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Your profile couldn’t be saved.' });
    } finally {
      setBusy(false);
    }
  };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    try {
      setCropping(await openPicture(f));
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'That photo couldn’t be used.' });
    }
  };

  return (
    <GuestSection id="me" title="Your profile" lead="This is how other guests see you in Who’s here. PHILRADS staff can see it too.">
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => file.current?.click()} className="tap group relative shrink-0 rounded-full" aria-label="Choose a picture">
            <Avatar initials={initialsOf(name.trim() || me.name)} src={avatar} color={color} size="xl" ring="ring-2 ring-line" />
            <span className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink shadow transition-transform group-hover:scale-105" aria-hidden>
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void pick(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm text-ink-soft">A picture, or your initials on a colour.</p>
            {avatar && (
              <button type="button" className="hit inline-flex items-center gap-1.5 self-start text-xs font-semibold text-muted hover:text-ink" onClick={() => setAvatar(null)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove picture
              </button>
            )}
          </div>
        </div>

        {!avatar && (
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Colour</legend>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-pressed={color === c}
                  aria-label={`Colour ${c}`}
                  className={`tap grid h-9 w-9 place-items-center rounded-full ring-offset-2 ring-offset-page transition-shadow ${color === c ? 'ring-2 ring-ink' : ''}`}
                  style={{ background: c }}
                >
                  {color === c && <Check className="h-4 w-4 text-white" aria-hidden />}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Name others see</span>
          <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">
            A line about you <span className="font-normal text-muted">(optional)</span>
          </span>
          <input className="field" value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} placeholder="From Tacloban. Praying for the families in Cagayan." />
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[rgb(var(--uplift))]" checked={shown} onChange={(e) => setShown(e.target.checked)} />
          <span>
            <span className="block text-sm font-semibold text-ink">Show me in Who’s here</span>
            <span className="block text-xs text-muted">Others see your name and picture while you have this page open. Off: you’re counted, never named.</span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy || !changed}>
            <BusyLabel busy={busy} busyText="Saving…">
              Save profile
            </BusyLabel>
          </button>
          {msg && (
            <p role="status" className={`text-sm ${msg.ok ? 'text-status-in' : 'text-status-out'}`}>
              {msg.text}
            </p>
          )}
          <button type="button" className="chip ml-auto min-h-10 gap-1.5" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      </form>
      <PhotoCropper
        image={cropping}
        onCancel={() => setCropping(null)}
        onApply={(url) => {
          setAvatar(url);
          setCropping(null);
        }}
      />
    </GuestSection>
  );
}

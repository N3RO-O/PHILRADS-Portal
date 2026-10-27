import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Briefcase, Camera, Check, Loader2, Phone, Trash2, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthProvider';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, LoadError, Skeleton } from '../components/ui/Card';
import { SampleBadge } from '../components/ui/SampleBadge';
import { initialsOf } from '../lib/format';
import { profileService } from '../services';
import { AVATAR_COLORS, squarePicture, type PersonProfile, type ProfilePatch } from '../services/profiles/profileService';

/** /profile: your own, editable. /profile/:id: a colleague's, to read. */
export function ProfilePage() {
  const { id } = useParams();
  const { profile: me, can, updateProfile } = useAuth();
  const targetId = id ?? me?.id ?? null;
  const mine = Boolean(me && targetId === me.id);
  const [person, setPerson] = useState<PersonProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    if (!targetId) return;
    setError(null);
    profileService.get(targetId).then(setPerson, (e: Error) => setError(e.message));
  };
  useEffect(load, [targetId]);

  if (error) return <LoadError message={error} onRetry={load} />;
  if (person === undefined) return <Skeleton className="h-96" />;
  if (!person)
    return (
      <EmptyState icon={UserRound} title="This profile isn’t here" action={<Link to="/profile" className="btn-ghost min-h-10 px-4 text-sm">Your profile</Link>}>
        The account may have been removed.
      </EmptyState>
    );
  return mine || can('staff.manage') ? (
    <EditProfile
      person={person}
      mine={mine}
      onSaved={(p) => {
        setPerson(p);
        if (mine) updateProfile({ displayName: p.displayName, fullName: p.fullName, jobTitle: p.jobTitle, phone: p.phone, bio: p.bio, avatar: p.avatar, avatarColor: p.avatarColor });
      }}
    />
  ) : (
    <ViewProfile person={person} />
  );
}

function ViewProfile({ person: p }: { person: PersonProfile }) {
  return (
    <section className="card mx-auto flex w-full max-w-2xl flex-col items-center gap-4 p-6 text-center">
      <Avatar initials={p.initials} src={p.avatar} color={p.avatarColor} size="xl" />
      <div>
        <h2 className="text-2xl font-bold">{p.fullName}</h2>
        <p className="text-sm text-muted">{[p.jobTitle, p.roleName, p.office].filter(Boolean).join(' · ')}</p>
      </div>
      {p.bio ? <p className="max-w-lg whitespace-pre-line text-sm leading-relaxed text-ink-soft">{p.bio}</p> : <p className="text-sm text-muted">No bio yet.</p>}
      {p.phone && (
        <a href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`} className="btn-ghost min-h-11 px-4">
          <Phone className="h-4 w-4" aria-hidden /> {p.phone}
        </a>
      )}
    </section>
  );
}

function EditProfile({ person, mine, onSaved }: { person: PersonProfile; mine: boolean; onSaved: (p: PersonProfile) => void }) {
  const uid = useId();
  const file = useRef<HTMLInputElement>(null);
  const start: ProfilePatch = {
    fullName: person.fullName,
    displayName: person.displayName,
    jobTitle: person.jobTitle ?? '',
    phone: person.phone ?? '',
    bio: person.bio ?? '',
    avatar: person.avatar,
    avatarColor: person.avatarColor,
  };
  const [d, setD] = useState<ProfilePatch>(start);
  const [busy, setBusy] = useState(false);
  const [picBusy, setPicBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const set = <K extends keyof ProfilePatch>(k: K, v: ProfilePatch[K]) => setD((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(d) !== JSON.stringify(start);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setPicBusy(true);
    setMessage(null);
    try {
      set('avatar', await squarePicture(f));
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
      const next = { ...person, ...d, fullName: d.fullName.trim() || d.displayName.trim(), displayName: d.displayName.trim(), initials: initialsOf(d.displayName), jobTitle: d.jobTitle.trim() || null, phone: d.phone.trim() || null, bio: d.bio.trim() || null };
      onSaved(next);
      setMessage({ text: 'Saved. Your profile is up to date.' });
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Not saved.', error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="mx-auto flex w-full max-w-2xl flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <section className="card flex flex-col items-center gap-4 p-6 text-center">
        <div className="relative">
          <Avatar initials={initialsOf(d.displayName || '?')} src={d.avatar} color={d.avatarColor} size="xl" />
          {picBusy && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
            </span>
          )}
        </div>
        <input ref={file} type="file" accept="image/*" className="sr-only" onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-ghost min-h-11 px-4" onClick={() => file.current?.click()} disabled={picBusy}>
            <Camera className="h-4 w-4" aria-hidden /> {d.avatar ? 'Change photo' : 'Add a photo'}
          </button>
          {d.avatar && (
            <button type="button" className="btn-ghost min-h-11 px-4 text-status-out" onClick={() => set('avatar', null)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Remove photo
            </button>
          )}
        </div>
        {!d.avatar && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted">Or choose a colour for your initials</p>
            <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Badge colour">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={d.avatarColor === c}
                  aria-label={`Colour ${c}`}
                  onClick={() => set('avatarColor', c)}
                  className={`grid h-9 w-9 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-surface transition ${d.avatarColor === c ? 'ring-ink' : 'ring-transparent'}`}
                  style={{ background: c }}
                >
                  {d.avatarColor === c && <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-muted">
          {[person.roleName, person.office].filter(Boolean).join(' · ')} {mine ? '' : '· editing as an administrator'} {profileService.source === 'mock' && <SampleBadge />}
        </p>
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id={`${uid}-full`} label="Full name">
            <input id={`${uid}-full`} className="field" maxLength={120} value={d.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" />
          </Field>
          <Field id={`${uid}-display`} label="Name on the portal">
            <input id={`${uid}-display`} className="field" maxLength={60} value={d.displayName} onChange={(e) => set('displayName', e.target.value)} autoComplete="nickname" />
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
        <Field id={`${uid}-bio`} label="Bio" hint={`${d.bio.length} / 500`}>
          <textarea
            id={`${uid}-bio`}
            className="field min-h-28"
            rows={4}
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
        <button type="submit" className="btn-primary h-12 text-base" disabled={busy || !dirty}>
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />} {dirty ? 'Save profile' : 'Saved'}
        </button>
      </section>
    </form>
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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGuestAccount, type Here } from '../../services/guest/account';
import { Avatar } from '../ui/Avatar';
import { Dialog } from '../ui/Dialog';
import { Sheet } from '../ui/Sheet';
import { GuestCard } from './ProfileSection';
import { SignInPrompt } from './SignInPrompt';

const hereText = (n: number) => (n === 1 ? '1 here' : `${n.toLocaleString('en-PH')} here`);

/** The faces of signed-in guests here now (up to three), overlapping. */
export function Faces({ max = 3, size = 'sm' as const }: { max?: number; size?: 'xs' | 'sm' }) {
  const { here } = useGuestAccount();
  const shown = here.people.slice(0, max);
  if (!shown.length) return null;
  return (
    <span className="flex -space-x-2" aria-hidden>
      {shown.map((p) => (
        <Avatar key={p.id} initials={p.initials} src={p.avatar} color={p.color} size={size} ring="ring-2 ring-page" />
      ))}
    </span>
  );
}

/**
 * "Who's here", as the staff portal shows who's online: a live count in the top bar, and for
 * signed-in guests the names and pictures of the others here now.
 */
export function WhoIsHere() {
  const { here, unlocked, me, shown } = useGuestAccount();
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState<Here['people'][number] | null>(null);
  const others = here.count - here.people.length;
  return (
    <>
      {/* The press area is the bar's full height on phones; the pill inside matches the avatar beside it. */}
      <button type="button" onClick={() => setOpen(true)} className="tap group grid place-items-center" aria-label={`Who’s here: ${hereText(here.count)}`}>
        <span className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border border-line pl-2.5 pr-3 text-xs font-semibold text-ink-soft transition-colors group-hover:border-ink-mute group-hover:text-ink">
          <span className="relative grid h-2.5 w-2.5 place-items-center" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-status-in/60 motion-reduce:animate-none" />
            <span className="relative h-2 w-2 rounded-full bg-status-in" />
          </span>
          {unlocked && <Faces size="xs" />}
          {/* The narrowest phones show just the number, so the bar fits. */}
          <span className="tabular-nums">
            {here.count.toLocaleString('en-PH')}
            <span className="hidden min-[360px]:inline"> here</span>
          </span>
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Who’s here" subtitle={`${hereText(here.count)} on the PHILRADS guest page right now`}>
        {!unlocked ? (
          <SignInPrompt compact title="See who’s here" body="Sign in to see the names and pictures of other guests here now, and to be seen yourself." />
        ) : (
          <div className="flex flex-col gap-4">
            {here.people.length > 0 && (
              <ul className="-mx-2 flex flex-col">
                {here.people.map((p) => (
                  <li key={p.id}>
                    {/* Tap someone for their card, as staff open a colleague in the Active list. */}
                    <button type="button" onClick={() => setPerson(p)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-ink/[0.04]">
                      <span className="relative shrink-0">
                        <Avatar initials={p.initials} src={p.avatar} color={p.color} size="md" />
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-status-in ring-2 ring-surface" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">
                          {p.name}
                          {p.me && <span className="ml-1.5 font-normal text-muted">(you)</span>}
                        </span>
                        {p.bio && <span className="block truncate text-xs text-muted">{p.bio}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {others > 0 && (
              <p className="text-sm text-ink-soft">
                {here.people.length ? 'And ' : ''}
                {others === 1 ? '1 visitor' : `${others.toLocaleString('en-PH')} visitors`} not signed in.
              </p>
            )}
            {me && !shown && <p className="text-sm text-muted">You’re hidden from this list.</p>}
            {me && (
              <Link to="/guest/me" onClick={() => setOpen(false)} className="link self-start text-sm">
                Change how you appear
              </Link>
            )}
          </div>
        )}
      </Sheet>
      <Dialog open={person !== null} title={person ? person.name : ''} onClose={() => setPerson(null)}>
        {person && <GuestCard person={person} here />}
        {person?.me && (
          <Link to="/guest/me" onClick={() => (setPerson(null), setOpen(false))} className="btn-primary mt-4 w-full">
            Edit your profile
          </Link>
        )}
      </Dialog>
    </>
  );
}

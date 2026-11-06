import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { initialsOf } from '../../lib/format';
import { useSmoothNavigate } from '../../lib/smoothNavigate';
import { AvatarFrame } from './AvatarFrame';
import { usePicture } from './PersonAvatar';
import { useBackdropClose } from './Sheet';

/** Someone's picture, big, in its frame, with their name and a way to their profile. */
function PhotoDialog({
  id,
  name,
  subtitle,
  profileLink,
  onLeave,
  onClose,
}: {
  id: string;
  name: string;
  subtitle?: ReactNode;
  profileLink: boolean;
  onLeave?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pic = usePicture(id);
  const go = useSmoothNavigate();
  const backdrop = useBackdropClose(ref, onClose);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={`${name}’s picture`}
      onClose={onClose}
      {...backdrop.handlers}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] animate-pop-in overflow-visible bg-transparent p-0 text-ink backdrop:animate-fade-in backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5 px-2 pb-2 pt-6">
        <AvatarFrame frame={pic?.frame}>
          {pic?.avatar ? (
            <img
              src={pic.avatar}
              alt={`${name}’s profile picture`}
              className="block h-[min(16rem,62vw)] w-[min(16rem,62vw)] rounded-full object-cover shadow-2xl shadow-black/60"
            />
          ) : (
            <span
              role="img"
              aria-label={`${name} has no picture yet`}
              className={`grid h-[min(16rem,62vw)] w-[min(16rem,62vw)] place-items-center rounded-full text-6xl font-semibold tracking-wide text-white shadow-2xl shadow-black/60 ${pic?.color ? '' : 'bg-burgundy-600'}`}
              style={pic?.color ? { background: pic.color } : undefined}
            >
              {initialsOf(name || '?')}
            </span>
          )}
        </AvatarFrame>
        <div className="text-center text-white">
          <p className="text-lg font-semibold leading-tight">{name}</p>
          {subtitle && <p className="mt-0.5 text-sm text-white/70">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {profileLink && (
            <button
              type="button"
              className="btn-primary min-h-10 gap-1.5 px-4 text-sm"
              onClick={() =>
                go(`/profile/${id}`, undefined, () => {
                  onClose();
                  onLeave?.();
                })
              }
              autoFocus
            >
              View profile <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20"
            onClick={onClose}
            aria-label="Close"
            autoFocus={!profileLink}
          >
            <X className="h-[1.125rem] w-[1.125rem]" aria-hidden />
          </button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Wraps a picture so tapping it shows it big (PhotoDialog). For other people's pictures: in the
 * task sheet, on a profile. `profileLink` off on their own profile page; `onLeave` closes whatever
 * the picture sat in (a sheet) on the way to their profile.
 */
export function ViewPhoto({
  id,
  name,
  subtitle,
  profileLink = true,
  onLeave,
  children,
  className = '',
}: {
  id: string;
  name: string;
  subtitle?: ReactNode;
  profileLink?: boolean;
  onLeave?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`press rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uplift ${className}`}
        onClick={() => setOpen(true)}
        aria-label={`See ${name}’s picture`}
        title={`See ${name}’s picture`}
      >
        {children}
      </button>
      {open && <PhotoDialog id={id} name={name} subtitle={subtitle} profileLink={profileLink} onLeave={onLeave} onClose={() => setOpen(false)} />}
    </>
  );
}

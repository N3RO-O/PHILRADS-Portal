import { useEffect, useMemo } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useAsyncData } from '../../hooks/useAsyncData';
import { usePresence } from '../../lib/presence';
import { staffBoardService } from '../../services';
import { PersonAvatar } from '../ui/PersonAvatar';
import { StatusDot } from '../ui/StatusDot';

const SHOWN = 3;

/**
 * The Active button in the top bar: the faces of who's on right now (up to three, then "+n"),
 * updating as people come and go. It opens or hides the Active list. With no one else on: the icon.
 */
export function ActiveFaces({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { profile } = useAuth();
  const presence = usePresence();
  const board = useAsyncData(() => staffBoardService.board());
  // Names for new people: read the team again now and then (pictures come with the faces).
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && board.reload(), 5 * 60_000);
    return () => clearInterval(t);
  }, [board.reload]);

  const team = board.status === 'success' ? board.data : [];
  const others = useMemo(() => {
    const names = new Map(team.map((p) => [p.id, p.name]));
    return presence.activeIds.filter((id) => id !== profile?.id && names.has(id)).map((id) => ({ id, name: names.get(id)! }));
  }, [team, presence.activeIds, profile?.id]);

  const label = others.length
    ? `${others.length} other${others.length === 1 ? '' : 's'} active: ${others.map((p) => p.name).join(', ')}. ${shown ? 'Hide' : 'Show'} the Active list`
    : shown
      ? 'Hide the Active list'
      : 'Show who’s active';

  if (!others.length)
    return (
      <button type="button" className={`icon-btn ${shown ? 'bg-surface-raised text-ink' : ''}`} onClick={onToggle} aria-pressed={shown} aria-label={label} title={label}>
        <Users className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      </button>
    );

  const faces = others.slice(0, SHOWN);
  const more = others.length - faces.length;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={label}
      title={label}
      className={`press flex h-10 shrink-0 items-center gap-1.5 rounded-xl pl-1.5 pr-2 transition-colors hover:bg-surface-raised ${shown ? 'bg-surface-raised' : ''}`}
    >
      <span className="flex items-center">
        {faces.map((p, i) => (
          <span key={p.id} className={`relative rounded-full ring-2 ring-page animate-fade-in ${i ? '-ml-2' : ''}`} style={{ zIndex: SHOWN - i }}>
            <PersonAvatar id={p.id} name={p.name} size="sm" ring="ring-0" frame={false} />
            {i === faces.length - 1 && <StatusDot status={presence.statusOf(p.id)} size={11} ring="rgb(var(--page))" className="absolute -bottom-0.5 -right-0.5" />}
          </span>
        ))}
      </span>
      {more > 0 && <span className="text-xs font-semibold tabular-nums text-ink-soft">+{more}</span>}
    </button>
  );
}

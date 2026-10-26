import { ArrowRight, FolderOpen, Package, SquareCheckBig, UsersRound } from 'lucide-react';
import { FOCUS_OPTIONS, type Focus } from '../../lib/onboarding';
import { useAuth } from '../auth/AuthProvider';
import { Sheet } from '../ui/Sheet';

const ICON: Record<Focus, typeof Package> = { task: SquareCheckBig, stock: Package, file: FolderOpen, invite: UsersRound };

interface Props {
  open: boolean;
  onAnswer: (focus: Focus) => void;
  onSkip: () => void;
}

/** The one first-run question. One tap answers it; "Skip for now" is remembered and never nags. */
export function WelcomeQuestion({ open, onAnswer, onSkip }: Props) {
  const { profile, can } = useAuth();
  const options = FOCUS_OPTIONS.filter((o) => !o.permission || can(o.permission));
  const first = profile?.displayName.split(/\s+/)[0];
  return (
    <Sheet
      open={open}
      onClose={onSkip}
      title={first ? `Welcome, ${first}` : 'Welcome'}
      subtitle="One question, then you’re in. We’ll put that first for you."
      footer={
        <button type="button" className="btn-ghost h-12 w-full" onClick={onSkip}>
          Skip for now
        </button>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-3 text-base font-semibold text-ink">What will you mostly use the portal for?</legend>
        {options.map(({ focus, label, note }) => {
          const Icon = ICON[focus];
          return (
            <button
              key={focus}
              type="button"
              onClick={() => onAnswer(focus)}
              className="tap group flex min-h-16 items-center gap-4 rounded-2xl border border-line/70 bg-surface-sunken px-4 py-3 text-left transition hover:border-uplift/60 hover:bg-uplift/[0.06] focus-visible:border-uplift"
            >
              <span className="icon-chip h-10 w-10" aria-hidden>
                <Icon className="h-5 w-5 text-uplift" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{label}</span>
                <span className="block text-xs text-muted">{note}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-uplift" aria-hidden />
            </button>
          );
        })}
      </fieldset>
    </Sheet>
  );
}

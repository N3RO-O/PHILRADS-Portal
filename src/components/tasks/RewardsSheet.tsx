import { CheckCircle2, Lock, Printer, Sparkles } from 'lucide-react';
import { formatNumber, formatShortInstant } from '../../lib/format';
import { FRAME_LABEL, LEVELS, XP_RULES, type Progress } from '../../lib/taskProgress';
import type { Kudos } from '../../services/tasks/types';
import { Sheet } from '../ui/Sheet';
import { BADGE_ICON } from './taskMeta';

export type RewardsTab = 'badges' | 'levels' | 'kudos';

interface Props {
  tab: RewardsTab | null;
  progress: Progress;
  kudos: Kudos[];
  onTab: (tab: RewardsTab) => void;
  onClose: () => void;
  onPrintCertificate: (level: number) => void;
}

/** Badges, levels with what each unlocks, certificates and kudos received. */
export function RewardsSheet({ tab, progress, kudos, onTab, onClose, onPrintCertificate }: Props) {
  const earned = progress.badges.filter((b) => b.earned).length;
  return (
    <Sheet
      open={Boolean(tab)}
      onClose={onClose}
      title="Badges and rewards"
      subtitle={`Level ${progress.level.level} · ${progress.level.title} · ${formatNumber(progress.xp)} XP. Only you and administrators see this.`}
    >
      <div role="tablist" aria-label="Rewards" className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-surface-sunken p-1">
        {(
          [
            ['badges', `Badges ${earned}/${progress.badges.length}`],
            ['levels', 'Levels'],
            ['kudos', `Kudos${kudos.length ? ` (${kudos.length})` : ''}`],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => onTab(t)}
            className="tap min-h-11 rounded-xl text-sm font-semibold text-ink-soft transition aria-selected:bg-surface-raised aria-selected:text-ink"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'badges' && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {progress.badges.map(({ badge, value, earned: got }) => {
            const Icon = BADGE_ICON[badge.icon];
            return (
              <li key={badge.id} className={`tile flex items-start gap-3 p-3 ${got ? '' : 'opacity-75'}`}>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${got ? 'border-uplift/50 bg-uplift/15 text-uplift' : 'border-line text-muted'}`}>
                  {got ? <Icon className="h-5 w-5" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{badge.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{badge.description}</p>
                  {!got && badge.target > 1 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden>
                        <div className="h-full rounded-full bg-uplift/70" style={{ width: `${(value / badge.target) * 100}%` }} />
                      </div>
                      <span className="text-[0.6875rem] tabular-nums text-muted">
                        {value}/{badge.target}
                      </span>
                    </div>
                  )}
                  {got && <p className="mt-1 text-[0.6875rem] font-semibold text-status-in">Earned</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'levels' && (
        <div className="flex flex-col gap-4">
          <ol className="flex flex-col gap-1.5">
            {LEVELS.map((l) => {
              const reached = progress.xp >= l.xp;
              const current = progress.level.level === l.level;
              return (
                <li key={l.level} className={`tile flex items-center gap-3 px-3 py-2.5 ${current ? 'ring-1 ring-uplift/60' : ''}`}>
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${reached ? 'bg-uplift/15 text-uplift' : 'bg-surface text-muted'}`}
                  >
                    {l.level}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">
                      {l.title} {current && <span className="ml-1 text-xs font-medium text-uplift">You are here</span>}
                    </p>
                    <p className="text-xs text-muted">
                      {formatNumber(l.xp)} XP{l.frame ? ` · ${FRAME_LABEL[l.frame]}` : ''}
                      {l.certificate ? ' · Certificate of Recognition' : ''}
                    </p>
                  </div>
                  {l.certificate && reached ? (
                    <button type="button" className="btn-ghost min-h-10 shrink-0 px-3 text-xs" onClick={() => onPrintCertificate(l.level)}>
                      <Printer className="h-4 w-4" aria-hidden /> Certificate
                    </button>
                  ) : reached ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-status-in" aria-label="Reached" />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-muted" aria-label="Not reached yet" />
                  )}
                </li>
              );
            })}
          </ol>
          <div className="rounded-xl border border-uplift/25 bg-uplift/[0.06] px-4 py-3 text-xs text-ink-soft">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-uplift" aria-hidden /> How XP works
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>
                A task someone gave you: {XP_RULES.base.low} XP (low), {XP_RULES.base.medium} XP (medium) or {XP_RULES.base.high} XP (high priority).
              </li>
              <li>+{XP_RULES.onTime} XP when it’s done on or before the due date they set.</li>
              <li>
                +{XP_RULES.perSubtask} XP for each finished subtask, up to +{XP_RULES.maxSubtasks}.
              </li>
              <li>
                Tasks you set for yourself: {XP_RULES.self} XP each, up to {XP_RULES.selfDailyCap} XP a day. Tasks someone gave you have no limit, and they can send one
                back if it isn’t really done (the XP goes with it).
              </li>
              <li>Kudos from a coordinator: +{XP_RULES.kudos} XP.</li>
              <li>Re-opening a finished task takes its XP back.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'kudos' &&
        (kudos.length === 0 ? (
          <p className="tile px-4 py-10 text-center text-sm text-muted">No kudos yet. Coordinators can thank people for work well done; it shows here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {kudos.map((k) => (
              <li key={k.id} className="tile flex flex-col gap-1 p-4">
                <p className="text-sm leading-relaxed">“{k.message}”</p>
                <p className="text-xs text-muted">
                  {k.fromName} · {formatShortInstant(k.createdAt)} · <span className="font-semibold text-uplift">+{k.points} XP</span>
                </p>
              </li>
            ))}
          </ul>
        ))}
    </Sheet>
  );
}

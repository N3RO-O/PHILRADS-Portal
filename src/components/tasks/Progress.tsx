import type { ReactNode } from 'react';
import { Award, ChevronRight, Flame, Sparkles, Trophy } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { FRAME_LABEL, XP_RULES, type Level, type Progress } from '../../lib/taskProgress';
import { Dialog } from '../ui/Dialog';
import { BADGE_ICON, FRAME_RING, FRAME_TEXT } from './taskMeta';

/** The person's initials in the profile ring their level has unlocked, with the level on a tab. */
export function LevelAvatar({ initials, progress, size = 'lg' }: { initials: string; progress: Progress; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-16 w-16 text-lg' : 'h-11 w-11 text-sm';
  return (
    <span className="relative inline-grid shrink-0" aria-hidden>
      <span className={`grid place-items-center rounded-full bg-burgundy-600 font-semibold tracking-wide text-white ring-[3px] ring-offset-2 ring-offset-surface ${FRAME_RING[progress.level.frame]} ${box}`}>
        {initials}
      </span>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-surface bg-uplift px-1.5 text-[0.625rem] font-bold leading-4 text-page">
        {progress.level.level}
      </span>
    </span>
  );
}

/** Level, XP towards the next level, streak and latest badges: private to the person. */
export function ProgressPanel({ initials, progress, onOpen }: { initials: string; progress: Progress; onOpen: (tab: 'badges' | 'levels' | 'kudos') => void }) {
  const { level, xp, stats } = progress;
  const earned = progress.badges.filter((b) => b.earned);
  const selfLeft = Math.max(0, XP_RULES.selfDailyCap - progress.selfXpToday);

  return (
    <section aria-label="Your progress" className="card flex flex-col gap-3 p-4 sm:gap-4 sm:p-5">
      <div className="flex items-center gap-4">
        <LevelAvatar initials={initials} progress={progress} />
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold uppercase tracking-wider ${FRAME_TEXT[level.frame]}`}>Level {level.level}</p>
          <p className="truncate text-lg font-bold leading-tight">{level.title}</p>
          <p className="text-xs tabular-nums text-muted">
            {formatNumber(xp)} XP in total
            {/* Phones: the stat tiles are hidden, so the essentials go here. */}
            <span className="sm:hidden">
              {' '}
              · {stats.streak}-day streak · +{progress.todayXp} today
            </span>
          </p>
        </div>
      </div>

      <div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-surface-sunken"
          role="progressbar"
          aria-label={level.next ? `Progress to level ${level.next.level}` : 'Top level reached'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level.progress * 100)}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-uplift/70 to-uplift transition-[width] duration-700" style={{ width: `${Math.max(4, level.progress * 100)}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-muted">
          {level.next ? (
            <>
              <strong className="font-semibold tabular-nums text-ink-soft">{formatNumber(level.toNext)} XP</strong> to Level {level.next.level} · {level.next.title}
            </>
          ) : (
            'Top level reached. Thank you for your faithful service.'
          )}
        </p>
      </div>

      <dl className="hidden grid-cols-3 gap-2 text-center sm:grid">
        <Stat icon={<Flame className={`h-4 w-4 ${stats.streak > 0 ? 'text-uplift' : 'text-muted'}`} aria-hidden />} label="Day streak" value={stats.streak} />
        <Stat icon={<Sparkles className="h-4 w-4 text-uplift" aria-hidden />} label="XP today" value={`+${progress.todayXp}`} />
        <Stat icon={<Award className="h-4 w-4 text-uplift" aria-hidden />} label="Badges" value={`${earned.length}/${progress.badges.length}`} />
      </dl>

      <p className="hidden text-xs text-muted sm:block">
        {selfLeft > 0 ? (
          <>
            Your own tasks can still earn <strong className="font-semibold text-ink-soft">{selfLeft} XP</strong> today. Tasks from others have no limit.
          </>
        ) : (
          'You’ve reached today’s XP limit for tasks you set yourself. Tasks from others still count.'
        )}
      </p>

      {earned.length > 0 && (
        <ul className="hidden flex-wrap gap-2 sm:flex" aria-label="Latest badges">
          {earned.slice(-6).map(({ badge }) => {
            const Icon = BADGE_ICON[badge.icon];
            return (
              <li key={badge.id} title={`${badge.name}: ${badge.description}`} className="grid h-9 w-9 place-items-center rounded-full border border-uplift/40 bg-uplift/10 text-uplift">
                <Icon className="h-4 w-4" aria-hidden />
                <span className="sr-only">{badge.name}</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost min-h-10 flex-1 px-3 text-sm" onClick={() => onOpen('badges')}>
          <Trophy className="h-4 w-4 text-uplift" aria-hidden /> Badges and rewards <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="tile flex flex-col items-center gap-0.5 px-2 py-2.5">
      {icon}
      <dd className="text-base font-bold tabular-nums leading-tight">{value}</dd>
      <dt className="text-[0.6875rem] text-muted">{label}</dt>
    </div>
  );
}

/** Shown once when a finished task takes the person to a new level. */
export function LevelUpDialog({ level, onClose, onViewRewards }: { level: Level | null; onClose: () => void; onViewRewards: () => void }) {
  return (
    <Dialog open={Boolean(level)} title="Level up" onClose={onClose}>
      {level && (
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid h-20 w-20 animate-pop-in place-items-center rounded-full border-2 border-uplift bg-uplift/15 text-3xl font-black text-uplift shadow-[0_0_40px_rgba(236,149,42,0.35)]">
            {level.level}
          </span>
          <div>
            <p className="text-sm text-muted">You’re now</p>
            <p className="text-xl font-bold">
              Level {level.level} · {level.title}
            </p>
          </div>
          <ul className="flex w-full flex-col gap-1.5 text-left text-sm">
            <li className="tile flex items-center gap-2 px-3 py-2">
              <Sparkles className="h-4 w-4 shrink-0 text-uplift" aria-hidden /> New title: {level.title}
            </li>
            {level.frame && (
              <li className="tile flex items-center gap-2 px-3 py-2">
                <Award className="h-4 w-4 shrink-0 text-uplift" aria-hidden /> {FRAME_LABEL[level.frame]} unlocked
              </li>
            )}
            {level.certificate && (
              <li className="tile flex items-center gap-2 px-3 py-2">
                <Trophy className="h-4 w-4 shrink-0 text-uplift" aria-hidden /> Certificate of Recognition, ready to print
              </li>
            )}
          </ul>
          <div className="flex w-full gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={onViewRewards}>
              See rewards
            </button>
            <button type="button" className="btn-primary flex-1" onClick={onClose} data-autofocus>
              Keep going
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

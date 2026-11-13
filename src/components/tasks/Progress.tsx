import type { ReactNode } from 'react';
import { Award, CalendarCheck, Check, ChevronRight, Sparkles, Trophy } from 'lucide-react';
import { formatNumber } from '../../lib/format';
import { FRAME_LABEL, RARITY_LABEL, XP_RULES, bestBadges, type Level, type Progress } from '../../lib/taskProgress';
import { Medal } from './Medal';
import { Dialog } from '../ui/Dialog';
import { FRAME_RING, FRAME_TEXT } from './taskMeta';
import { useAuth } from '../auth/AuthProvider';

/** Your picture (or initials in your colour) in the ring your level has unlocked, with the level on a tab. */
export function LevelAvatar({ initials, progress, size = 'lg' }: { initials: string; progress: Progress; size?: 'md' | 'lg' }) {
  const { profile } = useAuth();
  const box = size === 'lg' ? 'h-16 w-16 text-lg' : 'h-11 w-11 text-sm';
  const ring = `rounded-full ring-[3px] ring-offset-2 ring-offset-surface ${FRAME_RING[progress.level.frame]} ${box}`;
  return (
    <span className="relative inline-grid shrink-0" aria-hidden>
      {profile?.avatar ? (
        <img src={profile.avatar} alt="" className={`object-cover ${ring}`} />
      ) : (
        <span className={`grid place-items-center font-semibold tracking-wide text-white ${profile?.avatarColor ? '' : 'bg-burgundy-600'} ${ring}`} style={profile?.avatarColor ? { background: profile.avatarColor } : undefined}>
          {initials}
        </span>
      )}
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-surface bg-uplift px-1.5 text-[0.625rem] font-bold leading-4 text-onaccent">
        {progress.level.level}
      </span>
    </span>
  );
}

/** Level, XP towards the next level, streak and latest badges: private to the person. */
export function ProgressPanel({ initials, progress, onOpen }: { initials: string; progress: Progress; onOpen: (tab: 'badges' | 'levels' | 'kudos') => void }) {
  const { level, xp } = progress;
  const earned = progress.badges.filter((b) => b.earned);
  const selfLeft = Math.max(0, XP_RULES.selfDailyCap - progress.selfXpToday);

  return (
    <section aria-label="Your progress" className="card flex flex-col gap-3 sm:gap-4">
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
              · +{progress.todayXp} today
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
          <div className="h-full rounded-full bg-uplift transition-[width] duration-700" style={{ width: `${Math.max(4, level.progress * 100)}%` }} />
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

      <WeekCircles week={progress.week} />

      <dl className="hidden grid-cols-3 gap-2 text-center sm:grid">
        <Stat icon={<CalendarCheck className={`h-4 w-4 ${progress.fullWeeks > 0 ? 'text-uplift' : 'text-muted'}`} aria-hidden />} label="Full weeks" value={progress.fullWeeks} />
        <Stat icon={<Sparkles className="h-4 w-4" aria-hidden />} label="XP today" value={`+${progress.todayXp}`} />
        <Stat icon={<Award className="h-4 w-4" aria-hidden />} label="Badges" value={`${earned.length}/${progress.badges.length}`} />
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
        <ul className="hidden flex-wrap gap-2 sm:flex" aria-label="Best badges">
          {bestBadges(progress.badges)
            .slice(0, 6)
            .map(({ badge }) => (
              <li key={badge.id} title={`${badge.name} · ${RARITY_LABEL[badge.rarity]}: ${badge.description}`}>
                <Medal badge={badge} earned size="sm" />
                <span className="sr-only">
                  {badge.name}, {RARITY_LABEL[badge.rarity]}
                </span>
              </li>
            ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost min-h-10 flex-1 px-3 text-sm" onClick={() => onOpen('badges')}>
          <Trophy className="h-4 w-4" aria-hidden /> Badges and rewards <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}

const DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Monday to Sunday: a filled circle for each day a task was finished. Every working day earns the week bonus. */
export function WeekCircles({ week }: { week: Progress['week'] }) {
  const left = 5 - week.workDone;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">This week</p>
        <p className="text-xs tabular-nums text-muted">
          <strong className="font-semibold text-ink-soft">{week.workDone}</strong> of 5 working days
        </p>
      </div>
      <WeekDots week={week} />
      <p className="text-xs text-muted">
        {week.bonus ? (
          <>
            <strong className="font-semibold text-uplift">Full working week! +{XP_RULES.fullWeek} XP</strong> earned.
          </>
        ) : (
          <>
            Finish a task every day Monday to Friday for <strong className="font-semibold text-ink-soft">+{XP_RULES.fullWeek} XP</strong>
            {left < 5 && left > 0 ? ` · ${left} ${left === 1 ? 'day' : 'days'} to go` : ''}.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Just the seven circles, Monday to Sunday. `compact` is the small row on Home's My tasks card:
 * fixed-size circles in a line, without the "Today" word under them (the dashed ring says it).
 */
export function WeekDots({ week, compact = false }: { week: Progress['week']; compact?: boolean }) {
  return (
    <ol className={compact ? 'flex items-center gap-1.5' : 'grid grid-cols-7 gap-1.5'} aria-label="Days this week with a finished task">
      {week.days.map((d, i) => {
        const missed = !d.done && !d.future && !d.today && !d.weekend;
        return (
          <li key={d.day} className={`flex flex-col items-center gap-1 ${d.weekend ? 'opacity-60' : ''}`}>
            <span
              className={`relative grid aspect-square place-items-center rounded-full text-xs font-bold transition-all duration-500 ${compact ? 'w-8 sm:w-9' : 'w-full max-w-10'} ${
                d.done
                  ? 'premium animate-pop-in text-onaccent'
                  : d.today
                    ? 'border-2 border-dashed border-uplift text-uplift'
                    : missed
                      ? 'border-2 border-line bg-surface-sunken text-ink-mute'
                      : 'border-2 border-line text-ink-mute'
              }`}
            >
              {d.done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : DAY_LETTER[i]}
              <span className="sr-only">
                {DAY_NAME[i]}: {d.done ? 'task finished' : d.future ? 'still to come' : d.today ? 'today, nothing finished yet' : 'nothing finished'}
              </span>
            </span>
            {!compact && (
              <span className={`text-[0.625rem] leading-none ${d.today ? 'font-bold text-uplift' : 'invisible'}`} aria-hidden>
                Today
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-2.5">
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
            <li className="flex items-center gap-2 py-1">
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden /> New title: {level.title}
            </li>
            {level.frame && (
              <li className="flex items-center gap-2 py-1">
                <Award className="h-4 w-4 shrink-0" aria-hidden /> {FRAME_LABEL[level.frame]} unlocked
              </li>
            )}
            {level.certificate && (
              <li className="flex items-center gap-2 py-1">
                <Trophy className="h-4 w-4 shrink-0" aria-hidden /> Certificate of Recognition, ready to print
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

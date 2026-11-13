import { Link } from 'react-router-dom';
import { ArrowRight, Check, Gift, Loader2 } from 'lucide-react';
import { useDailyXp } from '../../hooks/useDailyXp';
import { XP_RULES } from '../../lib/taskProgress';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../ui/Avatar';
import { SoffitGradient } from '../ui/SoffitGradient';

/**
 * Greeting and the "View my tasks" shortcut, first on Home: the PHILRADS burgundy with the slow
 * "Soffit" light moving behind it (it follows the pointer), under a burgundy scrim so the text stays AA.
 */
export function WelcomeBar() {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <section aria-labelledby="welcome-title" className="relative isolate flex h-full flex-col gap-5 overflow-hidden rounded-2xl bg-burgundy-500 p-5 text-cloud">
      <SoffitGradient className="-z-10" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-burgundy-800/45" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {/* The avatar is already in the top bar; on phones the greeting gets the room instead. */}
          <span className="hidden sm:block">
            <Avatar initials={profile.initials} src={profile.avatar} color={profile.avatarColor} size="lg" />
          </span>
          <div className="min-w-0">
            <h2 id="welcome-title" className="text-lg font-bold leading-tight sm:text-xl">
              Good day, {profile.displayName}
            </h2>
            <DailyClaim />
          </div>
        </div>
        <Link to="/tasks" className="btn-primary shrink-0 self-start md:self-center">
          View my tasks <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/** +10 XP for checking in, once a day: a gift to tap, then a quiet "claimed" until tomorrow. */
function DailyClaim() {
  const daily = useDailyXp();
  if (!daily.ready) return <span className="mt-2 block h-8" aria-hidden />;
  if (daily.claimedToday)
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-cloud/80">
        <Check className="h-3.5 w-3.5" aria-hidden /> Today’s +{XP_RULES.daily} XP claimed. Back tomorrow for more.
      </p>
    );
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void daily.claim()}
        disabled={daily.busy}
        aria-busy={daily.busy || undefined}
        className="press inline-flex min-h-8 items-center gap-1.5 rounded-full bg-cloud px-3 text-xs font-bold text-burgundy-700 shadow-lg shadow-black/25 transition hover:brightness-95 disabled:opacity-70"
      >
        {daily.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Gift className="h-3.5 w-3.5" aria-hidden />}
        Claim today’s +{XP_RULES.daily} XP
      </button>
      {daily.error && <p className="mt-1 text-xs text-cloud" role="alert">{daily.error}</p>}
    </div>
  );
}

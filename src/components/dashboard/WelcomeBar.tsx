import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
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
          </div>
        </div>
        <Link to="/tasks" className="btn-primary shrink-0 self-start md:self-center">
          View my tasks <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

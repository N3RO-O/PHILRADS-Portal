import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../ui/Avatar';
import { SoffitGradient } from '../ui/SoffitGradient';

/** Greeting and the "View my tasks" shortcut. */
export function WelcomeBar() {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <section aria-labelledby="welcome-title" className="card relative isolate flex h-full flex-col gap-5 overflow-hidden">
      <SoffitGradient className="-z-10" />
      {/* Scrim: keeps the greeting and labels at WCAG AA over the brightest parts of the gradient. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-page/80" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {/* The avatar is already in the top bar; on phones the greeting gets the room instead. */}
          <span className="hidden sm:block">
            <Avatar initials={profile.initials} size="lg" />
          </span>
          <div className="min-w-0">
            <h2 id="welcome-title" className="text-lg font-bold leading-tight sm:text-xl">
              Good day, {profile.displayName}
            </h2>
          </div>
        </div>
        <Link to="/#my-tasks" className="btn-primary shrink-0 self-start md:self-center">
          View my tasks <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

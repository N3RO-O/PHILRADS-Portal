import { Link } from 'react-router-dom';
import { ArrowRight, FolderKanban, Map, PackagePlus, Plus, Printer, Upload } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../ui/Avatar';
import { SoffitGradient } from '../ui/SoffitGradient';

const ACTIONS = [
  { to: '/tasks?action=create-task', label: 'Create task', icon: Plus },
  { to: '/inventory?action=add-inventory', label: 'Add inventory record', icon: PackagePlus },
  { to: '/documentation?action=upload', label: 'Upload documentation', icon: Upload },
  { to: '/live-map', label: 'View live map', icon: Map },
  { to: '/projects', label: 'Open projects', icon: FolderKanban },
  { to: '/print-docs?action=create-print', label: 'Create print document', icon: Printer },
];

/** Greeting, the "View my tasks" shortcut, the slogan and the six quick actions. */
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
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Welcome to the PHILRADS Staff Portal. Manage your work, coordinate activities, and stay informed about our
              ongoing programs and response operations.
            </p>
            <p className="mt-1.5 text-xs font-semibold text-uplift">Serving People in Jesus’ Name.</p>
          </div>
        </div>
        <Link to="/#my-tasks" className="btn-primary shrink-0 self-start md:self-center">
          View my tasks <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div>
        <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">Quick actions</h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {ACTIONS.map(({ to, label, icon: Icon }) => (
            <li key={label}>
              <Link
                to={to}
                className="tile group flex h-full flex-col items-start gap-2.5 px-3.5 py-3 text-xs font-medium leading-snug text-ink-soft transition-colors hover:bg-surface-raised hover:text-ink"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-uplift/10 text-uplift transition-colors group-hover:bg-uplift group-hover:text-page">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

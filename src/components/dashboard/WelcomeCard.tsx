import { Link } from 'react-router-dom';
import { ArrowRight, FolderKanban, Map, SquareCheckBig, Upload } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../ui/Avatar';
import { Emblem } from '../ui/Emblem';

const SHORTCUTS = [
  { to: '/#my-tasks', label: 'My tasks', icon: SquareCheckBig },
  { to: '/documentation?action=upload', label: 'Upload', icon: Upload },
  { to: '/live-map', label: 'Live map', icon: Map },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
];

export function WelcomeCard() {
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <section aria-labelledby="welcome-title" className="card flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar initials={profile.initials} size="lg" />
        <div className="min-w-0">
          <h2 id="welcome-title" className="font-display text-xl leading-tight">
            Good day, {profile.displayName}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{[profile.roleName, profile.office].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <ul className="grid grid-cols-4 gap-2" aria-label="Shortcuts">
        {SHORTCUTS.map(({ to, label, icon: Icon }, i) => (
          <li key={to}>
            <Link
              to={to}
              className="group flex flex-col items-center gap-1.5 rounded-2xl py-1 text-center text-[0.6875rem] font-semibold leading-tight text-charcoal"
            >
              <span
                aria-hidden
                className={`grid h-11 w-11 place-items-center rounded-full transition group-hover:-translate-y-0.5 ${
                  i === 0 ? 'gloss-burgundy text-white' : 'glass-inset text-charcoal group-hover:bg-white'
                }`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem]" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm leading-relaxed text-muted">
        Welcome to the PHILRADS Staff Portal. Manage your work, coordinate activities, and stay informed about our ongoing
        programs and response operations.
      </p>
      <Link to="/#my-tasks" className="btn-primary self-start">
        View my tasks <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      <div className="gloss-burgundy sheen flex items-center gap-3 rounded-2xl px-3 py-2.5">
        <Emblem className="h-9 w-9" decorative />
        <p className="text-xs font-bold text-uplift">Serving People in Jesus’ Name.</p>
      </div>
    </section>
  );
}

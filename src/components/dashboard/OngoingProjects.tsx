import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatShortDate } from '../../lib/format';
import { dashboardService } from '../../services';
import { LoadError, Skeleton } from '../ui/Card';
import { SampleBadge } from '../ui/SampleBadge';

const TONES = [
  { card: 'bg-uplift-50', bar: 'bg-uplift' },
  { card: 'bg-burgundy-50', bar: 'bg-burgundy' },
  { card: 'bg-[#eceeef]', bar: 'bg-charcoal' },
];

const DAY = 86_400_000;
function timeLeft(endDate: string | null) {
  if (!endDate) return 'No end date';
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - start) / DAY);
  if (days < 0) return 'Past end date';
  if (days === 0) return 'Ends today';
  return `${days} ${days === 1 ? 'day' : 'days'} left`;
}

export function OngoingProjects() {
  const projects = useAsyncData(() => dashboardService.getOngoingProjects(3));
  return (
    <section aria-labelledby="projects-title" className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3 px-1">
        <h2 id="projects-title" className="flex items-center gap-2">
          <span className="pill bg-charcoal text-sm text-white">Ongoing projects</span>
          {dashboardService.source === 'mock' && <SampleBadge />}
        </h2>
        <Link to="/projects" className="link">
          All projects <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>
      {projects.status === 'error' && (
        <div className="card">
          <LoadError message={projects.error.message} onRetry={projects.reload} />
        </div>
      )}
      {projects.status === 'loading' && (
        <div className="grid gap-3 sm:grid-cols-3">
          {TONES.map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      )}
      {projects.status === 'success' &&
        (projects.data.length === 0 ? (
          <p className="card text-center text-sm text-muted">No active projects.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {projects.data.map((p, i) => {
              const tone = TONES[i % TONES.length];
              return (
                <li key={p.id} className={`flex flex-col gap-3 rounded-3xl p-4 ${tone.card}`}>
                  <p className="text-[0.6875rem] font-semibold text-muted">Updated {formatShortDate(p.updatedAt)}</p>
                  <p className="font-bold leading-snug">{p.name}</p>
                  <div className="mt-auto flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">{p.programArea}</span>
                      <span className="font-bold">{p.progress}%</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${p.name} progress`}
                      aria-valuenow={p.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-1.5 overflow-hidden rounded-full bg-white"
                    >
                      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }} />
                    </div>
                  </div>
                  <span className="pill self-end bg-white text-charcoal">
                    <Clock className="h-3 w-3" aria-hidden /> {timeLeft(p.endDate)}
                  </span>
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}

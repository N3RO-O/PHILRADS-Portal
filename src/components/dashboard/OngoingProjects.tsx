import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatShortDate } from '../../lib/format';
import { dashboardService } from '../../services';
import { LoadError, Skeleton } from '../ui/Card';
import { SampleBadge } from '../ui/SampleBadge';

const TONES = [
  { card: 'bg-gradient-to-br from-uplift-100 via-uplift-50 to-white/70', bar: 'bg-gradient-to-r from-uplift to-[#f4b764]' },
  { card: 'bg-gradient-to-br from-burgundy-100 via-burgundy-50 to-white/70', bar: 'bg-gradient-to-r from-burgundy to-[#9a1c1b]' },
  { card: 'bg-gradient-to-br from-[#e0e3e5] via-[#eef0f1] to-white/70', bar: 'bg-gradient-to-r from-charcoal to-[#5e5e5e]' },
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
          <span className="pill gloss-charcoal text-sm text-white">Ongoing projects</span>
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
                <li
                  key={p.id}
                  className={`sheen flex flex-col gap-3 rounded-3xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(255,255,255,0.7),0_12px_28px_-16px_rgba(53,53,53,0.3)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_0_0_1px_rgba(255,255,255,0.8),0_20px_36px_-16px_rgba(53,53,53,0.38)] ${tone.card}`}
                >
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
                      className="h-1.5 overflow-hidden rounded-full bg-white/80"
                    >
                      <div
                        className={`h-full origin-left animate-grow-x rounded-full ${tone.bar}`}
                        style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                      />
                    </div>
                  </div>
                  <span className="pill self-end bg-white/80 text-charcoal ring-1 ring-white backdrop-blur">
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

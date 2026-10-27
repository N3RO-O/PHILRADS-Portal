import { Link } from 'react-router-dom';
import { ArrowRight, FolderKanban } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { dashboardService } from '../../services';
import { Card, EmptyState, LoadError, Skeleton } from '../ui/Card';
import { TONES, timeLeft } from './labels';

/** Active projects with progress, in the style of the reference's Top Products table. */
export function ProjectsTable() {
  const projects = useAsyncData(() => dashboardService.getOngoingProjects(5));
  return (
    <Card
      id="projects"
      title="Ongoing projects"
      note="Active projects and how far along they are"
      source={dashboardService.source}
      className="h-full"
      action={
        <Link to="/projects" className="link shrink-0">
          All projects <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      {projects.status === 'loading' && <Skeleton className="h-52" />}
      {projects.status === 'error' && <LoadError message={projects.error.message} onRetry={projects.reload} />}
      {projects.status === 'success' &&
        (projects.data.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No active projects"
            action={
              <Link to="/projects" className="btn-ghost min-h-10 px-4 text-sm">
                Open Projects
              </Link>
            }
          >
            Projects in progress, with how far along each is, will show here.
          </EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="w-10 pb-2 font-medium">#</th>
                <th scope="col" className="pb-2 font-medium">Project</th>
                <th scope="col" className="w-[38%] pb-2 font-medium max-sm:hidden">Progress</th>
                <th scope="col" className="w-16 pb-2 text-right font-medium">Done</th>
              </tr>
            </thead>
            <tbody>
              {projects.data.map((p, i) => {
                const tone = TONES[i % TONES.length];
                const pct = Math.min(100, Math.max(0, p.progress));
                return (
                  <tr key={p.id} className="border-t border-line/70">
                    <td className="py-3 tabular-nums text-muted">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-3 pr-4">
                      <Link to={`/projects/${p.id}`} className="font-medium leading-snug text-ink hover:text-uplift hover:underline">{p.name}</Link>
                      <p className="text-xs text-muted">
                        {p.programArea} · {timeLeft(p.endDate)}
                      </p>
                    </td>
                    <td className="py-3 pr-4 max-sm:hidden">
                      <div className="h-1 overflow-hidden rounded-full bg-surface-raised" aria-hidden>
                        <div className={`h-full origin-left animate-grow-x rounded-full ${tone.bar}`} style={{ width: `${pct}%`, animationDelay: `${i * 60}ms` }} />
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <span className={`badge ${tone.badge}`}>{pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
    </Card>
  );
}

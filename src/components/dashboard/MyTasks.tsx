import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { AsyncState } from '../../hooks/useAsyncData';
import { formatShortDate } from '../../lib/format';
import { dashboardService } from '../../services';
import type { TaskStatus, TaskSummary } from '../../types';
import { Card, LoadError, Skeleton } from '../ui/Card';
import { PRIORITY_LABEL, PRIORITY_STYLE, STATUS_DOT, STATUS_LABEL, matchesSearch, moduleLabel } from './labels';

const FILTERS: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'review', label: 'Review' },
];

interface Props {
  tasks: AsyncState<TaskSummary[]> & { reload: () => void };
  search: string;
}

export function MyTasks({ tasks, search }: Props) {
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const rows =
    tasks.status === 'success'
      ? tasks.data
          .filter((t) => !status || t.status === status)
          .filter((t) => matchesSearch(search, t.title, moduleLabel(t.module), PRIORITY_LABEL[t.priority], STATUS_LABEL[t.status]))
          .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
      : [];

  return (
    <Card
      id="my-tasks"
      title="My tasks"
      note={search ? `Matching “${search}”` : 'Assigned to you, soonest due first'}
      source={dashboardService.source}
      action={
        <Link to="/tasks" className="link shrink-0">
          Open Tasks <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      }
    >
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter tasks by status">
        {FILTERS.map((f) => (
          <button key={f.label} type="button" className="chip" aria-pressed={status === f.value} onClick={() => setStatus(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      {tasks.status === 'loading' && <Skeleton className="h-48" />}
      {tasks.status === 'error' && <LoadError message={tasks.error.message} onRetry={tasks.reload} />}
      {tasks.status === 'success' &&
        (rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No tasks match.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((t) => (
              <li key={t.id} className="glass-inset flex animate-fade-in items-stretch gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-white/80">
                <span className={`w-1 shrink-0 rounded-full ${PRIORITY_STYLE[t.priority].bar}`} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{t.title}</p>
                    <p className="text-xs text-muted">
                      {[moduleLabel(t.module), t.dueDate && `Due ${formatShortDate(t.dueDate)}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`pill py-1 ${PRIORITY_STYLE[t.priority].pill}`}>{PRIORITY_LABEL[t.priority]}</span>
                    <span className="pill bg-white/85 py-1 text-charcoal ring-1 ring-black/[0.06]">
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status]}`} aria-hidden />
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </Card>
  );
}

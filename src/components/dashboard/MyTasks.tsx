import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { AsyncState } from '../../hooks/useAsyncData';
import { formatShortDate } from '../../lib/format';
import { dashboardService } from '../../services';
import type { TaskStatus, TaskSummary } from '../../types';
import { Card, LoadError, Skeleton } from '../ui/Card';
import { PRIORITY_BADGE, PRIORITY_LABEL, STATUS_DOT, STATUS_LABEL, matchesSearch, moduleLabel } from './labels';

const FILTERS: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'review', label: 'Review' },
];

/** Columns on wider screens; on phones each task stacks with its details on one line. */
const ROW = 'sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_7rem] sm:items-center sm:gap-4';

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
      className="h-full"
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
      {tasks.status === 'loading' && <Skeleton className="h-56" />}
      {tasks.status === 'error' && <LoadError message={tasks.error.message} onRetry={tasks.reload} />}
      {tasks.status === 'success' &&
        (rows.length === 0 ? (
          <p className="tile py-8 text-center text-sm text-muted">No tasks match.</p>
        ) : (
          <div>
            <div aria-hidden className={`hidden pb-2 text-xs font-medium text-muted ${ROW}`}>
              <span>Task</span>
              <span>Due</span>
              <span>Priority</span>
              <span>Status</span>
            </div>
            <ul>
              {rows.map((t) => (
                <li key={t.id} className={`flex animate-fade-in flex-col gap-2 border-t border-line/70 py-3 ${ROW}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-ink">{t.title}</p>
                    <p className="text-xs text-muted">{moduleLabel(t.module)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:contents">
                    <span className="text-xs tabular-nums text-ink-soft">
                      <span className="sm:hidden">Due </span>
                      {t.dueDate ? formatShortDate(t.dueDate) : '—'}
                    </span>
                    <span>
                      <span className={`badge ${PRIORITY_BADGE[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status]}`} aria-hidden />
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </Card>
  );
}

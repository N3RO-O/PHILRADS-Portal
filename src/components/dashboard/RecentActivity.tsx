import { Fragment, useState } from 'react';
import { Activity, FileText, FolderKanban, LifeBuoy, Package, SquareCheckBig, type LucideIcon } from 'lucide-react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatDayHeading, formatTime, manilaDayKey } from '../../lib/format';
import { dashboardService } from '../../services';
import type { ActivityKind } from '../../types';
import { Card, LoadError, Skeleton } from '../ui/Card';
import { matchesSearch } from './labels';

const KIND: Record<ActivityKind, { label: string; icon: LucideIcon; tone: string }> = {
  project: { label: 'Project', icon: FolderKanban, tone: 'glass-inset text-charcoal' },
  inventory: { label: 'Inventory', icon: Package, tone: 'bg-gradient-to-b from-uplift-50 to-uplift-100 text-uplift-700' },
  document: { label: 'Document', icon: FileText, tone: 'glass-inset text-charcoal' },
  task: { label: 'Task', icon: SquareCheckBig, tone: 'glass-inset text-charcoal' },
  response: { label: 'Response', icon: LifeBuoy, tone: 'bg-gradient-to-b from-burgundy-50 to-burgundy-100 text-burgundy' },
  other: { label: 'Update', icon: Activity, tone: 'glass-inset text-charcoal' },
};

const FILTERS: { value: ActivityKind | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'project', label: 'Projects' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'document', label: 'Documents' },
  { value: 'task', label: 'Tasks' },
  { value: 'response', label: 'Response' },
];

export function RecentActivity({ search }: { search: string }) {
  const activity = useAsyncData(() => dashboardService.getRecentActivity(12));
  const [kind, setKind] = useState<ActivityKind | ''>('');
  const items =
    activity.status === 'success'
      ? activity.data
          .filter((a) => !kind || a.kind === kind)
          .filter((a) => matchesSearch(search, a.title, a.detail, a.actor, KIND[a.kind].label))
      : [];
  const latestId = activity.status === 'success' ? activity.data[0]?.id : undefined;

  return (
    <Card id="recent-activity" title="Recent activity" note="Updates across projects, inventory, documents, tasks and response" source={dashboardService.source}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter activity by type">
        {FILTERS.map((f) => (
          <button key={f.label} type="button" className="chip" aria-pressed={kind === f.value} onClick={() => setKind(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      {activity.status === 'loading' && <Skeleton className="h-64" />}
      {activity.status === 'error' && <LoadError message={activity.error.message} onRetry={activity.reload} />}
      {activity.status === 'success' &&
        (items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No activity matches.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {items.map((a, i) => {
              const k = KIND[a.kind];
              const day = manilaDayKey(a.occurredAt);
              const showDay = i === 0 || manilaDayKey(items[i - 1].occurredAt) !== day;
              const highlight = a.id === latestId;
              return (
                <Fragment key={a.id}>
                  {showDay && (
                    <li aria-hidden className="px-1 pb-1 pt-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted first:pt-0">
                      {formatDayHeading(a.occurredAt)}
                    </li>
                  )}
                  <li className={`flex animate-fade-in gap-3 rounded-2xl px-3 py-2.5 transition-colors ${highlight ? 'gloss-charcoal sheen text-white' : 'hover:bg-white/70'}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${highlight ? 'bg-white/15 text-uplift ring-1 ring-white/20' : k.tone}`}>
                      <k.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{a.title}</p>
                      {a.detail && <p className={`text-xs ${highlight ? 'text-white/90' : 'text-muted'}`}>{a.detail}</p>}
                      <p className={`mt-0.5 text-xs ${highlight ? 'text-white/85' : 'text-muted'}`}>
                        <span className={`font-bold ${highlight ? 'text-white' : 'text-charcoal'}`}>{k.label}</span>
                        {a.actor && ` · ${a.actor}`} · <time dateTime={a.occurredAt}>{formatTime(a.occurredAt)}</time>
                        <span className="sr-only">, {formatDayHeading(a.occurredAt)}</span>
                      </p>
                    </div>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        ))}
    </Card>
  );
}
